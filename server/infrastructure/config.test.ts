import { afterEach, describe, expect, it } from 'vitest';
import { readDatabaseUrl } from './database/database.config.js';
import { readRedisUrl } from './queue/queue.config.js';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalRedisUrl = process.env.REDIS_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalRedisUrl === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = originalRedisUrl;
  }
});

describe('infrastructure configuration', () => {
  it('rejects a missing database URL', () => {
    delete process.env.DATABASE_URL;
    expect(() => readDatabaseUrl()).toThrowError('DATABASE_URL is required');
  });

  it('returns the configured database URL', () => {
    process.env.DATABASE_URL = 'mysql://example/database';
    expect(readDatabaseUrl()).toBe('mysql://example/database');
  });

  it('rejects a missing Redis URL', () => {
    delete process.env.REDIS_URL;
    expect(() => readRedisUrl()).toThrowError('REDIS_URL is required');
  });

  it('returns the configured Redis URL', () => {
    process.env.REDIS_URL = 'redis://example:6379';
    expect(readRedisUrl()).toBe('redis://example:6379');
  });
});
