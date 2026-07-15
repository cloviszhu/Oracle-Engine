import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
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
    const [
      runsResult,
      stagesResult,
      workerResult,
      notifyResult,
      notifyRecoverableResult,
      budgetResult,
      visibilityResult,
    ] = await Promise.all([
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
        SELECT id, status, manual_retry_allowed AS manualRetryAllowed
        FROM notification_deliveries
        WHERE status IN ('blocked', 'dead_letter')
          AND manual_retry_allowed = true
        ORDER BY created_at DESC
        LIMIT 100
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
        recoverable: rowsOf(notifyRecoverableResult).flatMap((row) =>
          typeof row.id === 'string'
            && (row.status === 'blocked' || row.status === 'dead_letter')
            ? [{
                id: row.id,
                status: row.status,
                manualRetryAllowed: true as const,
              }]
            : []
        ),
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

export class DrizzleRecoveryRepository {
  constructor(private readonly database: Database) {}

  async findRecoverable(id: string) {
    const result = await this.database.execute(sql`
      SELECT kind, id, status, manualRetryAllowed
      FROM (
        SELECT 'processing' AS kind, id, status,
               manual_retry_allowed AS manualRetryAllowed
        FROM processing_intents WHERE id = ${id}
        UNION ALL
        SELECT 'notification' AS kind, id, status,
               manual_retry_allowed AS manualRetryAllowed
        FROM notification_deliveries WHERE id = ${id}
      ) recoverable
      LIMIT 1
    `);
    const row = rowsOf(result)[0];
    if (
      !row
      || (row.kind !== 'processing' && row.kind !== 'notification')
      || typeof row.id !== 'string'
      || typeof row.status !== 'string'
    ) return undefined;
    const kind: 'processing' | 'notification' = row.kind;
    return {
      kind,
      id: row.id,
      status: row.status,
      manualRetryAllowed: Boolean(row.manualRetryAllowed),
    };
  }

  async createAttempt(work: {
    kind: 'processing' | 'notification';
    id: string;
    status: string;
    manualRetryAllowed: boolean;
  }, actorId: string) {
    return this.database.transaction(async (transaction) => {
      const currentResult = await transaction.execute(sql`
        SELECT status, manual_retry_allowed AS manualRetryAllowed
        FROM ${sql.raw(work.kind === 'processing' ? 'processing_intents' : 'notification_deliveries')}
        WHERE id = ${work.id}
        LIMIT 1
        FOR UPDATE
      `);
      const current = rowsOf(currentResult)[0];
      if (
        !current
        || !current.manualRetryAllowed
        || (current.status !== 'blocked' && current.status !== 'dead_letter')
      ) throw new Error('not_recoverable');

      const now = new Date();
      if (work.kind === 'notification') {
        const record = {
          id: randomUUID(),
          kind: 'notification' as const,
          deliveryId: work.id,
          status: 'pending' as const,
          requestedByActorId: actorId,
          requestedAt: now,
        };
        await transaction.execute(sql`
          INSERT INTO notification_recovery_requests
            (id, delivery_id, actor_id, previous_status, requested_at)
          VALUES
            (${record.id}, ${work.id}, ${actorId}, ${String(current.status)}, ${now})
        `);
        await transaction.execute(sql`
          UPDATE notification_deliveries
          SET status = 'pending', error_code = NULL, manual_retry_allowed = false
          WHERE id = ${work.id}
        `);
        return record;
      }

      const latestResult = await transaction.execute(sql`
        SELECT attempt, fencing_token AS fencingToken
        FROM processing_attempts
        WHERE intent_id = ${work.id}
        ORDER BY attempt DESC
        LIMIT 1
      `);
      const latest = rowsOf(latestResult)[0];
      const record = {
        id: randomUUID(),
        kind: 'processing' as const,
        intentId: work.id,
        attempt: Number(latest?.attempt ?? 0) + 1,
        status: 'pending' as const,
        fencingToken: BigInt(String(latest?.fencingToken ?? 0)) + 1n,
        requestedByActorId: actorId,
        startedAt: now,
      };
      await transaction.execute(sql`
        INSERT INTO processing_attempts
          (id, intent_id, attempt, status, fencing_token, requested_by_actor_id, started_at)
        VALUES
          (${record.id}, ${record.intentId}, ${record.attempt}, ${record.status},
           ${record.fencingToken}, ${record.requestedByActorId}, ${record.startedAt})
      `);
      await transaction.execute(sql`
        UPDATE processing_intents
        SET status = 'pending', available_at = ${now}, updated_at = ${now},
            manual_retry_allowed = false
        WHERE id = ${work.id}
      `);
      return record;
    });
  }
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return [];
  return result[0].filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object');
}
