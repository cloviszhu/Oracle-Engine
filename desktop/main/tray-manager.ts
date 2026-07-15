export type LauncherExitReason = 'window-close' | 'stop-and-quit';

export function shouldStopServices(reason: LauncherExitReason): boolean {
  return reason === 'stop-and-quit';
}
