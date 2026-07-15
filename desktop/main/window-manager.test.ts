import { describe, expect, it } from 'vitest';
import { secureWebPreferences } from './window-manager.js';
import { shouldStopServices } from './tray-manager.js';

describe('desktop window security', () => {
  it('enables isolation and sandbox while disabling Node integration', () => {
    expect(secureWebPreferences('C:/Serenity/preload.js')).toMatchObject({
      preload: 'C:/Serenity/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });

  it('keeps services running on window close and stops only on explicit quit', () => {
    expect(shouldStopServices('window-close')).toBe(false);
    expect(shouldStopServices('stop-and-quit')).toBe(true);
  });
});
