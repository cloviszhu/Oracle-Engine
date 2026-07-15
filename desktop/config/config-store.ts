import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface LauncherMetadata {
  version: 1;
  ai?: { provider: string; protocol: 'responses' | 'chat-completions'; model: string; baseUrl?: string };
  x?: { enabled: boolean; sourceId?: string };
  feishu?: { enabled: boolean };
  updatedAt?: string;
}

const forbiddenField = /(?:secret|token|password|passphrase|api.?key|webhook|credential|digest)/i;

export class ConfigStore {
  constructor(private readonly directory: string) {}

  async save(metadata: LauncherMetadata): Promise<void> {
    assertNoSensitiveFields(metadata);
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, 'settings.json');
    const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, path);
  }

  async load(): Promise<LauncherMetadata | undefined> {
    try {
      return JSON.parse(await readFile(join(this.directory, 'settings.json'), 'utf8')) as LauncherMetadata;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }
}

function assertNoSensitiveFields(value: unknown, path = 'settings'): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenField.test(key)) throw new Error(`配置包含敏感字段：${path}.${key}`);
    assertNoSensitiveFields(child, `${path}.${key}`);
  }
}
