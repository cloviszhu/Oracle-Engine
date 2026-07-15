import { describe, expect, it, vi } from 'vitest';
import { buildOperationsStatus, RecoveryService } from './operations.service.js';

describe('operations status and recovery', () => {
  it('keeps disabled Feishu outside core success and backlog calculations', () => {
    const status = buildOperationsStatus({
      ingestionRuns: [
        { mode: 'poll', status: 'succeeded' },
        { mode: 'compensation', status: 'retryable_failed' },
      ],
      stages: [
        { stage: 'ingest', status: 'succeeded' },
        { stage: 'context', status: 'succeeded' },
        { stage: 'analysis', status: 'succeeded' },
        { stage: 'score', status: 'succeeded' },
        { stage: 'notify', status: 'blocked' },
      ],
      worker: { status: 'ready', heartbeatAt: '2026-07-15T00:10:00Z' },
      notification: { enabled: false, configured: false, backlog: 99 },
      budget: { blocked: false, dailyBudgetCents: 100, spentCents: 10 },
      visibility: {
        firstObservedAt: '2026-07-15T00:00:00Z', visibleAt: '2026-07-15T00:20:00Z', sloMinutes: 30,
      },
    });
    expect(status.core.status).toBe('succeeded');
    expect(status.notification).toEqual({
      enabled: false, configured: false, status: 'disabled', backlog: 0, recoverable: [],
    });
    expect(status.visibility).toMatchObject({ durationMinutes: 20, metSlo: true });
    expect(status.ingestion).toMatchObject({ poll: { succeeded: 1 }, compensation: { retryable_failed: 1 } });
  });

  it('shows budget blocking and outcome-unknown/dead-letter states without secrets', () => {
    const serialized = JSON.stringify(buildOperationsStatus({
      ingestionRuns: [],
      stages: [
        { stage: 'analysis', status: 'blocked', errorCode: 'budget_exceeded' },
        { stage: 'notify', status: 'outcome_unknown', errorCode: 'webhook-canary-secret' },
        { stage: 'context', status: 'dead_letter' },
      ],
      notification: {
        enabled: true,
        configured: true,
        backlog: 2,
        recoverable: [{ id: 'delivery-1', status: 'blocked', manualRetryAllowed: true }],
      },
      budget: { blocked: true, dailyBudgetCents: 10, spentCents: 10 },
    }));
    expect(serialized).toContain('budget_exceeded');
    expect(serialized).toContain('outcome_unknown');
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('canary-secret');
    expect(serialized).toContain('delivery-1');
  });

  it('creates a new attempt only for explicitly recoverable terminal work', async () => {
    const repository = {
      findRecoverable: vi.fn()
        .mockResolvedValueOnce({ kind: 'notification', id: 'delivery-1', status: 'dead_letter', manualRetryAllowed: true })
        .mockResolvedValueOnce({ kind: 'processing', id: 'intent-2', status: 'succeeded', manualRetryAllowed: false }),
      createAttempt: vi.fn().mockResolvedValue({ id: 'attempt-2', attempt: 2 }),
    };
    const service = new RecoveryService(repository);
    await expect(service.retry('delivery-1', 'father')).resolves.toEqual({ id: 'attempt-2', attempt: 2 });
    await expect(service.retry('intent-2', 'father')).rejects.toThrow(/not_recoverable/);
    expect(repository.createAttempt).toHaveBeenCalledTimes(1);
    expect(repository.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'notification', id: 'delivery-1' }),
      'father',
    );
  });
});
