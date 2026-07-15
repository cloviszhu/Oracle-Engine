import { describe, expect, it, vi } from 'vitest';
import { compareXIds, PollSourceService, SERENITY_POLL_JOB_ID } from './poll-source.service.js';

function page(ids: string[], nextToken?: string) {
  return {
    items: ids.map((id) => ({ id, authorId: 'serenity-id', text: `post-${id}`, quoteIds: [], editHistoryIds: [id] })),
    included: [], newestId: ids[0], nextToken, providerRequestId: `request-${ids[0]}`,
    evidenceKind: 'mock' as const, rawAudit: { resultCount: ids.length },
  };
}

describe('Serenity polling and cursor safety', () => {
  it('compares X ids with bigint semantics', () => {
    expect(compareXIds('999999999999999999', '1000000000000000000')).toBeLessThan(0);
  });

  it('persists every page before advancing the cursor monotonically', async () => {
    const listUserContent = vi.fn()
      .mockResolvedValueOnce(page(['20', '19'], 'next'))
      .mockResolvedValueOnce(page(['18']));
    const repository = {
      beginRun: vi.fn().mockResolvedValue('run-1'),
      persistPage: vi.fn().mockResolvedValue(undefined),
      completeRunAndAdvanceCursor: vi.fn().mockResolvedValue(true),
      failRun: vi.fn(),
    };
    const service = new PollSourceService({ listUserContent }, repository);

    await service.poll({ sourceId: 'source-1', externalUserId: 'serenity-id', sinceId: '10', mode: 'poll' });

    expect(repository.persistPage).toHaveBeenCalledTimes(2);
    expect(repository.completeRunAndAdvanceCursor).toHaveBeenCalledWith({
      runId: 'run-1', sourceId: 'source-1', expectedSinceId: '10', nextSinceId: '20',
      pages: 2, items: 3,
    });
    expect(SERENITY_POLL_JOB_ID).toBe('poll-source--serenity');
  });

  it('does not advance the cursor after a later page fails', async () => {
    const error = new Error('second page unavailable');
    const client = { listUserContent: vi.fn().mockResolvedValueOnce(page(['20'], 'next')).mockRejectedValueOnce(error) };
    const repository = {
      beginRun: vi.fn().mockResolvedValue('run-2'), persistPage: vi.fn(),
      completeRunAndAdvanceCursor: vi.fn(), failRun: vi.fn(),
    };
    const service = new PollSourceService(client, repository);

    await expect(
      service.poll({ sourceId: 'source-1', externalUserId: 'serenity-id', sinceId: '10', mode: 'compensation' }),
    ).rejects.toBe(error);
    expect(repository.completeRunAndAdvanceCursor).not.toHaveBeenCalled();
    expect(repository.failRun).toHaveBeenCalledWith('run-2', error);
  });

  it('treats a lost cursor CAS as a safe concurrent completion', async () => {
    const repository = {
      beginRun: vi.fn().mockResolvedValue('run-3'), persistPage: vi.fn(),
      completeRunAndAdvanceCursor: vi.fn().mockResolvedValue(false), failRun: vi.fn(),
    };
    const service = new PollSourceService({ listUserContent: vi.fn().mockResolvedValue(page(['20'])) }, repository);

    const result = await service.poll({ sourceId: 'source-1', externalUserId: 'serenity-id', sinceId: '10', mode: 'poll' });

    expect(result.cursorAdvanced).toBe(false);
    expect(result.newestId).toBe('20');
  });
});
