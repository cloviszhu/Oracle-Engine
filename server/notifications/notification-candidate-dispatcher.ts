import type {
  NotificationReservationInput,
  NotificationReservationService,
} from './notification-reservation.service.js';

interface NotificationCandidateRepository {
  listUnreservedCandidates(limit: number): Promise<NotificationReservationInput[]>;
}

interface NotificationCandidateReservation {
  reserve(input: NotificationReservationInput): ReturnType<NotificationReservationService['reserve']>;
}

export async function dispatchNotificationCandidates(
  repository: NotificationCandidateRepository,
  reservation: NotificationCandidateReservation,
  limit: number,
  enabled = true,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error('notification candidate limit must be between 1 and 1000');
  }
  if (!enabled) return 0;
  const candidates = await repository.listUnreservedCandidates(limit);
  let reserved = 0;
  for (const candidate of candidates) {
    await reservation.reserve(candidate);
    reserved += 1;
  }
  return reserved;
}
