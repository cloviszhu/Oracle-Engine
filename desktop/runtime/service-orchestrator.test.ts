import { describe, expect, it, vi } from 'vitest';
import { ServiceOrchestrator } from './service-orchestrator.js';

function dependencies(events: string[]) {
  const step = (name: string) => vi.fn(async () => { events.push(name); });
  return {
    prepareDirectories: step('directories'), reservePorts: step('ports'), startInfrastructure: step('docker'),
    waitForInfrastructure: step('infra-health'), migrate: step('migration'), startApi: step('api-start'),
    waitForApi: step('api-health'), startWorker: step('worker-start'), waitForWorker: step('worker-heartbeat'),
    openWorkspace: step('open-web'), stopAcceptingWork: step('drain'), stopWorker: step('worker-stop'),
    stopApi: step('api-stop'), stopInfrastructure: step('docker-stop'),
  };
}

describe('ServiceOrchestrator', () => {
  it('starts and stops in the required order and is idempotent', async () => {
    const events: string[] = [];
    const orchestrator = new ServiceOrchestrator(dependencies(events));
    await orchestrator.start();
    await orchestrator.start();
    await orchestrator.stop();
    await orchestrator.stop();
    expect(events).toEqual([
      'directories', 'ports', 'docker', 'infra-health', 'migration', 'api-start',
      'api-health', 'worker-start', 'worker-heartbeat', 'open-web',
      'drain', 'worker-stop', 'api-stop', 'docker-stop',
    ]);
  });

  it('rolls back only Serenity-owned stages after a staged failure', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    deps.waitForApi.mockRejectedValueOnce(new Error('API unavailable'));
    const orchestrator = new ServiceOrchestrator(deps);
    await expect(orchestrator.start()).rejects.toThrow(/API unavailable/);
    expect(events.slice(-2)).toEqual(['api-stop', 'docker-stop']);
    expect(deps.stopWorker).not.toHaveBeenCalled();
  });

  it('coalesces concurrent starts and lets stop wait for an in-flight start', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    let release!: () => void;
    deps.waitForInfrastructure.mockImplementationOnce(async () => { events.push('infra-health'); await new Promise<void>((resolve) => { release = resolve; }); });
    const orchestrator = new ServiceOrchestrator(deps);
    const first = orchestrator.start();
    const second = orchestrator.start();
    const stopping = orchestrator.stop();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await Promise.all([first, second, stopping]);
    expect(deps.startInfrastructure).toHaveBeenCalledOnce();
    expect(deps.stopInfrastructure).toHaveBeenCalledOnce();
    expect(orchestrator.getState()).toBe('stopped');
  });

  it('reports stop failure after still attempting every owned stage', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    const orchestrator = new ServiceOrchestrator(deps);
    await orchestrator.start();
    deps.stopWorker.mockRejectedValueOnce(new Error('worker stop failed'));
    await expect(orchestrator.stop()).rejects.toThrow(/停止不完整/);
    expect(deps.stopApi).toHaveBeenCalled();
    expect(deps.stopInfrastructure).toHaveBeenCalled();
    expect(orchestrator.getState()).toBe('running');
    await expect(orchestrator.stop()).resolves.toBeUndefined();
    expect(orchestrator.getState()).toBe('stopped');
  });

  it('coalesces starts that arrive while the same stop is finishing', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    const orchestrator = new ServiceOrchestrator(deps);
    await orchestrator.start();
    let release!: () => void;
    deps.stopInfrastructure.mockImplementationOnce(async () => { events.push('docker-stop'); await new Promise<void>((resolve) => { release = resolve; }); });
    const stopping = orchestrator.stop();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const firstRestart = orchestrator.start();
    const secondRestart = orchestrator.start();
    release();
    await Promise.all([stopping, firstRestart, secondRestart]);
    expect(deps.startInfrastructure).toHaveBeenCalledTimes(2);
    expect(orchestrator.getState()).toBe('running');
  });
});
