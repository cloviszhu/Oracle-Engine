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

  constructor(private readonly dependencies: ServiceLifecycleDependencies) {}

  async start(): Promise<void> {
    if (this.state === 'running') return;
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
      await this.rollback();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') return;
    if (this.state !== 'running') throw new Error('Serenity 服务正在切换状态，请稍后重试');
    this.state = 'stopping';
    await this.dependencies.stopAcceptingWork();
    await this.rollback();
  }

  getState(): 'stopped' | 'starting' | 'running' | 'stopping' { return this.state; }

  private async rollback(): Promise<void> {
    if (this.workerStarted) await this.dependencies.stopWorker();
    if (this.apiStarted) await this.dependencies.stopApi();
    if (this.infrastructureStarted) await this.dependencies.stopInfrastructure();
    this.workerStarted = false;
    this.apiStarted = false;
    this.infrastructureStarted = false;
    this.state = 'stopped';
  }
}
