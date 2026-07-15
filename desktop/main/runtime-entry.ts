import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runtimeSnapshotToEnvironment } from '../../server/infrastructure/runtime-snapshot-environment.js';
import { parseRuntimeConfigSnapshot } from '../../server/infrastructure/runtime-config.js';

const role = process.argv.find((value) => value.startsWith('--role='))?.slice('--role='.length);
const runtimeRoot = process.argv.find((value) => value.startsWith('--runtime-root='))?.slice('--runtime-root='.length);
if (!role || !['migration', 'api', 'worker'].includes(role)) throw new Error('Invalid Serenity utility role');
if (!runtimeRoot) throw new Error('Serenity utility process requires a runtime root');
const parentPort = (process as NodeJS.Process & { parentPort?: { on(event: 'message', listener: (event: { data?: unknown }) => void): void; postMessage(message: unknown): void } }).parentPort;
if (!parentPort) throw new Error('Serenity utility process requires a private parent port');

let initialized = false;
parentPort.on('message', (event) => {
  const envelope = (event.data ?? event) as { type?: unknown; snapshot?: unknown };
  if (envelope.type === 'shutdown') {
    process.emit('SIGTERM', 'SIGTERM');
    return;
  }
  if (envelope.type === 'health-check') {
    parentPort.postMessage({ type: 'health-check-ok', role });
    return;
  }
  if (initialized) throw new Error('Runtime configuration may only be delivered once');
  if (envelope.type !== 'runtime-config') throw new Error('Invalid private runtime message');
  initialized = true;
  const snapshot = parseRuntimeConfigSnapshot(envelope.snapshot);
  Object.assign(process.env, runtimeSnapshotToEnvironment(snapshot));
  const relative = role === 'migration' ? 'infrastructure/database/migrate.js' : `${role}.js`;
  void import(pathToFileURL(join(runtimeRoot, 'dist', 'server', relative)).href).catch(() => process.exit(1));
});
