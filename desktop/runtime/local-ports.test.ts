import { describe, expect, it, vi } from 'vitest';
import {
  createLocalServicePortSelection,
  localServicePortEnvironment,
  selectLocalServicePorts,
} from './local-ports.js';

describe('local service port selection', () => {
  it('keeps the API loopback port and selects the first free MySQL and Redis alternatives', async () => {
    const unavailable = new Set([33060, 36379, 36380]);
    const isAvailable = vi.fn(async (port: number) => !unavailable.has(port));

    await expect(selectLocalServicePorts(isAvailable)).resolves.toEqual({
      api: 3000,
      mysql: 33061,
      redis: 36381,
    });
  });

  it('fails closed when the required API port or every bounded database candidate is occupied', async () => {
    await expect(selectLocalServicePorts(async (port) => port !== 3000)).rejects.toThrow(/3000/);
    await expect(selectLocalServicePorts(async (port) => port === 3000 || port >= 36379)).rejects.toThrow(/MySQL/);
    await expect(selectLocalServicePorts(async (port) => port < 36379)).rejects.toThrow(/Redis/);
  });

  it('maps selected host ports to the bounded Compose interpolation variables', () => {
    expect(localServicePortEnvironment({ api: 3000, mysql: 33061, redis: 36381 })).toEqual({
      SERENITY_MYSQL_PORT: '33061',
      SERENITY_REDIS_PORT: '36381',
    });
  });

  it('refreshes the selection for every start attempt and clears it after shutdown', async () => {
    let unavailable = new Set([33060]);
    const selection = createLocalServicePortSelection(async (port) => !unavailable.has(port));

    await expect(selection.require()).resolves.toMatchObject({ mysql: 33061 });
    unavailable = new Set([33060, 33061]);
    await expect(selection.refresh()).resolves.toMatchObject({ mysql: 33062 });
    expect(selection.current()).toMatchObject({ mysql: 33062 });

    selection.clear();
    expect(selection.current()).toBeUndefined();
  });

  it('does not let a stale in-flight probe repopulate a cleared selection', async () => {
    let releaseFirst!: () => void;
    let apiProbeCalls = 0;
    const selection = createLocalServicePortSelection(async (port) => {
      if (port === 3000 && ++apiProbeCalls === 1) {
        await new Promise<void>((resolve) => { releaseFirst = resolve; });
      }
      return true;
    });

    const stale = selection.require();
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'));
    selection.clear();
    const current = await selection.require();
    releaseFirst();
    await stale;

    expect(selection.current()).toBe(current);
  });
});
