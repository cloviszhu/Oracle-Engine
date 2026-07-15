import { describe, expect, it, vi } from 'vitest';
import { LauncherSettingsService } from './launcher-settings.service.js';

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
});
