import {
  FeishuDeliveryError,
  type FeishuNotificationMessage,
} from '../infrastructure/notifications/feishu.adapter.js';

type FinalDeliveryStatus =
  | 'sent'
  | 'retryable_failed'
  | 'outcome_unknown'
  | 'blocked'
  | 'dead_letter';

export interface NotificationDeliveryWork {
  deliveryId: string;
  attempt: number;
  message: FeishuNotificationMessage;
}

export interface NotificationDeliveryRepository {
  beginAttempt(deliveryId: string): Promise<NotificationDeliveryWork | undefined>;
  finishAttempt(input: {
    deliveryId: string;
    attempt: number;
    status: FinalDeliveryStatus;
    errorCode?: string;
    providerRequestId?: string;
    providerId?: string;
    manualRetryAllowed: boolean;
  }): Promise<void>;
}

interface NotificationAdapter {
  send(message: FeishuNotificationMessage): Promise<{
    providerRequestId?: string;
    providerMessageId?: string;
  }>;
}

export class NotificationDeliveryService {
  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly adapter: NotificationAdapter,
    private readonly options: { maxAttempts: number },
  ) {
    if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
      throw new Error('maxAttempts must be a positive integer');
    }
  }

  async deliver(deliveryId: string): Promise<{
    status: FinalDeliveryStatus | 'not_deliverable';
  }> {
    const work = await this.repository.beginAttempt(deliveryId);
    if (!work) return { status: 'not_deliverable' };

    try {
      const result = await this.adapter.send(work.message);
      await this.repository.finishAttempt({
        deliveryId: work.deliveryId,
        attempt: work.attempt,
        status: 'sent',
        providerRequestId: result.providerRequestId,
        providerId: result.providerMessageId,
        manualRetryAllowed: false,
      });
      return { status: 'sent' };
    } catch (error) {
      const failure = classifyFailure(error, work.attempt, this.options.maxAttempts);
      await this.repository.finishAttempt({
        deliveryId: work.deliveryId,
        attempt: work.attempt,
        ...failure,
      });
      return { status: failure.status };
    }
  }
}

function classifyFailure(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): {
  status: Exclude<FinalDeliveryStatus, 'sent'>;
  errorCode: string;
  providerRequestId?: string;
  manualRetryAllowed: boolean;
} {
  if (!(error instanceof FeishuDeliveryError)) {
    return {
      status: 'outcome_unknown',
      errorCode: 'outcome_unknown',
      manualRetryAllowed: false,
    };
  }
  if (error.outcomeUnknown) {
    return {
      status: 'outcome_unknown',
      errorCode: 'outcome_unknown',
      providerRequestId: error.providerRequestId,
      manualRetryAllowed: false,
    };
  }
  if (error.retryable) {
    const capped = attempt >= maxAttempts;
    return {
      status: capped ? 'dead_letter' : 'retryable_failed',
      errorCode: error.category,
      providerRequestId: error.providerRequestId,
      manualRetryAllowed: capped,
    };
  }
  return {
    status: 'blocked',
    errorCode: error.category,
    providerRequestId: error.providerRequestId,
    manualRetryAllowed: true,
  };
}
