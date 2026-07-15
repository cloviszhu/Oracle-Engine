import type { PipelineStage, ProcessingStatus } from '../../../shared/contracts/base.js';

export interface RecoverableWork {
  id: string;
  status: ProcessingStatus;
  leaseExpiresAt?: Date;
}

export function buildStableJobId(input: { stage: PipelineStage; intentId: string }): string {
  return `${input.stage}--${input.intentId}`;
}

export function selectRecoverableWork<T extends RecoverableWork>(items: readonly T[], now: Date): T[] {
  return items.filter(
    (item) =>
      item.status === 'pending' ||
      item.status === 'retryable_failed' ||
      (item.status === 'processing' && item.leaseExpiresAt !== undefined && item.leaseExpiresAt <= now),
  );
}
