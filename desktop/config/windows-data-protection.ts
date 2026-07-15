import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { safeStorage } from 'electron';
import type { DataProtection } from './secret-vault.js';

const execFileAsync = promisify(execFile);

export function serenityDataDirectory(localAppData = process.env.LOCALAPPDATA): string {
  if (!localAppData) throw new Error('无法定位当前 Windows 用户的本地配置目录');
  return `${localAppData}\\Serenity`;
}

export function createWindowsDataProtection(): DataProtection {
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value.toString('utf8')),
    decrypt: (value) => Buffer.from(safeStorage.decryptString(value), 'utf8'),
  };
}

export async function restrictDirectoryToCurrentUser(directory: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('DPAPI vault 仅支持 Windows');
  const username = process.env.USERNAME;
  if (!username) throw new Error('无法识别当前 Windows 用户');
  const principal = process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\${username}` : username;
  await execFileAsync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `${principal}:(OI)(CI)F`], {
    windowsHide: true,
    timeout: 10_000,
  });
}
