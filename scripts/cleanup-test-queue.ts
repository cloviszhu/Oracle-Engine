import 'dotenv/config';
import { createCoreQueue, createRedisConnection } from '../server/infrastructure/queue/client.js';
import { readRedisUrl } from '../server/infrastructure/queue/queue.config.js';

const redisUrl = readRedisUrl();
if (process.env.NODE_ENV !== 'test' || !/\/\d+(?:\?|$)/.test(redisUrl)) {
  throw new Error('Refusing to clean Redis without an explicit test database number');
}

const redis = createRedisConnection(redisUrl);
const queue = createCoreQueue(redis);
try {
  await queue.obliterate({ force: true });
} finally {
  await queue.close();
  await redis.quit();
}
