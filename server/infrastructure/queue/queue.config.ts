export function readRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  return redisUrl;
}
