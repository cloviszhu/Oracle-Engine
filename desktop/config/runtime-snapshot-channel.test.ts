import { describe, expect, it, vi } from 'vitest';
import { parseRuntimeConfig } from '../../server/infrastructure/runtime-config.js';
import { RuntimeSnapshotChannel } from './runtime-snapshot-channel.js';

describe('RuntimeSnapshotChannel', () => {
  it('sends one validated snapshot over a private port and never uses command-line arguments', () => {
    const postMessage = vi.fn();
    const channel = new RuntimeSnapshotChannel({ postMessage });
    const snapshot = parseRuntimeConfig({
      NODE_ENV: 'test', DATABASE_URL: 'mysql://user:pass@localhost/db', REDIS_URL: 'redis://localhost:6379/1',
      FAMILY_ACCOUNTS_JSON: JSON.stringify([
        { actorId: 'father', username: 'father', passwordScrypt: 'scrypt$16384$8$1$salt$digest' },
        { actorId: 'requester', username: 'requester', passwordScrypt: 'scrypt$16384$8$1$salt$digest' },
      ]),
      SESSION_SECRET: 's'.repeat(32), APP_BASE_URL: 'https://localhost', AI_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-5.6-terra',
    });

    channel.deliver(snapshot);
    expect(() => channel.deliver(snapshot)).toThrow(/一次/);
    expect(postMessage).toHaveBeenCalledWith({ type: 'runtime-config', snapshot });
    expect(process.argv.join(' ')).not.toContain('s'.repeat(32));
  });
});
