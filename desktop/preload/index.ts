import type { LauncherSettingsInput, SerenityLauncherApi } from '../../shared/desktop/contracts.js';

export type Invoke = (channel: string, payload?: unknown) => Promise<unknown>;

export function createLauncherBridge(invoke: Invoke): SerenityLauncherApi {
  return Object.freeze({
    getSetupStatus: () => invoke('launcher:get-setup-status') as ReturnType<SerenityLauncherApi['getSetupStatus']>,
    runEnvironmentChecks: () => invoke('launcher:run-environment-checks') as ReturnType<SerenityLauncherApi['runEnvironmentChecks']>,
    saveSettings: (settings: LauncherSettingsInput) => invoke('launcher:save-settings', settings) as ReturnType<SerenityLauncherApi['saveSettings']>,
    probeAI: (settings: LauncherSettingsInput['ai']) => invoke('launcher:probe-ai', settings) as ReturnType<SerenityLauncherApi['probeAI']>,
    startSerenity: () => invoke('launcher:start') as ReturnType<SerenityLauncherApi['startSerenity']>,
    stopSerenity: () => invoke('launcher:stop') as ReturnType<SerenityLauncherApi['stopSerenity']>,
    getHealth: () => invoke('launcher:get-health') as ReturnType<SerenityLauncherApi['getHealth']>,
    openWorkspace: () => invoke('launcher:open-workspace') as ReturnType<SerenityLauncherApi['openWorkspace']>,
    createBackup: () => invoke('launcher:create-backup') as ReturnType<SerenityLauncherApi['createBackup']>,
    exportDiagnostics: () => invoke('launcher:export-diagnostics') as ReturnType<SerenityLauncherApi['exportDiagnostics']>,
  });
}
