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
    await store.save({ version: 1, ai: {
      enabled: true, providerPreset: 'openai', provider: 'openai', protocol: 'responses', model: 'gpt-5.6-terra',
      reasoningEffort: 'medium', inputCostPerMillionCents: 0, outputCostPerMillionCents: 0,
      maxRequestCostCents: 0, dailyBudgetCents: 0,
      probe: { fingerprint: 'abc', actualModel: 'gpt-5.6-terra', providerRequestId: 'req-1', passedAt: '2026-07-15T00:00:00.000Z', probeVersion: '1' },
    } });
    expect(await store.load()).toMatchObject({ version: 1, ai: { model: 'gpt-5.6-terra' } });
    expect(await readFile(join(directory, 'settings.json'), 'utf8')).not.toContain('apiKey');
    await expect(store.save({ version: 1, apiKey: 'canary' } as never)).rejects.toThrow(/敏感字段/);
  });
});
