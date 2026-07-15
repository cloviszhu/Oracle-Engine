import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { PipelineStage } from '../../../shared/contracts/base.js';

export const CORE_QUEUE_NAME = 'serenity-core-pipeline';
export const NOTIFICATION_QUEUE_NAME = 'serenity-notifications';

export function createRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

export function createCoreQueue(connection: Redis): Queue<{ stage: PipelineStage; intentId: string }> {
  return new Queue(CORE_QUEUE_NAME, { connection });
}

export function createNotificationQueue(connection: Redis): Queue<{ deliveryId: string }> {
  return new Queue(NOTIFICATION_QUEUE_NAME, { connection });
}
