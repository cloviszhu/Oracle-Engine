export type DeliveryRecoveryStatus =
  | 'outcome_unknown'
  | 'retryable_failed'
  | 'sent'
  | 'suppressed'
  | 'blocked';

export type DeliveryRecoveryAction = 'reconcile' | 'retry' | 'dead_letter' | 'none';

export function planDeliveryRecovery(input: {
  status: DeliveryRecoveryStatus;
  attempts: number;
  maxAttempts: number;
}): { action: DeliveryRecoveryAction; automaticSend: boolean } {
  if (!Number.isInteger(input.attempts) || input.attempts < 0) {
    throw new Error('attempts must be a non-negative integer');
  }
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer');
  }

  if (input.status === 'outcome_unknown') {
    return { action: 'reconcile', automaticSend: false };
  }
  if (input.status === 'retryable_failed') {
    return input.attempts < input.maxAttempts
      ? { action: 'retry', automaticSend: true }
      : { action: 'dead_letter', automaticSend: false };
  }
  return { action: 'none', automaticSend: false };
}
