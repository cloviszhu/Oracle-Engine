import { describe, expect, it, vi } from 'vitest';
import { scheduleSerenityPolling } from './serenity-scheduler.js';

describe('Serenity polling scheduler', () => {
  it('uses one stable scheduler id for the single configured source', async () => {
    const upsertJobScheduler = vi.fn().mockResolvedValue(undefined);

    await scheduleSerenityPolling({ upsertJobScheduler }, 300_000);

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'poll-source--serenity',
      { every: 300_000 },
      { name: 'poll-source', data: { sourceKey: 'serenity' } },
    );
  });
});
