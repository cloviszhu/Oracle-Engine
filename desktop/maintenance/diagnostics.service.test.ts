import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticsService } from './diagnostics.service.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('DiagnosticsService', () => {
  it('rejects the export before writing when raw collected data contains a secret canary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'serenity-diag-test-')); roots.push(root);
    const canary = 'diagnostics-secret-canary-value';
    const service = new DiagnosticsService({
      destinationRoot: root, version: '0.1.0', now: () => new Date('2026-07-15T12:00:00.000Z'),
      collect: async () => ({ health: { overall: 'degraded' }, ports: [3000], containers: ['serenity-local-db-1'], apiKey: canary, logs: [`Authorization: Bearer ${canary}`, 'safe event'], providerBody: { raw: canary }, stack: 'private stack' }),
      canaries: [canary],
    });
    await expect(service.export()).rejects.toThrow(/canary/);
    expect(await import('node:fs/promises').then(({ readdir }) => readdir(root))).toEqual([]);
  });

  it('exports health and redacts ordinary authorization text, provider bodies, and stacks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'serenity-diag-test-')); roots.push(root);
    const service = new DiagnosticsService({
      destinationRoot: root, version: '0.1.0', now: () => new Date('2026-07-15T12:00:00.000Z'),
      collect: async () => ({ health: { overall: 'degraded' }, logs: ['Authorization: Bearer ordinary-value', 'safe event'], providerBody: { raw: 'private' }, stack: 'private stack' }),
    });
    const result = await service.export();
    const content = await readFile(result.path, 'utf8');
    expect(content).toContain('safe event');
    expect(content).toContain('Bearer [REDACTED]');
    expect(content).not.toContain('private stack');
    expect(content).not.toContain('providerBody');
  });
});
