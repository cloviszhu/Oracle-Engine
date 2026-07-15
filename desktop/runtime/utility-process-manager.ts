import { parseRuntimeConfigSnapshot, type RuntimeConfigSnapshot } from '../../server/infrastructure/runtime-config.js';

export type UtilityRole = 'migration' | 'api' | 'worker';
export interface ManagedUtilityProcess {
  postMessage(message: unknown): void;
  kill(): void;
}
export type UtilityProcessFork = (modulePath: string, args: string[]) => ManagedUtilityProcess;

export class UtilityProcessManager {
  private readonly processes = new Map<UtilityRole, ManagedUtilityProcess>();

  constructor(private readonly fork: UtilityProcessFork, private readonly modulePath: string) {}

  async start(role: UtilityRole, input: RuntimeConfigSnapshot): Promise<void> {
    if (this.processes.has(role)) return;
    const snapshot = parseRuntimeConfigSnapshot(input);
    const child = this.fork(this.modulePath, [`--role=${role}`]);
    child.postMessage({ type: 'runtime-config', snapshot });
    this.processes.set(role, child);
  }

  async stop(role: UtilityRole): Promise<void> {
    const child = this.processes.get(role);
    if (!child) return;
    child.kill();
    this.processes.delete(role);
  }
}
