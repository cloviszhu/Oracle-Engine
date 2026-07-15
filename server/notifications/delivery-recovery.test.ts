import { describe, expect, it } from 'vitest';
import { planDeliveryRecovery } from './delivery-recovery.js';

describe('notification delivery recovery', () => {
  it('never blindly resends an outcome-unknown delivery', () => {
    expect(planDeliveryRecovery({ status: 'outcome_unknown', attempts: 1, maxAttempts: 5 }))
      .toEqual({ action: 'reconcile', automaticSend: false });
  });

  it('retries confirmed failures within bounds then sends them to dead letter', () => {
    expect(planDeliveryRecovery({ status: 'retryable_failed', attempts: 2, maxAttempts: 3 }))
      .toEqual({ action: 'retry', automaticSend: true });
    expect(planDeliveryRecovery({ status: 'retryable_failed', attempts: 3, maxAttempts: 3 }))
      .toEqual({ action: 'dead_letter', automaticSend: false });
  });

  it('does nothing for sent, suppressed, blocked or disabled work', () => {
    for (const status of ['sent', 'suppressed', 'blocked'] as const) {
      expect(planDeliveryRecovery({ status, attempts: 1, maxAttempts: 3 }).automaticSend).toBe(false);
    }
  });
});
