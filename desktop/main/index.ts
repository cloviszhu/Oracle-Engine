import { execFile, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, session, shell, Tray, utilityProcess, type UtilityProcess } from 'electron';
import { RedisSessionStore } from '../../server/auth/redis-auth.store.js';
import { ProviderAdapterRegistry } from '../../server/infrastructure/ai/provider-adapter.registry.js';
import { runCapabilityProbe } from '../../server/infrastructure/ai/capability-probe.js';
import { FeishuNotificationAdapter } from '../../server/infrastructure/notifications/feishu.adapter.js';
import { createRedisConnection } from '../../server/infrastructure/queue/client.js';
import { XApiClient } from '../../server/infrastructure/x/x-api.client.js';
import type { RuntimeConfigSnapshot } from '../../server/infrastructure/runtime-config.js';
import type { AISettingsInput, ServiceHealthSummary } from '../../shared/desktop/contracts.js';
import { ConfigStore } from '../config/config-store.js';
import { resolveBoundAIKey } from '../config/ai-auth-binding.js';
import { SecretVault } from '../config/secret-vault.js';
import { createWindowsDataProtection, restrictDirectoryToCurrentUser, serenityDataDirectory } from '../config/windows-data-protection.js';
import { runEnvironmentChecks } from '../environment/environment-checker.js';
import { createSystemEnvironmentProbes } from '../environment/system-probes.js';
import { BackupService } from '../maintenance/backup.service.js';
import { DiagnosticsService } from '../maintenance/diagnostics.service.js';
import { SerenityComposeController } from '../runtime/compose-controller.js';
import {
  createLocalServicePortSelection,
  localServicePortEnvironment,
  type LocalServicePorts,
} from '../runtime/local-ports.js';
import { ServiceOrchestrator } from '../runtime/service-orchestrator.js';
import { UtilityProcessSupervisor, type SupervisedProcess } from '../runtime/utility-process-supervisor.js';
import { registerLauncherHandlers } from './ipc-handlers.js';
import { LauncherSettingsService } from './launcher-settings.service.js';
import { launcherContentSecurityPolicy, secureWebPreferences } from './window-manager.js';

const execFileAsync = promisify(execFile);
let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let explicitQuit = false;
let stopForQuit: () => Promise<ServiceHealthSummary> = async () => stoppedHealth();
let health: ServiceHealthSummary = stoppedHealth();

function createWindow() {
  window = new BrowserWindow({
    width: 1080, height: 720, minWidth: 760, minHeight: 560, backgroundColor: '#0b1715', show: false,
    webPreferences: secureWebPreferences(join(__dirname, '../preload/bootstrap.mjs')),
  });
  window.once('ready-to-show', () => window?.show());
  window.on('close', (event) => { if (!explicitQuit) { event.preventDefault(); window?.hide(); } });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(__dirname, '../renderer/index.html'));
}

