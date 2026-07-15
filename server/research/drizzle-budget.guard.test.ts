import { describe, expect, it, vi } from 'vitest';
import { DrizzleResearchBudgetGuard } from './drizzle-budget.guard.js';

function fakeDatabase(results: unknown[]) {
  const execute = vi.fn(async () => results.shift());
  return {
    execute,
    transaction: vi.fn(async (operation: (transaction: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute })),
  };
}

describe('atomic research budget guard', () => {
  it('serializes the daily sum and creates a reservation below budget', async () => {
    const database = fakeDatabase([
      [[{ acquired: 1 }]],
      [[]],
      [[{ spent_cents: '4.0000' }]],
      [{ affectedRows: 1 }],
      [[{ released: 1 }]],
    ]);
    const guard = new DrizzleResearchBudgetGuard(database as never, {
      provider: 'openai', dailyBudgetCents: 10, reservationTtlMs: 60_000,
    });

    const result = await guard.reserve({ analysisKey: 'analysis-1', estimatedCostCents: 5 });

    expect(result).toMatchObject({ allowed: true });
    expect(database.execute).toHaveBeenCalledTimes(5);
  });

  it('denies before insertion when the serialized daily total would exceed budget', async () => {
    const database = fakeDatabase([
      [[{ acquired: 1 }]],
      [[]],
      [[{ spent_cents: '9.0000' }]],
      [[{ released: 1 }]],
    ]);
    const guard = new DrizzleResearchBudgetGuard(database as never, {
      provider: 'openai', dailyBudgetCents: 10, reservationTtlMs: 60_000,
    });

    await expect(guard.reserve({
      analysisKey: 'analysis-1', estimatedCostCents: 5,
    })).resolves.toEqual({ allowed: false, reason: 'budget' });
    expect(database.execute).toHaveBeenCalledTimes(4);
  });

  it('blocks a concurrent duplicate that finds an active reservation', async () => {
    const database = fakeDatabase([
      [[{ acquired: 1 }]],
      [[{ id: 'reservation-1', status: 'reserved', expires_at: '2099-01-01T00:00:00Z' }]],
      [[{ released: 1 }]],
    ]);
    const guard = new DrizzleResearchBudgetGuard(database as never, {
      provider: 'openai', dailyBudgetCents: 10, reservationTtlMs: 60_000,
    });

    await expect(guard.reserve({
      analysisKey: 'analysis-1', estimatedCostCents: 5,
    })).resolves.toEqual({ allowed: false, reason: 'in_progress' });
    expect(database.execute).toHaveBeenCalledTimes(3);
  });

  it('rejects invalid cost limits before touching the database', async () => {
    const database = fakeDatabase([]);
    const guard = new DrizzleResearchBudgetGuard(database as never, {
      provider: 'openai', dailyBudgetCents: 10, reservationTtlMs: 60_000,
    });

    await expect(guard.reserve({
      analysisKey: 'analysis-1', estimatedCostCents: -1,
    })).rejects.toThrow('estimatedCostCents');
    expect(database.execute).not.toHaveBeenCalled();
  });
});
