import { describe, expect, it, vi } from 'vitest';
import { DrizzleNotificationReservationRepository } from './drizzle-notification.repository.js';

const input = {
  scoreId: 'score-1',
  contentId: 'content-1',
  contentEventKey: 'source-1:event-1',
  cardVersion: 2,
  policyVersion: 'importance-v1',
  channel: 'feishu' as const,
  dedupeKey: 'dedupe-1',
  cooldownSince: new Date('2026-07-14T23:00:00Z'),
};

function database(results: unknown[]) {
  const execute = vi.fn(async () => results.shift());
  return {
    execute,
    transaction: vi.fn(async (operation: (transaction: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute })),
  };
}

describe('Drizzle notification reservation repository', () => {
  it('serializes the user-visible event and creates one pending delivery', async () => {
    const db = database([
      [[{ acquired: 1 }]],
      [[]],
      [[]],
      [{ affectedRows: 1 }],
      [[{ released: 1 }]],
    ]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.reserve(input)).resolves.toMatchObject({ status: 'created' });
    expect(db.execute).toHaveBeenCalledTimes(5);
  });

  it('returns the existing delivery for an exact technical duplicate', async () => {
    const db = database([
      [[{ acquired: 1 }]],
      [[{ id: 'delivery-existing' }]],
      [[{ released: 1 }]],
    ]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.reserve(input)).resolves.toEqual({
      status: 'duplicate', deliveryId: 'delivery-existing',
    });
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it('records a suppressed fact instead of queueable work inside the cooldown window', async () => {
    const db = database([
      [[{ acquired: 1 }]],
      [[]],
      [[{ id: 'recent-delivery' }]],
      [{ affectedRows: 1 }],
      [[{ released: 1 }]],
    ]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.reserve(input)).resolves.toMatchObject({ status: 'suppressed' });
    expect(db.execute).toHaveBeenCalledTimes(5);
  });

  it('fails closed when the cross-process event lock cannot be acquired', async () => {
    const db = database([[[{ acquired: 0 }]]]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.reserve(input)).rejects.toThrow('reservation_lock_unavailable');
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('lists durable pending and retryable ids for dispatcher recovery', async () => {
    const db = database([[[{ deliveryId: 'delivery-1' }, { deliveryId: 'delivery-2' }]]]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.listPending(10)).resolves.toEqual([
      { deliveryId: 'delivery-1' }, { deliveryId: 'delivery-2' },
    ]);
  });

  it('lists persisted importance candidates that have no delivery reservation', async () => {
    const db = database([[[{
      scoreId: 'score-1', contentId: 'content-1', contentEventKey: 'x:post-1',
      cardVersion: 2, policyVersion: 'importance-v1',
    }]]]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.listUnreservedCandidates(10)).resolves.toEqual([{
      scoreId: 'score-1', contentId: 'content-1', contentEventKey: 'x:post-1',
      cardVersion: 2, policyVersion: 'importance-v1',
    }]);
  });

  it('moves interrupted stale sends to outcome unknown without making them queueable', async () => {
    const db = database([
      [{ affectedRows: 1 }],
      [{ affectedRows: 1 }],
    ]);
    const repository = new DrizzleNotificationReservationRepository(db as never);
    await expect(repository.reconcileStaleSending(
      new Date('2026-07-15T00:00:00Z'),
    )).resolves.toBe(1);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});
