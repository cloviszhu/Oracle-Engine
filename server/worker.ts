import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import { workerHeartbeats } from '../drizzle/schema.js';
import { createDatabase, createDatabasePool } from './infrastructure/database/client.js';
import { FeishuNotificationAdapter } from './infrastructure/notifications/feishu.adapter.js';
import {
  createNotificationQueue,
  createRedisConnection,
  NOTIFICATION_QUEUE_NAME,
} from './infrastructure/queue/client.js';
import { parseRuntimeConfig } from './infrastructure/runtime-config.js';
import { checkInfrastructureReadiness } from './infrastructure/worker-runtime.js';
import { DrizzleNotificationDeliveryRepository } from './notifications/drizzle-notification-delivery.repository.js';
import { DrizzleNotificationReservationRepository } from './notifications/drizzle-notification.repository.js';
import { dispatchNotificationCandidates } from './notifications/notification-candidate-dispatcher.js';
import { NotificationDeliveryService } from './notifications/notification-delivery.service.js';
import { dispatchPendingNotifications } from './notifications/notification-dispatcher.js';
import { NotificationReservationService } from './notifications/notification-reservation.service.js';

const config = parseRuntimeConfig(process.env);
const pool = createDatabasePool(config.databaseUrl);
const database = createDatabase(pool);
const redis = createRedisConnection(config.redisUrl);
const workerId = `worker-${randomUUID()}`;
const startedAt = new Date();

async function writeHeartbeat(status: 'starting' | 'ready' | 'stopping'): Promise<void> {
  const now = new Date();
  await database
    .insert(workerHeartbeats)
    .values({ workerId, startedAt, heartbeatAt: now, status, version: '0.1.0' })
    .onDuplicateKeyUpdate({ set: { heartbeatAt: now, status } });
}

await writeHeartbeat('starting');
await checkInfrastructureReadiness({
  databasePing: async () => {
    await database.execute(sql`select 1`);
  },
  redisPing: () => redis.ping(),
});
await writeHeartbeat('ready');

let notificationConnection: ReturnType<typeof createRedisConnection> | undefined;
let notificationWorker: Worker<{ deliveryId: string }> | undefined;
let notificationQueue: ReturnType<typeof createNotificationQueue> | undefined;
let notificationDispatchTimer: ReturnType<typeof setInterval> | undefined;
if (config.feishu.enabled) {
  notificationConnection = redis.duplicate();
  notificationQueue = createNotificationQueue(redis);
  const reservationRepository = new DrizzleNotificationReservationRepository(database);
  const reservation = new NotificationReservationService(
    reservationRepository,
    notificationQueue,
    {
      enabled: true,
      cooldownMs: config.feishu.cooldownSeconds * 1_000,
      maxAttempts: config.work.maxAttempts,
      retryBackoffMs: 30_000,
    },
  );
  const delivery = new NotificationDeliveryService(
    new DrizzleNotificationDeliveryRepository(database),
    new FeishuNotificationAdapter({
      webhookUrl: config.feishu.webhookUrl,
      signingSecret: config.feishu.signingSecret,
      appBaseUrl: config.appBaseUrl,
      deadlineMs: config.work.externalDeadlineMs,
    }),
    { maxAttempts: config.work.maxAttempts },
  );
  notificationWorker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      const result = await delivery.deliver(String(job.data.deliveryId));
      if (result.status === 'retryable_failed') throw new Error('retryable_failed');
      return result;
    },
    { connection: notificationConnection, concurrency: Math.min(config.work.concurrency, 4) },
  );
  const dispatch = async () => {
    await dispatchNotificationCandidates(reservationRepository, reservation, 100)
      .catch(() => console.error('notification_candidate_dispatch_failed'));
    return dispatchPendingNotifications(reservationRepository, notificationQueue!, {
      limit: 100,
      maxAttempts: config.work.maxAttempts,
      retryBackoffMs: 30_000,
      staleSendingAfterMs: config.work.externalDeadlineMs + 60_000,
    });
  };
  await dispatch();
  notificationDispatchTimer = setInterval(() => {
    void dispatch().catch(() => console.error('notification_dispatch_failed'));
  }, 15_000);
}

const heartbeat = setInterval(() => {
  void writeHeartbeat('ready');
}, Math.max(5_000, Math.floor((config.work.leaseSeconds * 1_000) / 3)));

async function shutdown(): Promise<void> {
  clearInterval(heartbeat);
  if (notificationDispatchTimer) clearInterval(notificationDispatchTimer);
  await writeHeartbeat('stopping');
  await notificationWorker?.close();
  await notificationQueue?.close();
  await notificationConnection?.quit();
  await redis.quit();
  await pool.end();
}

process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
