import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('desktop compose layout', () => {
  it('contains only loopback MySQL and Redis under the fixed project name', async () => {
    const compose = await readFile('docker-compose.yml', 'utf8');
    expect(compose).toContain('name: serenity-local');
    expect(compose).toContain('127.0.0.1:${SERENITY_MYSQL_PORT:-33060}:3306');
    expect(compose).toContain('127.0.0.1:${SERENITY_REDIS_PORT:-36379}:6379');
    expect(compose).not.toMatch(/^\s{2}(api|worker):/m);
    expect(compose).not.toContain('SESSION_SECRET');
  });
});
