import { execFile } from 'node:child_process';
import { access, constants, mkdir, statfs, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { EnvironmentProbes } from './environment-checker.js';

const execFileAsync = promisify(execFile);

export function createSystemEnvironmentProbes(directory: string, portsToCheck: number[]): EnvironmentProbes {
  return {
    windows: async () => {
      const [major] = process.getSystemVersion().split('.').map(Number);
      return { supported: process.platform === 'win32' && (major ?? 0) >= 10, detail: process.getSystemVersion() };
    },
    dockerDesktop: async () => commandExists(join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Docker', 'Docker', 'Docker Desktop.exe')),
    dockerEngine: async () => commandSucceeds('docker.exe', ['info', '--format', '{{.ServerVersion}}']),
    compose: async () => commandSucceeds('docker.exe', ['compose', 'version', '--short']),
    virtualization: async () => commandOutputIncludes('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled -contains $true'], 'True'),
    ports: async () => {
      const unavailable: number[] = [];
      for (const port of portsToCheck) if (!(await portAvailable(port))) unavailable.push(port);
      return { available: unavailable.length === 0, detail: unavailable.length === 0 ? '所需端口均可用' : `端口 ${unavailable.join('、')} 已被占用` };
    },
    disk: async () => {
      await mkdir(directory, { recursive: true });
      const stats = await statfs(directory);
      return { availableBytes: stats.bavail * stats.bsize };
    },
    directory: async () => {
      try {
        await mkdir(directory, { recursive: true });
        const canary = join(directory, `.permission-${process.pid}`);
        await writeFile(canary, 'ok', { mode: 0o600 });
        await unlink(canary);
        return true;
      } catch { return false; }
    },
  };
}

async function commandExists(path: string): Promise<boolean> {
  try { await access(path, constants.X_OK); return true; } catch { return false; }
}

async function commandSucceeds(command: string, args: string[]): Promise<boolean> {
  try { await execFileAsync(command, args, { windowsHide: true, timeout: 10_000 }); return true; } catch { return false; }
}

async function commandOutputIncludes(command: string, args: string[], expected: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(command, args, { windowsHide: true, timeout: 10_000 });
    return stdout.includes(expected);
  } catch { return false; }
}

function portAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}
