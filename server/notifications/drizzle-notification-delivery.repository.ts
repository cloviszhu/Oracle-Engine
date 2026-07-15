import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { FeishuNotificationMessage } from '../infrastructure/notifications/feishu.adapter.js';
import type { createDatabase } from '../infrastructure/database/client.js';
import type {
  NotificationDeliveryRepository,
  NotificationDeliveryWork,
} from './notification-delivery.service.js';

type Database = ReturnType<typeof createDatabase>;

export class DrizzleNotificationDeliveryRepository
implements NotificationDeliveryRepository {
  constructor(private readonly database: Database) {}

  async beginAttempt(deliveryId: string): Promise<NotificationDeliveryWork | undefined> {
    return this.database.transaction(async (transaction) => {
      const deliveryResult = await transaction.execute(sql`
        SELECT nd.id AS deliveryId, nd.status,
               content.id AS contentId, rc.id AS cardId, rc.translation, rc.author_judgment AS authorJudgment,
               rc.uncertainties, importance.reason, content.source_url AS sourceUrl
        FROM notification_deliveries nd
        JOIN importance_scores importance ON importance.id = nd.score_id
        JOIN research_cards rc ON rc.id = importance.card_id
        JOIN content_items content ON content.id = rc.content_id
        WHERE nd.id = ${deliveryId}
        LIMIT 1
        FOR UPDATE
      `);
      const delivery = firstRow(deliveryResult);
      if (!delivery || (delivery.status !== 'pending' && delivery.status !== 'retryable_failed')) {
        return undefined;
      }

      const attemptResult = await transaction.execute(sql`
        SELECT COALESCE(MAX(attempt), 0) AS attempt
        FROM notification_attempts WHERE delivery_id = ${deliveryId}
      `);
      const attempt = Number(firstRow(attemptResult)?.attempt ?? 0) + 1;
      const now = new Date();
      await transaction.execute(sql`
        INSERT INTO notification_attempts
          (id, delivery_id, attempt, status, started_at)
        VALUES (${randomUUID()}, ${deliveryId}, ${attempt}, 'sending', ${now})
      `);
      await transaction.execute(sql`
        UPDATE notification_deliveries
        SET status = 'sending', error_code = NULL, manual_retry_allowed = false
        WHERE id = ${deliveryId}
      `);
      return {
        deliveryId,
        attempt,
        message: toFeishuNotificationMessage(delivery),
      };
    });
  }

  async finishAttempt(input: Parameters<NotificationDeliveryRepository['finishAttempt']>[0]): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const now = new Date();
      await transaction.execute(sql`
        UPDATE notification_attempts
        SET status = ${input.status}, provider_request_id = ${input.providerRequestId ?? null},
            error_code = ${input.errorCode ?? null}, finished_at = ${now}
        WHERE delivery_id = ${input.deliveryId} AND attempt = ${input.attempt}
          AND status = 'sending'
      `);
      await transaction.execute(sql`
        UPDATE notification_deliveries
        SET status = ${input.status}, provider_id = ${input.providerId ?? null},
            error_code = ${input.errorCode ?? null},
            manual_retry_allowed = ${input.manualRetryAllowed},
            sent_at = ${input.status === 'sent' ? now : null}
        WHERE id = ${input.deliveryId} AND status = 'sending'
      `);
    });
  }
}

export function toFeishuNotificationMessage(
  row: Record<string, unknown>,
): FeishuNotificationMessage {
  const cardId = requiredString(row.cardId, 'cardId');
  return {
    contentId: requiredString(row.contentId, 'contentId'),
    cardId,
    title: 'Serenity 重要产业情报',
    faithfulTranslation: requiredString(row.translation, 'translation'),
    serenityJudgment: textItems(row.authorJudgment).join('\n') || '未提取到明确判断',
    uncertainties: textItems(row.uncertainties),
    importanceReason: requiredString(row.reason, 'importance reason'),
    sourceUrl: requiredString(row.sourceUrl, 'source URL'),
  };
}

function textItems(value: unknown): string[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (item !== null && typeof item === 'object') {
      const text = (item as Record<string, unknown>).text;
      return typeof text === 'string' && text.trim() ? [text.trim()] : [];
    }
    return [];
  });
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`notification ${name} is required`);
  }
  return value;
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return undefined;
  const row = result[0][0];
  return row !== null && typeof row === 'object'
    ? row as Record<string, unknown>
    : undefined;
}
