import { describe, expect, it, vi } from 'vitest';
import {
  DrizzleNotificationDeliveryRepository,
  toFeishuNotificationMessage,
} from './drizzle-notification-delivery.repository.js';

function database(results: unknown[]) {
  const execute = vi.fn(async () => results.shift());
  return {
    execute,
    transaction: vi.fn(async (operation: (transaction: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute })),
  };
}

const deliveryRow = {
  deliveryId: 'delivery-1', status: 'pending', contentId: 'content-1', cardId: 'card-1',
  translation: '忠实翻译', authorJudgment: JSON.stringify([{ text: '判断一' }, { text: '判断二' }]),
  uncertainties: JSON.stringify(['不确定一', { text: '不确定二' }]),
  reason: 'importance-v1: score 80 >= 70', sourceUrl: 'https://x.com/aleabitoreddit/status/1',
};

describe('Drizzle notification delivery repository', () => {
  it('builds a layered message without raw configuration', () => {
    expect(toFeishuNotificationMessage(deliveryRow)).toEqual({
      contentId: 'content-1',
      cardId: 'card-1',
      title: 'Serenity 重要产业情报',
      faithfulTranslation: '忠实翻译',
      serenityJudgment: '判断一\n判断二',
      uncertainties: ['不确定一', '不确定二'],
      importanceReason: 'importance-v1: score 80 >= 70',
      sourceUrl: 'https://x.com/aleabitoreddit/status/1',
    });
  });

  it('locks deliverable work, appends a sending attempt and returns its message', async () => {
    const db = database([
      [[deliveryRow]],
      [[{ attempt: 1 }]],
      [{ affectedRows: 1 }],
      [{ affectedRows: 1 }],
    ]);
    const repository = new DrizzleNotificationDeliveryRepository(db as never);
    await expect(repository.beginAttempt('delivery-1')).resolves.toMatchObject({
      deliveryId: 'delivery-1', attempt: 2,
      message: { cardId: 'card-1', faithfulTranslation: '忠实翻译' },
    });
    expect(db.execute).toHaveBeenCalledTimes(4);
  });

  it('does not start an attempt for a terminal or unknown delivery', async () => {
    const db = database([[[{ ...deliveryRow, status: 'sent' }]]]);
    const repository = new DrizzleNotificationDeliveryRepository(db as never);
    await expect(repository.beginAttempt('delivery-1')).resolves.toBeUndefined();
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('finishes both attempt history and current delivery state atomically', async () => {
    const db = database([[{ affectedRows: 1 }], [{ affectedRows: 1 }]]);
    const repository = new DrizzleNotificationDeliveryRepository(db as never);
    await repository.finishAttempt({
      deliveryId: 'delivery-1', attempt: 1, status: 'sent',
      providerRequestId: 'request-1', providerId: 'message-1', manualRetryAllowed: false,
    });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});
