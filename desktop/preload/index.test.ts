import { describe, expect, it, vi } from 'vitest';
import { createLauncherBridge } from './index.js';

describe('preload bridge', () => {
  it('maps only approved operations to fixed IPC channels', async () => {
    const invoke = vi.fn().mockResolvedValue({ configured: false });
    const bridge = createLauncherBridge(invoke);

    expect(Object.keys(bridge).sort()).toEqual([
      'createBackup', 'exportDiagnostics', 'getHealth', 'getSetupStatus', 'openWorkspace',
      'probeAI', 'runEnvironmentChecks', 'saveSettings', 'startSerenity', 'stopSerenity',
    ].sort());
    await bridge.getSetupStatus();
    await bridge.saveSettings({ familyAccounts: [] });
    expect(invoke).toHaveBeenNthCalledWith(1, 'launcher:get-setup-status');
    expect(invoke).toHaveBeenNthCalledWith(2, 'launcher:save-settings', { familyAccounts: [] });
  });
});
