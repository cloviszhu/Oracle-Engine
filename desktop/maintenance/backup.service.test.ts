import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackupService } from './backup.service.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('BackupService', () => {
  it('exports a consistent database, non-sensitive settings, version and DPAPI ciphertext without Redis', async () => {
    const root = await mkdtemp(join(tmpdir(), 'serenity-backup-test-')); roots.push(root);
    const vaultPath = join(root, 'secrets.vault'); await writeFile(vaultPath, Buffer.from([1, 2, 3]));
    const service = new BackupService({
      destinationRoot: join(root, 'backups'), vaultPath, version: '0.1.0',
      readSettings: async () => ({ version: 1, x: { enabled: false } }),
      dumpDatabase: async (path) => writeFile(path, '-- consistent mysql dump'),
      now: () => new Date('2026-07-15T12:00:00.000Z'),
    });
    const result = await service.create();
    const manifest = JSON.parse(await readFile(join(result.path, 'manifest.json'), 'utf8')) as Record<string, unknown>;
    expect(manifest).toMatchObject({ version: '0.1.0', redisIncluded: false, secretsPortable: false });
    expect(await readFile(join(result.path, 'database.sql'), 'utf8')).toContain('consistent');
    expect(await readFile(join(result.path, 'RESTORE.txt'), 'utf8')).toContain('重新输入 Secret');
  });

  it('removes an incomplete backup when the database stream fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'serenity-backup-test-')); roots.push(root);
    const vaultPath = join(root, 'secrets.vault'); await writeFile(vaultPath, 'ciphertext');
    const destinationRoot = join(root, 'backups');
    const service = new BackupService({
      destinationRoot, vaultPath, version: '0.1.0', readSettings: async () => ({ version: 1 }),
      dumpDatabase: async (path) => { await writeFile(path, 'partial'); throw new Error('dump failed'); },
      now: () => new Date('2026-07-15T12:00:00.000Z'),
    });
    await expect(service.create()).rejects.toThrow(/dump failed/);
    expect(await import('node:fs/promises').then(({ readdir }) => readdir(destinationRoot))).toEqual([]);
  });
});
