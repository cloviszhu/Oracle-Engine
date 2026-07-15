import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigStore } from './config-store.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('ConfigStore', () => {
  it('persists non-sensitive launcher metadata and rejects secret-shaped fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'serenity-config-'));
    roots.push(directory);
    const store = new ConfigStore(directory);
    await store.save({ version: 1, ai: { provider: 'openai', protocol: 'responses', model: 'gpt-5.6-terra' } });
    expect(await store.load()).toMatchObject({ version: 1, ai: { model: 'gpt-5.6-terra' } });
    expect(await readFile(join(directory, 'settings.json'), 'utf8')).not.toContain('apiKey');
    await expect(store.save({ version: 1, apiKey: 'canary' } as never)).rejects.toThrow(/敏感字段/);
  });
});
