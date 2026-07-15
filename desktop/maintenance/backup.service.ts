import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactResult } from '../../shared/desktop/contracts.js';

export class BackupService {
  constructor(private readonly options: {
    destinationRoot: string;
    vaultPath: string;
    version: string;
    readSettings(): Promise<unknown>;
    dumpDatabase(path: string): Promise<void>;
    now?: () => Date;
  }) {}

  async create(): Promise<ArtifactResult> {
    const now = this.options.now?.() ?? new Date();
    const createdAt = now.toISOString();
    const directory = join(this.options.destinationRoot, createdAt.replace(/[:.]/g, '-'));
    const temporaryDirectory = `${directory}.incomplete`;
    await rm(temporaryDirectory, { recursive: true, force: true });
    await mkdir(temporaryDirectory, { recursive: true });
    try {
      const settings = await this.options.readSettings();
      assertNonSensitive(settings);
      await this.options.dumpDatabase(join(temporaryDirectory, 'database.sql'));
      await writeFile(join(temporaryDirectory, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
      await copyFile(this.options.vaultPath, join(temporaryDirectory, 'secrets.dpapi.vault'));
      await writeFile(join(temporaryDirectory, 'manifest.json'), `${JSON.stringify({
        version: this.options.version, createdAt, database: 'mysql-consistent-dump',
        redisIncluded: false, secretsPortable: false,
      }, null, 2)}\n`, 'utf8');
      await writeFile(join(temporaryDirectory, 'RESTORE.txt'), [
        'Serenity 本机恢复清单', '', '1. 安装同版本 Serenity 和 Docker Desktop。',
        '2. 恢复 database.sql 与 settings.json。',
        '3. Redis 不是长期事实来源，不从备份恢复。',
        '4. 跨电脑或 Windows 用户恢复时，DPAPI 密文不可移植，必须重新输入 Secret。', '',
      ].join('\r\n'), 'utf8');
      await rename(temporaryDirectory, directory);
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
    return { path: directory, createdAt };
  }
}

function assertNonSensitive(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:secret|token|password|api.?key|webhook|credential|digest)/i.test(key)) throw new Error('备份中的非敏感配置包含禁止字段');
    assertNonSensitive(child);
  }
}
