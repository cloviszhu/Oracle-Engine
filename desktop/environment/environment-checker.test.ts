import { describe, expect, it } from 'vitest';
import { runEnvironmentChecks } from './environment-checker.js';

describe('environment checker', () => {
  it('returns stable Chinese results and an official recovery action without installing software', async () => {
    const results = await runEnvironmentChecks({
      windows: async () => ({ supported: true, detail: 'Windows 11' }),
      dockerDesktop: async () => false,
      dockerEngine: async () => false,
      compose: async () => false,
      virtualization: async () => true,
      ports: async () => ({ available: true, detail: '可用' }),
      disk: async () => ({ availableBytes: 30 * 1024 ** 3 }),
      directory: async () => true,
    });
    expect(results.map((item) => item.code)).toEqual([
      'windows-version', 'docker-desktop', 'docker-engine', 'docker-compose',
      'virtualization', 'local-ports', 'disk-space', 'data-directory',
    ]);
    expect(results.find((item) => item.code === 'docker-desktop')).toMatchObject({ status: 'fail' });
    expect(JSON.stringify(results)).toContain('docker.com/products/docker-desktop');
    expect(results.every((item) => /[\u3400-\u9fff]/.test(`${item.message}${item.action}`))).toBe(true);
  });
});
