import type { EnvironmentCheckResult } from '../../shared/desktop/contracts.js';

export interface EnvironmentProbes {
  windows(): Promise<{ supported: boolean; detail: string }>;
  dockerDesktop(): Promise<boolean>;
  dockerEngine(): Promise<boolean>;
  compose(): Promise<boolean>;
  virtualization(): Promise<boolean>;
  ports(): Promise<{ available: boolean; detail: string }>;
  disk(): Promise<{ availableBytes: number }>;
  directory(): Promise<boolean>;
}

export async function runEnvironmentChecks(probes: EnvironmentProbes): Promise<EnvironmentCheckResult[]> {
  const [windows, dockerDesktop, dockerEngine, compose, virtualization, ports, disk, directory] = await Promise.all([
    probes.windows(), probes.dockerDesktop(), probes.dockerEngine(), probes.compose(), probes.virtualization(),
    probes.ports(), probes.disk(), probes.directory(),
  ]);
  const result = (
    code: string, label: string, passed: boolean, ok: string, failed: string,
    action?: EnvironmentCheckResult['action'], warning = false,
  ): EnvironmentCheckResult => ({
    code, label, status: passed ? (warning ? 'warning' : 'pass') : 'fail', message: passed ? ok : failed,
    ...(passed || !action ? {} : { action }),
  });
  return [
    result('windows-version', 'Windows 版本', windows.supported, `系统版本受支持：${windows.detail}`, `系统版本不受支持：${windows.detail}`, { label: '查看 Windows 更新' }),
    result('docker-desktop', 'Docker Desktop', dockerDesktop, '已检测到 Docker Desktop', '未检测到 Docker Desktop，请先完成安装后复查', { label: '打开 Docker Desktop 官方下载页', url: 'https://www.docker.com/products/docker-desktop/' }),
    result('docker-engine', 'Docker 引擎', dockerEngine, 'Docker 引擎正在运行', 'Docker 引擎未运行，请启动 Docker Desktop 后复查', { label: '启动 Docker Desktop 后复查' }),
    result('docker-compose', 'Docker Compose', compose, 'Docker Compose 可用', 'Docker Compose 不可用，请更新 Docker Desktop 后复查', { label: '更新 Docker Desktop 后复查' }),
    result('virtualization', '硬件虚拟化', virtualization, '硬件虚拟化可用', '硬件虚拟化未启用，请在 BIOS 和 Windows 功能中启用', { label: '启用虚拟化后复查' }),
    result('local-ports', '本机端口', ports.available, `本机端口检查通过：${ports.detail}`, `本机端口不可用：${ports.detail}`, { label: '关闭占用程序或更换端口' }),
    result('disk-space', '磁盘空间', disk.availableBytes >= 10 * 1024 ** 3, `可用空间充足（${Math.floor(disk.availableBytes / 1024 ** 3)} GB）`, '可用空间少于 10 GB，请清理磁盘后复查', { label: '清理磁盘后复查' }),
    result('data-directory', '数据目录权限', directory, '本地数据目录可读写', '本地数据目录不可写，请检查当前用户权限', { label: '修复目录权限后复查' }),
  ];
}
