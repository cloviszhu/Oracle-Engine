import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { createDatabase } from '../infrastructure/database/client.js';
import type {
  ResearchBudgetGuard,
  BudgetReservation,
} from './research-analysis.service.js';

type Database = ReturnType<typeof createDatabase>;

interface BudgetGuardOptions {
  provider: string;
  dailyBudgetCents: number;
  reservationTtlMs: number;
  now?: () => Date;
}

export class DrizzleResearchBudgetGuard implements ResearchBudgetGuard {
  constructor(
    private readonly database: Database,
    private readonly options: BudgetGuardOptions,
  ) {
    if (!Number.isFinite(options.dailyBudgetCents) || options.dailyBudgetCents < 0) {
      throw new Error('dailyBudgetCents must be nonnegative');
    }
    if (!Number.isFinite(options.reservationTtlMs) || options.reservationTtlMs <= 0) {
      throw new Error('reservationTtlMs must be positive');
    }
  }

  async reserve(input: {
    analysisKey: string;
    estimatedCostCents: number;
  }): Promise<BudgetReservation> {
    if (!Number.isFinite(input.estimatedCostCents) || input.estimatedCostCents < 0) {
      throw new Error('estimatedCostCents must be nonnegative');
    }
    const now = (this.options.now ?? (() => new Date()))();
    const budgetDate = now.toISOString().slice(0, 10);
    const lockName = `serenity:ai-budget:${this.options.provider}:${budgetDate}`;

    return this.database.transaction(async (transaction) => {
      const lockResult = await transaction.execute(sql`
        SELECT GET_LOCK(${lockName}, 5) AS acquired
      `);
      if (Number(firstRow(lockResult)?.acquired) !== 1) {
        return { allowed: false, reason: 'rate_limit' };
      }

      try {
        const existingResult = await transaction.execute(sql`
          SELECT id, status, expires_at
          FROM budget_reservations
          WHERE provider = ${this.options.provider} AND idempotency_key = ${input.analysisKey}
          LIMIT 1
        `);
        const existing = firstRow(existingResult);
        const existingActive = existing && (
          existing.status === 'settled'
          || (existing.status === 'reserved' && new Date(String(existing.expires_at)).getTime() > now.getTime())
        );
        if (existingActive) {
          return { allowed: false, reason: 'in_progress' };
        }

        const totalResult = await transaction.execute(sql`
          SELECT COALESCE(SUM(
            CASE WHEN status = 'settled' THEN settled_cents ELSE reserved_cents END
          ), 0) AS spent_cents
          FROM budget_reservations
          WHERE provider = ${this.options.provider}
            AND budget_date = ${budgetDate}
            AND (status = 'settled' OR (status = 'reserved' AND expires_at > ${now}))
        `);
        const spentCents = Number(firstRow(totalResult)?.spent_cents ?? 0);
        if (spentCents + input.estimatedCostCents > this.options.dailyBudgetCents) {
          return { allowed: false, reason: 'budget' };
        }

        const reservationId = existing ? String(existing.id) : randomUUID();
        const expiresAt = new Date(now.getTime() + this.options.reservationTtlMs);
        if (existing) {
          await transaction.execute(sql`
            UPDATE budget_reservations
            SET budget_date = ${budgetDate}, reserved_cents = ${input.estimatedCostCents},
                settled_cents = NULL, status = 'reserved', expires_at = ${expiresAt}
            WHERE id = ${reservationId}
          `);
        } else {
          await transaction.execute(sql`
            INSERT INTO budget_reservations
              (id, provider, budget_date, idempotency_key, reserved_cents, status, expires_at, created_at)
            VALUES
              (${reservationId}, ${this.options.provider}, ${budgetDate}, ${input.analysisKey},
               ${input.estimatedCostCents}, 'reserved', ${expiresAt}, ${now})
          `);
        }
        return { allowed: true, reservationId };
      } finally {
        await transaction.execute(sql`SELECT RELEASE_LOCK(${lockName}) AS released`);
      }
    });
  }

  async settle(reservationId: string, actualCostCents: number): Promise<void> {
    if (!Number.isFinite(actualCostCents) || actualCostCents < 0) {
      throw new Error('actualCostCents must be nonnegative');
    }
    await this.database.execute(sql`
      UPDATE budget_reservations
      SET settled_cents = ${actualCostCents}, status = 'settled'
      WHERE id = ${reservationId} AND status = 'reserved'
    `);
  }

  async release(reservationId: string): Promise<void> {
    await this.database.execute(sql`
      UPDATE budget_reservations SET status = 'released'
      WHERE id = ${reservationId} AND status = 'reserved'
    `);
  }
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return undefined;
  const row = result[0][0];
  return row !== null && typeof row === 'object' ? row as Record<string, unknown> : undefined;
}
