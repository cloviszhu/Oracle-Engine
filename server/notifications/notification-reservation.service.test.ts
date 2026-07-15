import { describe, expect, it, vi } from 'vitest';
import {
  buildNotificationDeliveryKey,
  NotificationReservationService,
  type NotificationReservationInput,
  type NotificationReservationRepository,
} from './notification-reservation.service.js';

const candidate: NotificationReservationInput = {
  scoreId: 'score-1',
  contentId: 'content-1',
  contentEventKey: 'source-1:edit-2',
  cardVersion: 2,
  policyVersion: 'importance-v1',
};

describe('optional notification reservation', () => {
  it('creates no delivery, queue job or failure backlog while disabled', async () => {
    const repository = { reserve: vi.fn() };
    const queue = { add: vi.fn() };
    const service = new NotificationReservationService(repository, queue, {
      enabled: false, cooldownMs: 60_000,
    });

    await expect(service.reserve(candidate)).resolves.toEqual({ status: 'disabled' });
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('uses a versioned technical key and enqueues only after durable reservation', async () => {
    const order: string[] = [];
    const repository = {
      reserve: vi.fn(async () => {
        order.push('reserved');
        return { status: 'created' as const, deliveryId: 'delivery-1' };
      }),
    };
    const queue = { add: vi.fn(async () => order.push('queued')) };
    const service = new NotificationReservationService(repository, queue, {
      enabled: true, cooldownMs: 60_000, now: () => new Date('2026-07-15T00:00:00Z'),
    });

    await expect(service.reserve(candidate)).resolves.toEqual({
      status: 'created', deliveryId: 'delivery-1',
    });
    expect(repository.reserve).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'feishu', cardVersion: 2,
      dedupeKey: buildNotificationDeliveryKey({
        channel: 'feishu', contentId: 'content-1', cardVersion: 2, policyVersion: 'importance-v1',
      }),
      cooldownSince: new Date('2026-07-14T23:59:00Z'),
    }));
    expect(queue.add).toHaveBeenCalledWith(
      'notify', { deliveryId: 'delivery-1' }, {
        jobId: 'notify--delivery-1', attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true, removeOnFail: true,
      },
    );
    expect(order).toEqual(['reserved', 'queued']);
  });

  it.each(['duplicate', 'suppressed'] as const)('does not queue a %s reservation', async (status) => {
    const repository = { reserve: vi.fn().mockResolvedValue({ status, deliveryId: 'delivery-1' }) };
    const queue = { add: vi.fn() };
    const service = new NotificationReservationService(repository, queue, {
      enabled: true, cooldownMs: 60_000,
    });
    await expect(service.reserve(candidate)).resolves.toEqual({ status, deliveryId: 'delivery-1' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('leaves the durable pending reservation recoverable if queue publication fails', async () => {
    const repository = {
      reserve: vi.fn().mockResolvedValue({ status: 'created', deliveryId: 'delivery-1' }),
    };
    const queue = { add: vi.fn().mockRejectedValue(new Error('queue unavailable')) };
    const service = new NotificationReservationService(repository, queue, {
      enabled: true, cooldownMs: 60_000,
    });
    await expect(service.reserve(candidate)).rejects.toThrow('queue unavailable');
    expect(repository.reserve).toHaveBeenCalledOnce();
  });

  it('queues only one job when the repository atomically deduplicates concurrent reservations', async () => {
    let storedDeliveryId: string | undefined;
    const repository: NotificationReservationRepository = {
      reserve: vi.fn(async () => {
        if (storedDeliveryId) return { status: 'duplicate', deliveryId: storedDeliveryId };
        storedDeliveryId = 'delivery-1';
        await Promise.resolve();
        return { status: 'created', deliveryId: storedDeliveryId };
      }),
    };
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new NotificationReservationService(repository, queue, {
      enabled: true, cooldownMs: 60_000,
    });

    const results = await Promise.all([service.reserve(candidate), service.reserve(candidate)]);
    expect(results.map((item) => item.status).sort()).toEqual(['created', 'duplicate']);
    expect(queue.add).toHaveBeenCalledOnce();
  });
});
