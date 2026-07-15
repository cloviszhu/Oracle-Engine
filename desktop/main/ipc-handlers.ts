import type { IpcMain } from 'electron';
import type { AISettingsInput, LauncherSettingsInput, SerenityLauncherApi } from '../../shared/desktop/contracts.js';

export type LauncherHandlerServices = SerenityLauncherApi;

export function registerLauncherHandlers(ipc: Pick<IpcMain, 'handle'>, services: LauncherHandlerServices): void {
  ipc.handle('launcher:get-setup-status', () => safe('读取设置状态', services.getSetupStatus));
  ipc.handle('launcher:run-environment-checks', () => safe('环境检查', services.runEnvironmentChecks));
  ipc.handle('launcher:save-settings', (_event, payload: LauncherSettingsInput) => safe('保存设置', () => services.saveSettings(payload)));
  ipc.handle('launcher:probe-ai', (_event, payload: AISettingsInput) => safe('AI 能力验证', () => services.probeAI(payload)));
  ipc.handle('launcher:start', () => safe('启动服务', services.startSerenity));
  ipc.handle('launcher:stop', () => safe('停止服务', services.stopSerenity));
  ipc.handle('launcher:get-health', () => safe('健康检查', services.getHealth));
  ipc.handle('launcher:open-workspace', () => safe('打开私有网页', services.openWorkspace));
  ipc.handle('launcher:create-backup', () => safe('创建备份', services.createBackup));
  ipc.handle('launcher:export-diagnostics', () => safe('导出诊断', services.exportDiagnostics));
}

async function safe<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch { throw new Error(`${operation}失败；敏感详情已隐藏，请导出诊断后重试`); }
}
