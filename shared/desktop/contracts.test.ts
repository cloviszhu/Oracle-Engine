import { describe, expect, it } from 'vitest';
import { LAUNCHER_METHODS, secretConfiguredStateSchema } from './contracts.js';

describe('desktop launcher contracts', () => {
  it('exposes only the approved narrow operations', () => {
    expect(LAUNCHER_METHODS).toEqual([
      'getSetupStatus',
      'runEnvironmentChecks',
      'saveSettings',
      'probeAI',
      'startSerenity',
      'stopSerenity',
      'getHealth',
      'openWorkspace',
      'createBackup',
      'exportDiagnostics',
    ]);
    expect(LAUNCHER_METHODS).not.toContain('invoke');
    expect(LAUNCHER_METHODS).not.toContain('shell');
    expect(LAUNCHER_METHODS).not.toContain('readFile');
  });

  it('allows only configured state and redacted metadata for secrets', () => {
    expect(secretConfiguredStateSchema.parse({ configured: true, updatedAt: '2026-07-15T00:00:00Z' })).toEqual({
      configured: true,
      updatedAt: '2026-07-15T00:00:00Z',
    });
    expect(() => secretConfiguredStateSchema.parse({ configured: true, value: 'secret-canary' })).toThrow();
  });
});
