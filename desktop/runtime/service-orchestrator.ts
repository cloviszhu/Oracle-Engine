export interface ServiceLifecycleDependencies {
  prepareDirectories(): Promise<void>;
  reservePorts(): Promise<void>;
  startInfrastructure(): Promise<void>;
  waitForInfrastructure(): Promise<void>;
  migrate(): Promise<void>;
  startApi(): Promise<void>;
  waitForApi(): Promise<void>;
  startWorker(): Promise<void>;
  waitForWorker(): Promise<void>;
  openWorkspace(): Promise<void>;
  stopAcceptingWork(): Promise<void>;
  stopWorker(): Promise<void>;
  stopApi(): Promise<void>;
  stopInfrastructure(): Promise<void>;
}

export class ServiceOrchestrator {
  private state: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
  private infrastructureStarted = false;
  private apiStarted = false;
  private workerStarted = false;
  private startPromise?: Promise<void>;
  private stopPromise?: Promise<void>;

  constructor(private readonly dependencies: ServiceLifecycleDependencies) {}

  async start(): Promise<void> {
    if (this.state === 'running') return;
    if (this.startPromise) return this.startPromise;
    if (this.stopPromise) { await this.stopPromise; return this.start(); }
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startOnce();
    try { await this.startPromise; } finally { this.startPromise = undefined; }
  }

  private async startOnce(): Promise<void> {
    if (this.state !== 'stopped') throw new Error('Serenity 服务正在切换状态，请稍后重试');
    this.state = 'starting';
    try {
      await this.dependencies.prepareDirectories();
      await this.dependencies.reservePorts();
      await this.dependencies.startInfrastructure();
      this.infrastructureStarted = true;
      await this.dependencies.waitForInfrastructure();
      await this.dependencies.migrate();
      await this.dependencies.startApi();
      this.apiStarted = true;
      await this.dependencies.waitForApi();
      await this.dependencies.startWorker();
      this.workerStarted = true;
      await this.dependencies.waitForWorker();
      await this.dependencies.openWorkspace();
      this.state = 'running';
    } catch (error) {
      try { await this.rollback(); } catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Serenity 启动和回滚均失败'); }
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    if (this.startPromise) await this.startPromise.catch(() => undefined);
    if (this.state === 'stopped') return;
    this.stopPromise = this.stopOnce();
    try { await this.stopPromise; } finally { this.stopPromise = undefined; }
  }

  private async stopOnce(): Promise<void> {
    if (this.state !== 'running') throw new Error('Serenity 服务正在切换状态，请稍后重试');
    this.state = 'stopping';
    let drainError: unknown;
    try { await this.dependencies.stopAcceptingWork(); } catch (error) { drainError = error; }
    await this.rollback();
    if (drainError) throw drainError;
  }

  getState(): 'stopped' | 'starting' | 'running' | 'stopping' { return this.state; }

  private async rollback(): Promise<void> {
    const failures: unknown[] = [];
    const attempt = async (enabled: boolean, action: () => Promise<void>) => {
      if (!enabled) return true;
      try { await action(); return true; } catch (error) { failures.push(error); return false; }
    };
    if (await attempt(this.workerStarted, () => this.dependencies.stopWorker())) this.workerStarted = false;
    if (await attempt(this.apiStarted, () => this.dependencies.stopApi())) this.apiStarted = false;
    if (await attempt(this.infrastructureStarted, () => this.dependencies.stopInfrastructure())) this.infrastructureStarted = false;
    this.state = this.workerStarted || this.apiStarted || this.infrastructureStarted ? 'running' : 'stopped';
    if (failures.length) throw new AggregateError(failures, 'Serenity 停止不完整');
  }
}
