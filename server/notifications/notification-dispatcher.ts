interface PendingNotificationRepository {
  reconcileStaleSending(cutoff: Date): Promise<number>;
  listPending(limit: number): Promise<Array<{ deliveryId: string }>>;
}

interface NotificationQueuePublisher {
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

export async function dispatchPendingNotifications(
  repository: PendingNotificationRepository,
  queue: NotificationQueuePublisher,
  options: {
    limit: number;
    maxAttempts: number;
    retryBackoffMs: number;
    staleSendingAfterMs: number;
    now?: () => Date;
  },
): Promise<number> {
  if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error('limit must be positive');
  if (!Number.isFinite(options.staleSendingAfterMs) || options.staleSendingAfterMs <= 0) {
    throw new Error('staleSendingAfterMs must be positive');
  }
  const now = options.now?.() ?? new Date();
  await repository.reconcileStaleSending(
    new Date(now.getTime() - options.staleSendingAfterMs),
  );
  const pending = await repository.listPending(options.limit);
  let dispatched = 0;
  for (const item of pending) {
    await queue.add(
      'notify',
      { deliveryId: item.deliveryId },
      {
        jobId: `notify--${item.deliveryId}`,
        attempts: options.maxAttempts,
        backoff: { type: 'exponential', delay: options.retryBackoffMs },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    dispatched += 1;
  }
  return dispatched;
}
