import { describe, expect, it, vi } from 'vitest';
import { DrizzleRecoveryRepository } from './drizzle-operations.service.js';

function database(results: unknown[]) {
  const execute = vi.fn(async () => results.shift());
  return {
    execute,
    transaction: vi.fn(async (operation: (transaction: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute })),
  };
}

describe('Drizzle operations recovery repository', () => {
  it('finds recoverable notification work without exposing configuration', async () => {
    const db = database([[[{
      kind: 'notification', id: 'delivery-1', status: 'blocked', manualRetryAllowed: 1,
    }]]]);
    const repository = new DrizzleRecoveryRepository(db as never);
    await expect(repository.findRecoverable('delivery-1')).resolves.toEqual({
      kind: 'notification', id: 'delivery-1', status: 'blocked', manualRetryAllowed: true,
    });
  });

  it('audits notification recovery and returns it to pending without rewriting attempts', async () => {
    const db = database([
      [[{ status: 'dead_letter', manualRetryAllowed: 1 }]],
      [{ affectedRows: 1 }],
      [{ affectedRows: 1 }],
    ]);
    const repository = new DrizzleRecoveryRepository(db as never);
    await expect(repository.createAttempt({
      kind: 'notification', id: 'delivery-1', status: 'dead_letter', manualRetryAllowed: true,
    }, 'father')).resolves.toMatchObject({
      kind: 'notification', deliveryId: 'delivery-1', status: 'pending', requestedByActorId: 'father',
    });
    expect(db.execute).toHaveBeenCalledTimes(3);
  });

  it('rechecks terminal state under lock before accepting a manual retry', async () => {
    const db = database([[[{ status: 'sent', manualRetryAllowed: 0 }]]]);
    const repository = new DrizzleRecoveryRepository(db as never);
    await expect(repository.createAttempt({
      kind: 'notification', id: 'delivery-1', status: 'blocked', manualRetryAllowed: true,
    }, 'father')).rejects.toThrow('not_recoverable');
    expect(db.execute).toHaveBeenCalledOnce();
  });
});
