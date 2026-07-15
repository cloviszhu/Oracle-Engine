import { describe, expect, it, vi } from 'vitest';
import { dispatchPendingIntents } from './dispatcher.js';

describe('durable intent dispatcher', () => {
  it('publishes stable jobs and marks only successful publications dispatched', async () => {
    const listDispatchable = vi.fn().mockResolvedValue([
      { id: 'intent-1', stage: 'context' as const, correlationId: 'corr-1', fencingToken: 2 },
      { id: 'intent-2', stage: 'analysis' as const, correlationId: 'corr-2', fencingToken: 1 },
    ]);
    const markDispatched = vi.fn().mockResolvedValue(undefined);
    const add = vi.fn().mockResolvedValue(undefined);

    const count = await dispatchPendingIntents(
      { listDispatchable, markDispatched },
      { add },
      10,
    );

    expect(count).toBe(2);
    expect(add).toHaveBeenNthCalledWith(
      1,
      'context',
      expect.objectContaining({ intentId: 'intent-1', fencingToken: 2 }),
      { jobId: 'context--intent-1' },
    );
    expect(markDispatched).toHaveBeenCalledTimes(2);
  });

  it('does not mark an intent when queue publication fails', async () => {
    const markDispatched = vi.fn();
    const error = new Error('redis unavailable');

    await expect(
      dispatchPendingIntents(
        {
          listDispatchable: vi.fn().mockResolvedValue([
            { id: 'intent-1', stage: 'context' as const, correlationId: 'corr-1', fencingToken: 2 },
          ]),
          markDispatched,
        },
        { add: vi.fn().mockRejectedValue(error) },
        10,
      ),
    ).rejects.toBe(error);
    expect(markDispatched).not.toHaveBeenCalled();
  });
});
