import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { createDatabase } from '../infrastructure/database/client.js';
import type {
  DurableNotificationReservation,
  NotificationReservationRepository,
  NotificationReservationResult,
} from './notification-reservation.service.js';

type Database = ReturnType<typeof createDatabase>;

export class DrizzleNotificationReservationRepository
implements NotificationReservationRepository {
  constructor(private readonly database: Database) {}

  async reserve(
    input: DurableNotificationReservation,
  ): Promise<NotificationReservationResult> {
    const eventHash = createHash('sha256')
      .update(`${input.channel}:${input.contentEventKey}`)
      .digest('hex')
      .slice(0, 32);
    const lockName = `serenity:notify:${eventHash}`;

    return this.database.transaction(async (transaction) => {
      const lockResult = await transaction.execute(sql`
        SELECT GET_LOCK(${lockName}, 5) AS acquired
      `);
      if (Number(firstRow(lockResult)?.acquired) !== 1) {
        throw new Error('reservation_lock_unavailable');
      }

      try {
        const exactResult = await transaction.execute(sql`
          SELECT id FROM notification_deliveries
          WHERE channel = ${input.channel} AND dedupe_key = ${input.dedupeKey}
          LIMIT 1
        `);
        const exact = firstRow(exactResult);
        if (exact) {
          return { status: 'duplicate', deliveryId: String(exact.id) };
        }

        const recentResult = await transaction.execute(sql`
          SELECT id FROM notification_deliveries
          WHERE channel = ${input.channel}
            AND content_event_key = ${input.contentEventKey}
            AND created_at >= ${input.cooldownSince}
            AND status IN ('pending', 'sending', 'sent', 'outcome_unknown')
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const deliveryId = randomUUID();
        const recent = firstRow(recentResult);
        const status = recent ? 'suppressed' as const : 'pending' as const;
        await transaction.execute(sql`
          INSERT INTO notification_deliveries
            (id, score_id, channel, content_event_key, card_version, dedupe_key,
             policy_version, status, manual_retry_allowed, created_at)
          VALUES
            (${deliveryId}, ${input.scoreId}, ${input.channel}, ${input.contentEventKey},
             ${input.cardVersion}, ${input.dedupeKey}, ${input.policyVersion}, ${status},
             false, ${new Date()})
        `);
        return {
          status: recent ? 'suppressed' : 'created',
          deliveryId,
        };
      } finally {
        await transaction.execute(sql`SELECT RELEASE_LOCK(${lockName}) AS released`);
      }
    });
  }

  async listPending(limit: number): Promise<Array<{ deliveryId: string }>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error('notification dispatch limit must be between 1 and 1000');
    }
    const result = await this.database.execute(sql`
      SELECT id AS deliveryId
      FROM notification_deliveries
      WHERE status IN ('pending', 'retryable_failed')
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);
    return rowsOf(result).flatMap((row) =>
      typeof row.deliveryId === 'string' ? [{ deliveryId: row.deliveryId }] : []
    );
  }

  async listUnreservedCandidates(limit: number): Promise<Array<{
    scoreId: string;
    contentId: string;
    contentEventKey: string;
    cardVersion: number;
    policyVersion: string;
  }>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error('notification candidate limit must be between 1 and 1000');
    }
    const result = await this.database.execute(sql`
      SELECT importance.id AS scoreId,
             content.id AS contentId,
             CONCAT(content.provider, ':', content.external_id) AS contentEventKey,
             cards.version AS cardVersion,
             importance.policy_version AS policyVersion
      FROM importance_scores importance
      JOIN research_cards cards ON cards.id = importance.card_id
      JOIN content_items content ON content.id = cards.content_id
      WHERE importance.decision = 'notify_candidate'
        AND NOT EXISTS (
          SELECT 1 FROM notification_deliveries deliveries
          WHERE deliveries.score_id = importance.id
        )
      ORDER BY importance.created_at ASC
      LIMIT ${limit}
    `);
    return rowsOf(result).flatMap((row) => {
      if (
        typeof row.scoreId !== 'string'
        || typeof row.contentId !== 'string'
        || typeof row.contentEventKey !== 'string'
        || typeof row.policyVersion !== 'string'
      ) return [];
      const cardVersion = Number(row.cardVersion);
      return Number.isInteger(cardVersion) && cardVersion > 0
        ? [{
            scoreId: row.scoreId,
            contentId: row.contentId,
            contentEventKey: row.contentEventKey,
            cardVersion,
            policyVersion: row.policyVersion,
          }]
        : [];
    });
  }

  async reconcileStaleSending(cutoff: Date): Promise<number> {
    if (Number.isNaN(cutoff.getTime())) throw new Error('stale sending cutoff must be valid');
    return this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE notification_attempts attempts
        JOIN notification_deliveries deliveries ON deliveries.id = attempts.delivery_id
        SET attempts.status = 'outcome_unknown',
            attempts.error_code = 'worker_interrupted',
            attempts.finished_at = ${new Date()}
        WHERE attempts.status = 'sending'
          AND deliveries.status = 'sending'
          AND attempts.started_at <= ${cutoff}
      `);
      const result = await transaction.execute(sql`
        UPDATE notification_deliveries deliveries
        SET deliveries.status = 'outcome_unknown',
            deliveries.error_code = 'worker_interrupted',
            deliveries.manual_retry_allowed = false
        WHERE deliveries.status = 'sending'
          AND EXISTS (
            SELECT 1 FROM notification_attempts attempts
            WHERE attempts.delivery_id = deliveries.id
              AND attempts.status = 'outcome_unknown'
              AND attempts.error_code = 'worker_interrupted'
          )
          AND NOT EXISTS (
            SELECT 1 FROM notification_attempts attempts
            WHERE attempts.delivery_id = deliveries.id
              AND attempts.status = 'sending'
          )
      `);
      return affectedRows(result);
    });
  }
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return undefined;
  const row = result[0][0];
  return row !== null && typeof row === 'object'
    ? row as Record<string, unknown>
    : undefined;
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return [];
  return result[0].filter(
    (row): row is Record<string, unknown> => row !== null && typeof row === 'object',
  );
}

function affectedRows(result: unknown): number {
  if (!Array.isArray(result)) return 0;
  const header = result[0];
  if (header !== null && typeof header === 'object' && 'affectedRows' in header) {
    return Number((header as { affectedRows: unknown }).affectedRows) || 0;
  }
  return 0;
}
