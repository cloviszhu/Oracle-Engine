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
});
