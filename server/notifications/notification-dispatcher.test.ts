import { describe, expect, it, vi } from 'vitest';
import { dispatchPendingNotifications } from './notification-dispatcher.js';

describe('pending notification dispatcher', () => {
  it('republishes durable pending deliveries with stable bounded-retry jobs', async () => {
    const repository = {
      reconcileStaleSending: vi.fn().mockResolvedValue(0),
      listPending: vi.fn().mockResolvedValue([{ deliveryId: 'delivery-1' }, { deliveryId: 'delivery-2' }]),
    };
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    await expect(dispatchPendingNotifications(repository, queue, {
      limit: 10, maxAttempts: 3, retryBackoffMs: 30_000, staleSendingAfterMs: 60_000,
    })).resolves.toBe(2);
    expect(queue.add).toHaveBeenNthCalledWith(
      1, 'notify', { deliveryId: 'delivery-1' }, {
        jobId: 'notify--delivery-1', attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true, removeOnFail: true,
      },
    );
    expect(repository.reconcileStaleSending).toHaveBeenCalledOnce();
  });

  it('leaves durable pending state unchanged when publication fails', async () => {
    const repository = {
      reconcileStaleSending: vi.fn().mockResolvedValue(1),
      listPending: vi.fn().mockResolvedValue([{ deliveryId: 'delivery-1' }]),
    };
    await expect(dispatchPendingNotifications(
      repository,
      { add: vi.fn().mockRejectedValue(new Error('redis unavailable')) },
      { limit: 10, maxAttempts: 3, retryBackoffMs: 30_000, staleSendingAfterMs: 60_000 },
    )).rejects.toThrow('redis unavailable');
  });
});
