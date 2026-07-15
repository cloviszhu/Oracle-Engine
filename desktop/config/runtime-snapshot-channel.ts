import { parseRuntimeConfigSnapshot, type RuntimeConfigSnapshot } from '../../server/infrastructure/runtime-config.js';

interface PrivateMessagePort {
  postMessage(message: unknown): void;
}

export class RuntimeSnapshotChannel {
  private delivered = false;

  constructor(private readonly port: PrivateMessagePort) {}

  deliver(input: RuntimeConfigSnapshot): void {
    if (this.delivered) throw new Error('运行配置快照只能向受控进程发送一次');
    const snapshot = parseRuntimeConfigSnapshot(input);
    this.port.postMessage({ type: 'runtime-config', snapshot });
    this.delivered = true;
  }
}
