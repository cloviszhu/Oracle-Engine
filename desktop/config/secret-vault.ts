import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DataProtection {
  isAvailable(): boolean;
  encrypt(value: Buffer): Buffer;
  decrypt(value: Buffer): Buffer;
}

export interface SecretVaultOptions {
  directory: string;
  protection: DataProtection;
  restrictToCurrentUser(directory: string): Promise<void>;
  now?: () => Date;
}

type SecretMap = Record<string, string>;
type ConfiguredState = Record<string, { configured: boolean; updatedAt?: string }>;

export class SecretVault {
  private readonly now: () => Date;

  constructor(private readonly options: SecretVaultOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async save(secrets: SecretMap): Promise<void> {
    if (!this.options.protection.isAvailable()) {
      throw new Error('Windows 系统加密当前不可用，已阻止保存敏感信息');
    }
    assertSecretMap(secrets);
    await mkdir(this.options.directory, { recursive: true });
    try {
      await this.options.restrictToCurrentUser(this.options.directory);
    } catch {
      throw new Error('无法将配置目录权限限制为当前 Windows 用户，已阻止保存');
    }

    let encrypted: Buffer;
    try {
      encrypted = this.options.protection.encrypt(Buffer.from(JSON.stringify(secrets), 'utf8'));
    } catch {
      throw new Error('系统加密失败，已阻止保存敏感信息');
    }
    const updatedAt = this.now().toISOString();
    const state = Object.fromEntries(Object.keys(secrets).map((key) => [key, { configured: true, updatedAt }]));
    await atomicWrite(join(this.options.directory, 'secrets.vault'), encrypted);
    await atomicWrite(join(this.options.directory, 'secrets.meta.json'), Buffer.from(JSON.stringify(state), 'utf8'));
  }

  async load(): Promise<SecretMap> {
    if (!this.options.protection.isAvailable()) throw new Error('Windows 系统加密当前不可用');
    const encrypted = await readFile(join(this.options.directory, 'secrets.vault'));
    const parsed = JSON.parse(this.options.protection.decrypt(encrypted).toString('utf8')) as unknown;
    assertSecretMap(parsed);
    return parsed;
  }

  async getConfiguredState(): Promise<ConfiguredState> {
    try {
      return JSON.parse(await readFile(join(this.options.directory, 'secrets.meta.json'), 'utf8')) as ConfiguredState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw error;
    }
  }
}

async function atomicWrite(path: string, value: Buffer): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value, { mode: 0o600 });
  await rename(temporary, path);
}

function assertSecretMap(value: unknown): asserts value is SecretMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Secret 数据格式无效');
  for (const [key, secret] of Object.entries(value)) {
    if (!/^[a-z][A-Za-z0-9]{1,63}$/.test(key) || typeof secret !== 'string' || secret.length === 0) {
      throw new Error('Secret 数据格式无效');
    }
  }
}
