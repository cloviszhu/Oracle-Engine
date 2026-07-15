import { describe, expect, it, vi } from 'vitest';
import { parseRuntimeConfig } from '../../server/infrastructure/runtime-config.js';
import { UtilityProcessManager } from './utility-process-manager.js';

describe('UtilityProcessManager', () => {
  it('passes secrets only in a private message and keeps arguments and errors redacted', async () => {
    const postMessage = vi.fn();
    const kill = vi.fn();
    const fork = vi.fn(() => ({ postMessage, kill }));
    const manager = new UtilityProcessManager(fork, 'runtime-entry.js');
    const snapshot = parseRuntimeConfig({
      NODE_ENV: 'test', DATABASE_URL: 'mysql://root@localhost/db', REDIS_URL: 'redis://localhost:6379/1',
      FAMILY_ACCOUNTS_JSON: JSON.stringify([
        { actorId: 'father', username: 'father', passwordScrypt: 'scrypt$16384$8$1$salt$digest' },
        { actorId: 'requester', username: 'requester', passwordScrypt: 'scrypt$16384$8$1$salt$digest' },
      ]), SESSION_SECRET: 'private-runtime-canary-value-123', APP_BASE_URL: 'https://localhost',
      AI_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-5.6-terra',
    });
    await manager.start('api', snapshot);
    expect(fork).toHaveBeenCalledWith('runtime-entry.js', ['--role=api']);
    expect(JSON.stringify(fork.mock.calls)).not.toContain('private-runtime-canary');
    expect(postMessage).toHaveBeenCalledWith({ type: 'runtime-config', snapshot });
    await manager.stop('api');
    expect(kill).toHaveBeenCalledOnce();
  });
});
