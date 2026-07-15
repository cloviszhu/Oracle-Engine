import { describe, expect, it } from 'vitest';
import { canManualRetry, canTransition, isLeaseCommitCurrent } from './state-machine.js';

describe('processing state and fencing rules', () => {
  it('permits only declared processing transitions', () => {
    expect(canTransition('pending', 'processing')).toBe(true);
    expect(canTransition('processing', 'retryable_failed')).toBe(true);
    expect(canTransition('succeeded', 'processing')).toBe(false);
    expect(canTransition('blocked', 'succeeded')).toBe(false);
  });

  it('requires explicit eligibility for manual retry', () => {
    expect(canManualRetry({ status: 'dead_letter', manualRetryAllowed: true })).toBe(true);
    expect(canManualRetry({ status: 'blocked', manualRetryAllowed: true })).toBe(true);
    expect(canManualRetry({ status: 'blocked', manualRetryAllowed: false })).toBe(false);
  });

  it('rejects a late worker commit with a stale fencing token', () => {
    expect(isLeaseCommitCurrent({ expectedFence: 3, submittedFence: 3 })).toBe(true);
    expect(isLeaseCommitCurrent({ expectedFence: 4, submittedFence: 3 })).toBe(false);
  });
});
