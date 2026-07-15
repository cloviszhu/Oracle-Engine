import { randomUUID } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import {
  processingAttempts,
  processingIntents,
} from '../../drizzle/schema.js';
import type { createDatabase } from '../infrastructure/database/client.js';
import { buildOperationsStatus, RecoveryService } from './operations.service.js';

type Database = ReturnType<typeof createDatabase>;

export class DrizzleOperationsService {
  private readonly recovery: RecoveryService;

  constructor(
    private readonly database: Database,
    private readonly options: {
      feishuEnabled: boolean;
      feishuConfigured: boolean;
      dailyBudgetCents: number;
      visibilitySloMinutes: number;
    },
  ) {
    this.recovery = new RecoveryService(new DrizzleRecoveryRepository(database));
  }

  async status() {
    const [runsResult, stagesResult, workerResult, notifyResult, budgetResult, visibilityResult] = await Promise.all([
      this.database.execute(sql`
        SELECT mode, status FROM ingestion_runs ORDER BY started_at DESC LIMIT 100
      `),
      this.database.execute(sql`
        SELECT stage, status, block_reason AS errorCode
        FROM processing_intents ORDER BY updated_at DESC LIMIT 200
      `),
      this.database.execute(sql`
        SELECT status, heartbeat_at AS heartbeatAt
        FROM worker_heartbeats ORDER BY heartbeat_at DESC LIMIT 1
      `),
      this.database.execute(sql`
        SELECT status, COUNT(*) AS count FROM notification_deliveries GROUP BY status
      `),
      this.database.execute(sql`
        SELECT COALESCE(SUM(CASE WHEN status = 'settled' THEN settled_cents ELSE reserved_cents END), 0) AS spentCents
        FROM budget_reservations
        WHERE provider = 'openai' AND budget_date = UTC_DATE() AND status IN ('reserved', 'settled')
      `),
      this.database.execute(sql`
        SELECT c.first_observed_at AS firstObservedAt, rc.created_at AS visibleAt
        FROM content_items c
        LEFT JOIN research_cards rc ON rc.content_id = c.id
        ORDER BY c.first_observed_at DESC LIMIT 1
      `),
    ]);
    const notificationCounts = rowsOf(notifyResult);
    const backlog = notificationCounts
      .filter((row) => row.status !== 'sent' && row.status !== 'suppressed')
      .reduce((total, row) => total + Number(row.count ?? 0), 0);
    const spentCents = Number(rowsOf(budgetResult)[0]?.spentCents ?? 0);
    const visibilityRow = rowsOf(visibilityResult)[0];
    return buildOperationsStatus({
      ingestionRuns: rowsOf(runsResult) as Array<{ mode: 'poll' | 'compensation'; status: string }>,
      stages: rowsOf(stagesResult) as Array<{
        stage: 'ingest' | 'context' | 'analysis' | 'score' | 'notify';
        status: 'pending' | 'processing' | 'succeeded' | 'retryable_failed' | 'blocked' | 'dead_letter' | 'outcome_unknown';
        errorCode?: string;
      }>,
      worker: rowsOf(workerResult)[0] as { status: string; heartbeatAt: string } | undefined,
      notification: {
        enabled: this.options.feishuEnabled,
        configured: this.options.feishuConfigured,
        backlog,
      },
      budget: {
        blocked: spentCents >= this.options.dailyBudgetCents,
        dailyBudgetCents: this.options.dailyBudgetCents,
        spentCents,
      },
      visibility: visibilityRow ? {
        firstObservedAt: new Date(String(visibilityRow.firstObservedAt)).toISOString(),
        visibleAt: visibilityRow.visibleAt
          ? new Date(String(visibilityRow.visibleAt)).toISOString()
          : undefined,
        sloMinutes: this.options.visibilitySloMinutes,
      } : undefined,
    });
  }

  retry(id: string, actorId: string) {
    return this.recovery.retry(id, actorId);
  }
}

class DrizzleRecoveryRepository {
  constructor(private readonly database: Database) {}

  async findRecoverable(id: string) {
    const [intent] = await this.database
      .select({
        id: processingIntents.id,
        status: processingIntents.status,
        manualRetryAllowed: processingIntents.manualRetryAllowed,
      })
      .from(processingIntents)
      .where(eq(processingIntents.id, id))
      .limit(1);
    return intent;
  }

  async createAttempt(id: string, actorId: string) {
    return this.database.transaction(async (transaction) => {
      const [latest] = await transaction
        .select({ attempt: processingAttempts.attempt, fencingToken: processingAttempts.fencingToken })
        .from(processingAttempts)
        .where(eq(processingAttempts.intentId, id))
        .orderBy(desc(processingAttempts.attempt))
        .limit(1);
      const now = new Date();
      const record = {
        id: randomUUID(),
        intentId: id,
        attempt: (latest?.attempt ?? 0) + 1,
        status: 'pending' as const,
        fencingToken: (latest?.fencingToken ?? 0n) + 1n,
        requestedByActorId: actorId,
        startedAt: now,
      };
      await transaction.insert(processingAttempts).values(record);
      await transaction
        .update(processingIntents)
        .set({ status: 'pending', availableAt: now, updatedAt: now, manualRetryAllowed: false })
        .where(eq(processingIntents.id, id));
      return record;
    });
  }
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return [];
  return result[0].filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object');
}
