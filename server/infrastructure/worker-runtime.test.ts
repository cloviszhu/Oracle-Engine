import { describe, expect, it, vi } from 'vitest';
import { checkInfrastructureReadiness } from './worker-runtime.js';

describe('worker infrastructure readiness', () => {
  it('reports database and Redis readiness without exposing connection values', async () => {
    const status = await checkInfrastructureReadiness({
      databasePing: vi.fn().mockResolvedValue(undefined),
      redisPing: vi.fn().mockResolvedValue('PONG'),
    });

    expect(status).toEqual({ database: 'ready', redis: 'ready' });
  });

  it('fails visibly when an infrastructure probe fails', async () => {
    await expect(
      checkInfrastructureReadiness({
        databasePing: vi.fn().mockRejectedValue(new Error('database unavailable')),
        redisPing: vi.fn().mockResolvedValue('PONG'),
      }),
    ).rejects.toThrow('database unavailable');
  });
});
