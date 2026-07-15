import { describe, expect, it, vi } from 'vitest';
import { NotificationReservationService } from './notification-reservation.service.js';
import { dispatchNotificationCandidates } from './notification-candidate-dispatcher.js';

describe('production notification candidate dispatcher', () => {
  it('turns a persisted importance candidate into a durable reservation and stable queue job', async () => {
    const candidate = {
      scoreId: 'score-1', contentId: 'content-1', contentEventKey: 'x:post-1',
      cardVersion: 2, policyVersion: 'importance-v1',
    };
    const candidates = { listUnreservedCandidates: vi.fn().mockResolvedValue([candidate]) };
    const reservations = {
      reserve: vi.fn().mockResolvedValue({ status: 'created', deliveryId: 'delivery-1' }),
    };
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new NotificationReservationService(reservations, queue, {
      enabled: true, cooldownMs: 3_600_000, maxAttempts: 3,
    });

    await expect(dispatchNotificationCandidates(candidates, service, 100)).resolves.toBe(1);
    expect(reservations.reserve).toHaveBeenCalledWith(expect.objectContaining(candidate));
    expect(queue.add).toHaveBeenCalledWith(
      'notify', { deliveryId: 'delivery-1' }, expect.objectContaining({ jobId: 'notify--delivery-1' }),
    );
  });

  it('does no reservation work when the channel is disabled', async () => {
    const candidates = { listUnreservedCandidates: vi.fn() };
    const service = { reserve: vi.fn() };
    await expect(dispatchNotificationCandidates(candidates, service, 100, false)).resolves.toBe(0);
    expect(candidates.listUnreservedCandidates).not.toHaveBeenCalled();
  });
});