async function registerServices() {
  const dataDirectory = serenityDataDirectory();
  const store = new ConfigStore(dataDirectory);
  const vault = new SecretVault({ directory: dataDirectory, protection: createWindowsDataProtection(), restrictToCurrentUser: restrictDirectoryToCurrentUser });
  const runtimeRoot = app.isPackaged ? process.resourcesPath : process.cwd();
  const composeFile = join(runtimeRoot, 'docker-compose.yml');
  const dockerExecutable = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe');
  const portSelection = createLocalServicePortSelection();
  const ensurePorts = () => portSelection.require();
  const runCompose = async (_command: string, args: string[]) => {
    const ports = await ensurePorts();
    return execFileAsync(dockerExecutable, args, {
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8',
      env: { ...process.env, ...localServicePortEnvironment(ports) },
    });
  };
  const compose = new SerenityComposeController(runCompose, composeFile);
  const supervisor = new UtilityProcessSupervisor((child) => stopUtilityProcess(child as UtilityProcess));
  const probeAI = async (settings: AISettingsInput) => {
    const [saved, loadedSecrets] = await Promise.all([store.load(), vault.load().catch(() => undefined)]);
    const secrets: Record<string, string> = loadedSecrets ?? {};
    const apiKey = resolveBoundAIKey(settings, saved?.ai, secrets.aiApiKey);
    if (!apiKey) return { compatible: false, requestedModel: settings.model, category: 'not_configured', probeVersion: '1' };
    try {
      const { adapter } = new ProviderAdapterRegistry().resolve({
        preset: settings.providerPreset, provider: settings.providerPreset === 'openai' ? 'openai' : 'custom',
        protocol: settings.protocol, baseUrl: settings.baseUrl || undefined, apiKey, model: settings.model,
        reasoningEffort: settings.reasoning, inputCostPerMillionCents: settings.inputCostPerMillionCents,
        outputCostPerMillionCents: settings.outputCostPerMillionCents, pricingVersion: 'user-config-v1', probeVersion: '1',
      });
      return { ...(await runCapabilityProbe(adapter, settings.model)), requestedModel: settings.model };
    } catch {
      return { compatible: false, requestedModel: settings.model, category: 'configuration', probeVersion: '1' };
    }
  };
  const settingsService = new LauncherSettingsService({
    vault, store, probeAI,
    testX: async (token) => Boolean(await new XApiClient({ bearerToken: token }).resolveAccount('aleabitoreddit')),
    testFeishu: async (webhookUrl, signingSecret) => {
      await new FeishuNotificationAdapter({ webhookUrl, signingSecret, appBaseUrl: 'https://127.0.0.1' }).send({
        contentId: 'configuration-test', cardId: 'configuration-test', title: 'Serenity 配置测试', faithfulTranslation: '签名提醒连接测试。',
        serenityJudgment: '仅用于验证当前配置。', uncertainties: [], importanceReason: '配置测试', sourceUrl: 'https://x.com/aleabitoreddit',
      });
      return true;
    },
    revokeActorSessions: async (actorId) => {
      const ports = await ensurePorts();
      const redis = createRedisConnection(`redis://127.0.0.1:${ports.redis}/0`);
      try {
        await Promise.race([
          new RedisSessionStore(redis).deleteActor(actorId),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis session revocation timeout')), 5_000)),
        ]);
      } catch {
        // A stopped local Redis cannot retain an active API session; disconnecting is the safe equivalent.
      } finally {
        redis.disconnect();
      }
    },
  });
  const backup = new BackupService({
    destinationRoot: join(dataDirectory, 'backups'), vaultPath: join(dataDirectory, 'secrets.vault'), version: app.getVersion(),
    readSettings: () => store.load(),
    dumpDatabase: async (path) => streamDatabaseDump(dockerExecutable, composeFile, path, await ensurePorts()),
  });
  const diagnostics = async () => {
    const secrets = await vault.load().catch(() => ({}));
    return new DiagnosticsService({
      destinationRoot: join(dataDirectory, 'diagnostics'), version: app.getVersion(), canaries: Object.values(secrets),
      collect: async () => {
        let ports = portSelection.current();
        let portSelectionError: string | undefined;
        if (!ports) {
          try { ports = await ensurePorts(); } catch (error) { portSelectionError = errorDetail(error); }
        }
        const containers = ports
          ? await runCompose(dockerExecutable, ['compose', '-p', 'serenity-local', '-f', composeFile, 'ps', '--format', 'json']).then(({ stdout }) => stdout).catch(() => 'Docker 不可用')
          : '端口选择失败，未执行 Docker 状态查询';
        return {
          health,
          ports: ports ? [ports.api, ports.mysql, ports.redis] : [],
          ...(portSelectionError ? { portSelectionError } : {}),
          containers,
          logs: ['诊断由 Electron main 脱敏导出'],
        };
      },
    }).export();
  };

  let runtimeSnapshot: RuntimeConfigSnapshot | undefined;
  const orchestrator = new ServiceOrchestrator({
    prepareDirectories: async () => undefined,
    reservePorts: async () => {
      const ports = await portSelection.refresh();
      runtimeSnapshot = await settingsService.getRuntimeSnapshot(ports);
    },
    startInfrastructure: async () => { health = startingHealth(); await compose.startInfrastructure(); },
    waitForInfrastructure: () => waitForInfrastructure(runCompose, composeFile),
    migrate: async () => { health = stageHealth('migration'); await runUtilityRole('migration', runtimeSnapshot!, runtimeRoot); },
    startApi: async () => { health = stageHealth('api'); supervisor.track('api', await runUtilityRole('api', runtimeSnapshot!, runtimeRoot), handleUnexpectedExit); },
    waitForApi: async () => undefined,
    startWorker: async () => { health = stageHealth('worker'); supervisor.track('worker', await runUtilityRole('worker', runtimeSnapshot!, runtimeRoot), handleUnexpectedExit); },
    waitForWorker: async () => undefined,
    openWorkspace: async () => { await shell.openExternal(`http://127.0.0.1:${(await ensurePorts()).api}`); },
    stopAcceptingWork: async () => undefined,
    stopWorker: () => supervisor.stop('worker'),
    stopApi: () => supervisor.stop('api'),
    stopInfrastructure: async () => { await compose.stopInfrastructure(); },
  });
  const stopSerenity = async () => {
    try {
      await orchestrator.stop();
      health = stoppedHealth();
      portSelection.clear();
      runtimeSnapshot = undefined;
      return health;
    } catch (error) {
      health = { overall: 'failed', services: health.services.map((service) => ({ ...service, status: 'stop_failed', message: '停止不完整，请重试或导出诊断' })) };
      throw error;
    }
  };
  const handleUnexpectedExit = (role: 'api' | 'worker') => {
    if (orchestrator.getState() !== 'running') return;
    markUnexpectedExit(role);
    void stopSerenity().catch(() => undefined);
  };
  stopForQuit = stopSerenity;

  registerLauncherHandlers(ipcMain, {
    getSetupStatus: () => settingsService.getStatus(),
    runEnvironmentChecks: async () => {
      try {
        const ports = orchestrator.getState() === 'stopped' ? await portSelection.refresh() : await ensurePorts();
        return runEnvironmentChecks(createSystemEnvironmentProbes(dataDirectory, [ports.api, ports.mysql, ports.redis], dockerExecutable));
      } catch (error) {
        const probes = createSystemEnvironmentProbes(dataDirectory, [], dockerExecutable);
        probes.ports = async () => ({ available: false, detail: errorDetail(error) });
        return runEnvironmentChecks(probes);
      }
    },
    saveSettings: async (settings) => {
      await stopSerenity();
      return settingsService.save(settings);
    }, probeAI,
    startSerenity: async () => {
      try {
        await orchestrator.start();
        const ports = await ensurePorts();
        health = { overall: 'healthy', workspaceUrl: `http://127.0.0.1:${ports.api}`, services: serviceNames.map((name) => ({ name, status: 'healthy' })) };
        return health;
      } catch (error) {
        health = { overall: 'failed', services: serviceNames.map((name) => ({ name, status: 'failed', message: '启动失败，请导出诊断后重试' })) };
        if (orchestrator.getState() === 'stopped') {
          portSelection.clear();
          runtimeSnapshot = undefined;
        }
        throw error;
      }
    },
    stopSerenity,
    getHealth: async () => orchestrator.getState() === 'running'
      ? refreshHealth(orchestrator.getState(), runCompose, composeFile, supervisor, await ensurePorts())
      : health,
    openWorkspace: async () => health.workspaceUrl ? { opened: (await shell.openExternal(health.workspaceUrl)) === undefined, url: health.workspaceUrl } : { opened: false },
    createBackup: () => backup.create(), exportDiagnostics: diagnostics,
  });
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runUtilityRole(role: 'migration', snapshot: RuntimeConfigSnapshot, runtimeRoot: string): Promise<undefined>;
async function runUtilityRole(role: 'api' | 'worker', snapshot: RuntimeConfigSnapshot, runtimeRoot: string): Promise<UtilityProcess>;
async function runUtilityRole(role: 'migration' | 'api' | 'worker', snapshot: RuntimeConfigSnapshot, runtimeRoot: string): Promise<UtilityProcess | undefined> {
  const child = utilityProcess.fork(join(__dirname, 'runtime-entry.js'), [`--role=${role}`, `--runtime-root=${runtimeRoot}`], { cwd: runtimeRoot, serviceName: `Serenity ${role}` });
  const completed = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`${role} startup timeout`)); }, 60_000);
    child.once('exit', (code) => {
      if (role === 'migration' && code === 0) { clearTimeout(timeout); resolve(); }
      else if (role === 'migration' || code !== 0) { clearTimeout(timeout); reject(new Error(`${role} exited before ready`)); }
    });
    child.on('message', (message) => {
      const value = message as { type?: unknown; role?: unknown };
      if (role !== 'migration' && value.type === 'ready' && value.role === role) { clearTimeout(timeout); resolve(); }
    });
  });
  child.postMessage({ type: 'runtime-config', snapshot });
  await completed;
  return role === 'migration' ? undefined : child;
}

