import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { UtilityProcessSupervisor, type SupervisedProcess } from './utility-process-supervisor.js';

function childProcess(): SupervisedProcess & EventEmitter {
  const emitter = new EventEmitter() as SupervisedProcess & EventEmitter;
  emitter.postMessage = vi.fn(); emitter.kill = vi.fn();
  return emitter;
}

describe('UtilityProcessSupervisor', () => {
  it('forgets an already-exited child before cleanup so stop cannot wait on a lost exit event', async () => {
    const stopProcess = vi.fn(async () => undefined);
    const onUnexpectedExit = vi.fn();
    const supervisor = new UtilityProcessSupervisor(stopProcess);
    const child = childProcess();
    supervisor.track('worker', child, onUnexpectedExit);
    child.emit('exit');
    expect(supervisor.get('worker')).toBeUndefined();
    expect(onUnexpectedExit).toHaveBeenCalledWith('worker');
    await supervisor.stop('worker');
    expect(stopProcess).not.toHaveBeenCalled();
  });
});
