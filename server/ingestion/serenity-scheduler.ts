import { SERENITY_POLL_JOB_ID } from './poll-source.service.js';

interface SchedulerQueue {
  upsertJobScheduler(
    schedulerId: string,
    repeat: { every: number },
    template: { name: string; data: { sourceKey: 'serenity' } },
  ): Promise<unknown>;
}

export async function scheduleSerenityPolling(queue: SchedulerQueue, intervalMs: number): Promise<void> {
  if (!Number.isInteger(intervalMs) || intervalMs < 60_000) {
    throw new Error('Serenity polling interval must be at least 60 seconds');
  }
  await queue.upsertJobScheduler(
    SERENITY_POLL_JOB_ID,
    { every: intervalMs },
    { name: 'poll-source', data: { sourceKey: 'serenity' } },
  );
}