async function stopUtilityProcess(child: UtilityProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let timer = setTimeout(() => {
      child.kill();
      timer = setTimeout(() => reject(new Error('Serenity utility process did not stop')), 5_000);
    }, 10_000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.postMessage({ type: 'shutdown' });
  });
}

async function refreshHealth(
  state: ReturnType<ServiceOrchestrator['getState']>,
  run: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>,
  composeFile: string,
  supervisor: UtilityProcessSupervisor,
  ports: LocalServicePorts,
): Promise<ServiceHealthSummary> {
  if (state !== 'running') return health;
  const infrastructure = await checkInfrastructure(run, composeFile);
  const [apiHealthy, workerResponsive, workerHeartbeat] = await Promise.all([
    fetch(`http://127.0.0.1:${ports.api}/api/health`, { signal: AbortSignal.timeout(3_000) }).then((response) => response.ok).catch(() => false),
    pingUtilityProcess(supervisor.get('worker'), 'worker'),
    checkWorkerHeartbeat(run, composeFile),
  ]);
  const services: ServiceHealthSummary['services'] = [
    { name: 'mysql', status: infrastructure.database ? 'healthy' : 'failed' },
    { name: 'redis', status: infrastructure.redis ? 'healthy' : 'failed' },
    { name: 'migration', status: 'healthy' },
    { name: 'api', status: apiHealthy && supervisor.get('api') ? 'healthy' : 'failed' },
    { name: 'worker', status: workerResponsive && workerHeartbeat ? 'healthy' : 'failed' },
  ];
  health = { overall: services.every((service) => service.status === 'healthy') ? 'healthy' : 'degraded', workspaceUrl: `http://127.0.0.1:${ports.api}`, services };
  return health;
}

