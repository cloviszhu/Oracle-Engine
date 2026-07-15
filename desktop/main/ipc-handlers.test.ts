import { describe, expect, it, vi } from 'vitest';
import { registerLauncherHandlers } from './ipc-handlers.js';

describe('launcher IPC handlers', () => {
  it('registers exactly the narrow public contract', () => {
    const channels: string[] = [];
    registerLauncherHandlers({ handle: (channel: string) => { channels.push(channel); } } as never, {
      getSetupStatus: vi.fn(), runEnvironmentChecks: vi.fn(), saveSettings: vi.fn(), probeAI: vi.fn(),
      startSerenity: vi.fn(), stopSerenity: vi.fn(), getHealth: vi.fn(), openWorkspace: vi.fn(),
      createBackup: vi.fn(), exportDiagnostics: vi.fn(),
    });
    expect(channels).toEqual([
      'launcher:get-setup-status', 'launcher:run-environment-checks', 'launcher:save-settings', 'launcher:probe-ai',
      'launcher:start', 'launcher:stop', 'launcher:get-health', 'launcher:open-workspace',
      'launcher:create-backup', 'launcher:export-diagnostics',
    ]);
  });

  it('rejects malformed renderer payloads before calling a service', async () => {
    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const saveSettings = vi.fn();
    registerLauncherHandlers({ handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => { handlers.set(channel, handler); } } as never, {
      getSetupStatus: vi.fn(), runEnvironmentChecks: vi.fn(), saveSettings, probeAI: vi.fn(),
      startSerenity: vi.fn(), stopSerenity: vi.fn(), getHealth: vi.fn(), openWorkspace: vi.fn(), createBackup: vi.fn(), exportDiagnostics: vi.fn(),
    });
    await expect(handlers.get('launcher:save-settings')?.({}, { familyAccounts: [], command: 'shell' })).rejects.toThrow(/敏感详情已隐藏/);
    expect(saveSettings).not.toHaveBeenCalled();
  });
});
