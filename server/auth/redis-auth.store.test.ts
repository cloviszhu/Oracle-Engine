import { describe, expect, it, vi } from 'vitest';
import { RedisLoginLimiter, RedisSessionStore } from './redis-auth.store.js';

function redisMock() {
  const multi = {
    set: vi.fn().mockReturnThis(), sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(), del: vi.fn().mockReturnThis(),
    expireat: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]),
  };
  return {
    multi, redis: {
      multi: vi.fn(() => multi), get: vi.fn(), smembers: vi.fn(),
      incr: vi.fn(), pexpire: vi.fn(),
    },
  };
}

describe('Redis auth storage', () => {
  it('stores a hashed session with absolute Redis expiry and actor revocation index', async () => {
    const { redis, multi } = redisMock();
    const store = new RedisSessionStore(redis as never, 'test:');
    await store.put({
      tokenHash: 'hash-1', actorId: 'father', expiresAt: '2026-07-15T01:00:00.000Z',
    });

    expect(multi.set).toHaveBeenCalledWith(
      'test:session:hash-1',
      JSON.stringify({ tokenHash: 'hash-1', actorId: 'father', expiresAt: '2026-07-15T01:00:00.000Z' }),
      'EXAT',
      1784077200,
    );
    expect(multi.sadd).toHaveBeenCalledWith('test:actor:father', 'hash-1');
    expect(multi.expireat).toHaveBeenCalledWith('test:actor:father', 1784077200, 'GT');
  });

  it('deletes every indexed session when an actor password is rotated', async () => {
    const { redis, multi } = redisMock();
    redis.smembers.mockResolvedValue(['hash-1', 'hash-2']);
    const store = new RedisSessionStore(redis as never, 'test:');
    await store.deleteActor('father');
    expect(multi.del).toHaveBeenCalledWith(
      'test:session:hash-1', 'test:session:hash-2', 'test:actor:father',
    );
  });

  it('uses an atomic increment window for login limiting', async () => {
    const { redis } = redisMock();
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    const limiter = new RedisLoginLimiter(redis as never, { maxAttempts: 3, windowMs: 60_000, prefix: 'test:' });
    await expect(limiter.consume('ip:127.0.0.1')).resolves.toBe(true);
    await expect(limiter.consume('ip:127.0.0.1')).resolves.toBe(false);
    expect(redis.pexpire).toHaveBeenCalledOnce();
  });
});
