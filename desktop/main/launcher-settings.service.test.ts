import { describe, expect, it, vi } from 'vitest';
import { LauncherSettingsService } from './launcher-settings.service.js';
import type { LauncherMetadata } from '../config/config-store.js';
import type { LauncherSettingsInput } from '../../shared/desktop/contracts.js';

describe('LauncherSettingsService', () => {
  it('saves encrypted internal values while returning configured states only', async () => {
    let secrets: Record<string, string> = {};
    let metadata: unknown;
    const service = new LauncherSettingsService({
      vault: { save: async (value) => { secrets = value; }, load: async () => secrets, getConfiguredState: async () => Object.fromEntries(Object.keys(secrets).map((key) => [key, { configured: true }])) },
      store: { save: async (value) => { metadata = value; }, load: async () => metadata as never },
      probeAI: vi.fn(), testX: vi.fn(), testFeishu: vi.fn(), revokeActorSessions: vi.fn(),
    });
    const status = await service.save({
      familyAccounts: [
        { actorId: 'father', username: 'father', password: 'father-password-123' },
        { actorId: 'requester', username: 'requester', password: 'requester-password-123' },
      ], x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false },
    });
    expect(status).toMatchObject({ configured: true, accountsConfigured: true, x: { enabled: false }, feishu: { enabled: false } });
    expect(JSON.stringify(status)).not.toContain('password');
    expect(secrets.familyAccountsJson).toContain('passwordScrypt');
  });

  it('persists probe evidence and rejects a changed AI configuration before runtime startup', async () => {
    let secrets: Record<string, string> = {};
    let metadata: LauncherMetadata | undefined;
    const probeAI = vi.fn().mockResolvedValue({ compatible: true, requestedModel: 'family-model', actualModel: 'family-model', providerRequestId: 'req-1', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, probeVersion: '1' });
    const service = new LauncherSettingsService({
      vault: { save: async (value) => { secrets = value; }, load: async () => secrets, getConfiguredState: async () => ({ aiApiKey: { configured: true } }) },
      store: { save: async (value) => { metadata = value; }, load: async () => metadata },
      probeAI,
      testX: vi.fn(), testFeishu: vi.fn(), revokeActorSessions: vi.fn(),
    });
    await service.save({
      familyAccounts: [{ actorId: 'father', username: 'father', password: 'father-password-123' }, { actorId: 'requester', username: 'requester', password: 'requester-password-123' }],
      ai: { enabled: true, providerPreset: 'custom', protocol: 'chat_completions', baseUrl: 'https://models.example.test/', apiKey: 'test-key', model: 'family-model', reasoning: 'medium', inputCostPerMillionCents: 1, outputCostPerMillionCents: 2, maxRequestCostCents: 3, dailyBudgetCents: 4 },
      x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false },
    });
    expect(metadata?.ai).toMatchObject({ baseUrl: 'https://models.example.test', probe: { actualModel: 'family-model', providerRequestId: 'req-1', probeVersion: '1' } });
    await expect(service.getRuntimeSnapshot()).resolves.toMatchObject({ ai: { model: 'family-model' } });
    await expect(service.getRuntimeSnapshot({ api: 3000, mysql: 33061, redis: 36381 })).resolves.toMatchObject({
      databaseUrl: 'mysql://root@127.0.0.1:33061/serenity',
      redisUrl: 'redis://127.0.0.1:36381/0',
      appBaseUrl: 'http://127.0.0.1:3000',
    });
    probeAI.mockClear();
    await expect(service.save({
      familyAccounts: [{ actorId: 'father', username: 'father', password: '' }, { actorId: 'requester', username: 'requester', password: '' }],
      ai: { enabled: true, providerPreset: 'custom', protocol: 'chat_completions', baseUrl: 'https://attacker.example', apiKey: '', model: 'family-model', reasoning: 'medium', inputCostPerMillionCents: 1, outputCostPerMillionCents: 2, maxRequestCostCents: 3, dailyBudgetCents: 4 },
      x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false },
    })).rejects.toThrow(/重新输入 API Key/);
    expect(probeAI).not.toHaveBeenCalled();
    if (!metadata?.ai) throw new Error('expected AI metadata');
    metadata.ai.model = 'changed-without-probe';
    await expect(service.getRuntimeSnapshot()).rejects.toThrow(/重新通过能力验证/);
  });

  it('rotates the signing secret on password change even if Redis cleanup is unavailable', async () => {
    let secrets: Record<string, string> = {};
    let metadata: LauncherMetadata | undefined;
    const service = new LauncherSettingsService({
      vault: { save: async (value) => { secrets = value; }, load: async () => secrets, getConfiguredState: async () => ({}) },
      store: { save: async (value) => { metadata = value; }, load: async () => metadata },
      probeAI: vi.fn(), testX: vi.fn(), testFeishu: vi.fn(), revokeActorSessions: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    });
    const base = { familyAccounts: [{ actorId: 'father', username: 'father', password: 'father-password-123' }, { actorId: 'requester', username: 'requester', password: 'requester-password-123' }], x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false } };
    await service.save(base);
    const firstSecret = secrets.sessionSecret;
    await service.save({ ...base, familyAccounts: [{ actorId: 'father', username: 'father', password: 'changed-password-456' }, { actorId: 'requester', username: 'requester', password: '' }] });
    expect(secrets.sessionSecret).not.toBe(firstSecret);
  });

  it('rejects silent probe downgrade but saves an explicitly disabled configuration outside the worker snapshot', async () => {
    let secrets: Record<string, string> = {};
    let metadata: LauncherMetadata | undefined;
    const service = new LauncherSettingsService({
      vault: { save: async (value) => { secrets = value; }, load: async () => secrets, getConfiguredState: async () => ({ aiApiKey: { configured: true } }) },
      store: { save: async (value) => { metadata = value; }, load: async () => metadata },
      probeAI: vi.fn().mockResolvedValue({ compatible: false, requestedModel: 'incompatible-model', category: 'capability', probeVersion: '1' }),
      testX: vi.fn(), testFeishu: vi.fn(), revokeActorSessions: vi.fn(),
    });
    const input: LauncherSettingsInput = {
      familyAccounts: [{ actorId: 'father', username: 'father', password: 'father-password-123' }, { actorId: 'requester', username: 'requester', password: 'requester-password-123' }],
      ai: { enabled: true, providerPreset: 'custom', protocol: 'responses', baseUrl: 'https://models.example.test', apiKey: 'stored-key', model: 'incompatible-model', reasoning: 'medium', inputCostPerMillionCents: 1, outputCostPerMillionCents: 2, maxRequestCostCents: 3, dailyBudgetCents: 4 },
      x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false },
    };
    await expect(service.save(input)).rejects.toThrow(/能力验证未通过/);
    const status = await service.save({ ...input, ai: { ...input.ai!, enabled: false } });
    expect(status.ai).toMatchObject({ enabled: false, configured: true });
    expect(metadata?.ai).toMatchObject({ enabled: false, model: 'incompatible-model' });
    expect((await service.getRuntimeSnapshot()).ai.apiKey).toBeUndefined();
  });
});
