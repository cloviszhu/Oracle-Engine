import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { workerHeartbeats } from '../drizzle/schema.js';
import { createDatabase, createDatabasePool } from './infrastructure/database/client.js';
import { createRedisConnection } from './infrastructure/queue/client.js';
import { parseRuntimeConfig } from './infrastructure/runtime-config.js';
import { checkInfrastructureReadiness } from './infrastructure/worker-runtime.js';

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

const heartbeat = setInterval(() => {
  void writeHeartbeat('ready');
}, Math.max(5_000, Math.floor((config.work.leaseSeconds * 1_000) / 3)));

async function shutdown(): Promise<void> {
  clearInterval(heartbeat);
  await writeHeartbeat('stopping');
  await redis.quit();
  await pool.end();
}

process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