async function checkWorkerHeartbeat(run: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>, composeFile: string): Promise<boolean> {
  return run('docker', [
    'compose', '-p', 'serenity-local', '-f', composeFile, 'exec', '-T', 'db', 'mysql', '-uroot', '-Nse',
    "SELECT COUNT(*) FROM worker_heartbeats WHERE status = 'ready' AND heartbeat_at > UTC_TIMESTAMP() - INTERVAL 5 MINUTE", 'serenity',
  ]).then(({ stdout }) => Number(stdout.trim()) > 0).catch(() => false);
}

async function pingUtilityProcess(child: SupervisedProcess | undefined, role: 'worker'): Promise<boolean> {
  if (!child) return false;
  return new Promise<boolean>((resolve) => {
    const listener = (message: unknown) => {
      const value = message as { type?: unknown; role?: unknown };
      if (value.type === 'health-check-ok' && value.role === role) { clearTimeout(timer); child.off('message', listener); resolve(true); }
    };
    const timer = setTimeout(() => { child.off('message', listener); resolve(false); }, 2_000);
    child.on('message', listener);
    child.postMessage({ type: 'health-check' });
  });
}

async function waitForInfrastructure(run: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>, composeFile: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { database, redis } = await checkInfrastructure(run, composeFile);
    if (database && redis) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Local infrastructure did not become healthy');
}

async function checkInfrastructure(run: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>, composeFile: string) {
  const [database, redis] = await Promise.all([
    run('docker', ['compose', '-p', 'serenity-local', '-f', composeFile, 'exec', '-T', 'db', 'mysqladmin', 'ping', '-uroot']).then(({ stdout }) => stdout.includes('alive')).catch(() => false),
    run('docker', ['compose', '-p', 'serenity-local', '-f', composeFile, 'exec', '-T', 'redis', 'redis-cli', 'ping']).then(({ stdout }) => stdout.trim() === 'PONG').catch(() => false),
  ]);
  return { database, redis };
}

async function streamDatabaseDump(dockerExecutable: string, composeFile: string, destination: string, ports: LocalServicePorts): Promise<void> {
  const child = spawn(dockerExecutable, ['compose', '-p', 'serenity-local', '-f', composeFile, 'exec', '-T', 'db', 'mysqldump', '-uroot', '--single-transaction', 'serenity'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...localServicePortEnvironment(ports) },
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { if (stderr.length < 4_096) stderr += chunk.slice(0, 4_096 - stderr.length); });
  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`数据库备份失败（退出码 ${code ?? 'unknown'}）`)));
  });
  try {
    await Promise.all([pipeline(child.stdout, createWriteStream(destination, { flags: 'wx', mode: 0o600 })), exited]);
  } catch (error) {
    child.kill();
    void stderr;
    throw error;
  }
}

void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [launcherContentSecurityPolicy] } }));
  await registerServices();
  createWindow();
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('Serenity 家庭启动器');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开启动器', click: () => window?.show() },
    { type: 'separator' },
    { label: '停止 Serenity 并退出', click: () => { void (async () => { explicitQuit = true; try { await stopForQuit(); app.quit(); } catch { explicitQuit = false; window?.show(); } })(); } },
  ]));
  tray.on('double-click', () => window?.show());
});
app.on('window-all-closed', () => undefined);

const serviceNames = ['mysql', 'redis', 'migration', 'api', 'worker'] as const;
function stoppedHealth(): ServiceHealthSummary {
  return { overall: 'stopped', services: serviceNames.map((name) => ({ name, status: 'stopped' })) };
}
function startingHealth(): ServiceHealthSummary {
  return { overall: 'starting', services: serviceNames.map((name) => ({ name, status: name === 'mysql' || name === 'redis' ? 'starting' : 'pending' })) };
}
function stageHealth(stage: 'migration' | 'api' | 'worker'): ServiceHealthSummary {
  const index = serviceNames.indexOf(stage);
  return { overall: 'starting', services: serviceNames.map((name, position) => ({ name, status: position < index ? 'healthy' : position === index ? 'starting' : 'pending' })) };
}
function markUnexpectedExit(service: 'api' | 'worker'): void {
  if (health.overall !== 'healthy' && health.overall !== 'starting') return;
  health = {
    ...health, overall: 'degraded',
    services: health.services.map((entry) => entry.name === service ? { ...entry, status: 'failed', message: '进程意外退出' } : entry),
  };
}
