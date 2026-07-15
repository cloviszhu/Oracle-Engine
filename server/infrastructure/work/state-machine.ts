import type { ProcessingStatus } from '../../../shared/contracts/base.js';

const allowedTransitions: Readonly<Record<ProcessingStatus, readonly ProcessingStatus[]>> = {
  pending: ['processing', 'blocked'],
  processing: ['succeeded', 'retryable_failed', 'blocked', 'dead_letter'],
  retryable_failed: ['pending', 'processing', 'dead_letter', 'blocked'],
  blocked: [],
  dead_letter: [],
  succeeded: [],
};

export function canTransition(from: ProcessingStatus, to: ProcessingStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function canManualRetry(input: {
  status: ProcessingStatus;
  manualRetryAllowed: boolean;
}): boolean {
  return input.manualRetryAllowed && (input.status === 'dead_letter' || input.status === 'blocked');
}

export function isLeaseCommitCurrent(input: {
  expectedFence: number;
  submittedFence: number;
}): boolean {
  return input.expectedFence === input.submittedFence;
}
