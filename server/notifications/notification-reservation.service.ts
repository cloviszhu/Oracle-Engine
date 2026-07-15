import { createHash } from 'node:crypto';

export interface NotificationReservationInput {
  scoreId: string;
  contentId: string;
  contentEventKey: string;
  cardVersion: number;
  policyVersion: string;
}

export interface DurableNotificationReservation extends NotificationReservationInput {
  channel: 'feishu';
  dedupeKey: string;
  cooldownSince: Date;
}

export type NotificationReservationResult = {
  status: 'created' | 'duplicate' | 'suppressed';
  deliveryId: string;
};

export interface NotificationReservationRepository {
  reserve(input: DurableNotificationReservation): Promise<NotificationReservationResult>;
}

interface NotificationQueue {
  add(
    name: 'notify',
    payload: { deliveryId: string },
    options: {
      jobId: string;
      attempts: number;
      backoff: { type: 'exponential'; delay: number };
      removeOnComplete: true;
      removeOnFail: true;
    },
  ): Promise<unknown>;
}

export class NotificationReservationService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: NotificationReservationRepository,
    private readonly queue: NotificationQueue,
    private readonly options: {
      enabled: boolean;
      cooldownMs: number;
      maxAttempts?: number;
      retryBackoffMs?: number;
      now?: () => Date;
    },
  ) {
    if (!Number.isFinite(options.cooldownMs) || options.cooldownMs < 0) {
      throw new Error('cooldownMs must be nonnegative');
    }
    if (options.maxAttempts !== undefined && (
      !Number.isInteger(options.maxAttempts) || options.maxAttempts < 1
    )) throw new Error('maxAttempts must be a positive integer');
    this.now = options.now ?? (() => new Date());
  }

  async reserve(input: NotificationReservationInput): Promise<
    NotificationReservationResult | { status: 'disabled' }
  > {
    validateInput(input);
    if (!this.options.enabled) return { status: 'disabled' };

    const channel = 'feishu' as const;
    const result = await this.repository.reserve({
      ...input,
      channel,
      dedupeKey: buildNotificationDeliveryKey({
        channel,
        contentId: input.contentId,
        cardVersion: input.cardVersion,
        policyVersion: input.policyVersion,
      }),
      cooldownSince: new Date(this.now().getTime() - this.options.cooldownMs),
    });
    if (result.status === 'created') {
      await this.queue.add(
        'notify',
        { deliveryId: result.deliveryId },
        {
          jobId: `notify--${result.deliveryId}`,
          attempts: this.options.maxAttempts ?? 5,
          backoff: { type: 'exponential', delay: this.options.retryBackoffMs ?? 30_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }
    return result;
  }
}

export function buildNotificationDeliveryKey(input: {
  channel: string;
  contentId: string;
  cardVersion: number;
  policyVersion: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify([
      input.channel,
      input.contentId,
      input.cardVersion,
      input.policyVersion,
    ]))
    .digest('hex');
}

function validateInput(input: NotificationReservationInput): void {
  if (!input.scoreId || !input.contentId || !input.contentEventKey || !input.policyVersion) {
    throw new Error('notification reservation identifiers are required');
  }
  if (!Number.isInteger(input.cardVersion) || input.cardVersion < 1) {
    throw new Error('cardVersion must be a positive integer');
  }
}
