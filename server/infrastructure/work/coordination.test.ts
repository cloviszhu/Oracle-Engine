import { describe, expect, it } from 'vitest';
import { buildStableJobId, selectRecoverableWork } from './coordination.js';

describe('durable work coordination', () => {
  it('builds a stable queue id from the durable intent', () => {
    expect(buildStableJobId({ stage: 'context', intentId: 'intent-7' })).toBe(
      'context--intent-7',
    );
  });

  it('recovers pending, retryable, and expired processing work only', () => {
    const now = new Date('2026-07-15T00:10:00.000Z');
    const work = selectRecoverableWork(
      [
        { id: 'pending', status: 'pending' },
        { id: 'retry', status: 'retryable_failed' },
        { id: 'expired', status: 'processing', leaseExpiresAt: new Date('2026-07-15T00:00:00Z') },
        { id: 'active', status: 'processing', leaseExpiresAt: new Date('2026-07-15T00:20:00Z') },
        { id: 'blocked', status: 'blocked' },
        { id: 'done', status: 'succeeded' },
      ],
      now,
    );

    expect(work.map((item) => item.id)).toEqual(['pending', 'retry', 'expired']);
  });
});
