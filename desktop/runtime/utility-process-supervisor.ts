export type SupervisedRole = 'api' | 'worker';
export interface SupervisedProcess {
  once(event: 'exit', listener: () => void): unknown;
  postMessage(message: unknown): void;
  kill(): boolean | void;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  off(event: 'message', listener: (message: unknown) => void): unknown;
}

export class UtilityProcessSupervisor {
  private readonly processes = new Map<SupervisedRole, SupervisedProcess>();

  constructor(private readonly stopProcess: (child: SupervisedProcess) => Promise<void>) {}

  track(role: SupervisedRole, child: SupervisedProcess, onUnexpectedExit: (role: SupervisedRole) => void): void {
    this.processes.set(role, child);
    child.once('exit', () => {
      if (this.processes.get(role) !== child) return;
      this.processes.delete(role);
      onUnexpectedExit(role);
    });
  }

  get(role: SupervisedRole): SupervisedProcess | undefined { return this.processes.get(role); }

  async stop(role: SupervisedRole): Promise<void> {
    const child = this.processes.get(role);
    if (!child) return;
    await this.stopProcess(child);
    this.processes.delete(role);
  }
}
