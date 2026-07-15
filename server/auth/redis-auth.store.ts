import type { Redis } from 'ioredis';
import type { SessionRecord } from './family-auth.service.js';

export class RedisSessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'serenity:auth:',
  ) {}

  async put(record: SessionRecord): Promise<void> {
    const expiresAtSeconds = Math.floor(new Date(record.expiresAt).getTime() / 1_000);
    if (!Number.isFinite(expiresAtSeconds)) throw new Error('session expiry must be valid');
    const transaction = this.redis.multi();
    transaction.set(this.sessionKey(record.tokenHash), JSON.stringify(record), 'EXAT', expiresAtSeconds);
    transaction.sadd(this.actorKey(record.actorId), record.tokenHash);
    transaction.expireat(this.actorKey(record.actorId), expiresAtSeconds, 'GT');
    await transaction.exec();
  }

  async get(tokenHash: string): Promise<SessionRecord | undefined> {
    const value = await this.redis.get(this.sessionKey(tokenHash));
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as Partial<SessionRecord>;
      return typeof parsed.tokenHash === 'string'
        && typeof parsed.actorId === 'string'
        && typeof parsed.expiresAt === 'string'
        ? parsed as SessionRecord
        : undefined;
    } catch {
      return undefined;
    }
  }

  async delete(tokenHash: string): Promise<void> {
    const record = await this.get(tokenHash);
    const transaction = this.redis.multi();
    transaction.del(this.sessionKey(tokenHash));
    if (record) transaction.srem(this.actorKey(record.actorId), tokenHash);
    await transaction.exec();
  }

  async deleteActor(actorId: string): Promise<void> {
    const hashes = await this.redis.smembers(this.actorKey(actorId));
    const transaction = this.redis.multi();
    transaction.del(...hashes.map((hash) => this.sessionKey(hash)), this.actorKey(actorId));
    await transaction.exec();
  }

  private sessionKey(tokenHash: string): string {
    return `${this.prefix}session:${tokenHash}`;
  }

  private actorKey(actorId: string): string {
    return `${this.prefix}actor:${actorId}`;
  }
}

export class RedisLoginLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly options: { maxAttempts: number; windowMs: number; prefix?: string },
  ) {}

  async consume(key: string): Promise<boolean> {
    const redisKey = `${this.options.prefix ?? 'serenity:login:'}${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.pexpire(redisKey, this.options.windowMs);
    return count <= this.options.maxAttempts;
  }
}
