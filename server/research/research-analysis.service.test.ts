import { describe, expect, it, vi } from 'vitest';
import { validDraft } from './research-contract.test.js';
import { buildResearchEnvelope } from './research-contract.js';
import { ResearchAnalysisService } from './research-analysis.service.js';

const envelope = buildResearchEnvelope({
  current: {
    sourceId: 'post-1', text: 'source', sourceUrl: 'https://x.com/i/web/status/1',
    publishedAt: '2026-07-15T00:00:00Z', contentType: 'post',
  },
  context: [], history: [], completeness: 'complete',
});
const target = {
  analysisKey: 'key-1',
  contentId: 'content-1',
  contentVersionId: 'version-1',
  cardVersion: 1,
  promptVersion: 'research-v1',
};

describe('research analysis idempotency and budget', () => {
  it('reuses an existing successful analysis without reserving or calling the model', async () => {
    const existing = { id: 'card-1', draft: validDraft };
    const repository = { findSucceeded: vi.fn().mockResolvedValue(existing), saveSucceeded: vi.fn() };
    const budget = { reserve: vi.fn(), settle: vi.fn(), release: vi.fn() };
    const adapter = { analyze: vi.fn() };

    const result = await new ResearchAnalysisService(repository, budget, adapter).analyze({
      ...target, envelope, estimatedCostCents: 1,
    });

    expect(result).toEqual({ status: 'reused', value: existing });
    expect(budget.reserve).not.toHaveBeenCalled();
    expect(adapter.analyze).not.toHaveBeenCalled();
  });

  it.each(['budget', 'rate_limit'] as const)(
    'blocks for %s before the provider call and does not fall back to another model',
    async (reason) => {
      const repository = { findSucceeded: vi.fn().mockResolvedValue(undefined), saveSucceeded: vi.fn() };
      const budget = {
        reserve: vi.fn().mockResolvedValue({ allowed: false, reason }),
        settle: vi.fn(), release: vi.fn(),
      };
      const adapter = { analyze: vi.fn() };

      const result = await new ResearchAnalysisService(repository, budget, adapter).analyze({
        ...target, envelope, estimatedCostCents: 5,
      });

      expect(result).toEqual({ status: 'blocked', reason });
      expect(adapter.analyze).not.toHaveBeenCalled();
      expect(repository.saveSucceeded).not.toHaveBeenCalled();
    },
  );

  it('records model, request, usage and cost then settles the reservation once', async () => {
    const modelResult = {
      draft: validDraft, provider: 'openai', requestedModel: 'gpt-5.6-terra', actualModel: 'gpt-5.6-terra',
      providerRequestId: 'resp-1', requestId: 'req-1',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, costCents: 0.1,
    };
    const repository = {
      findSucceeded: vi.fn().mockResolvedValue(undefined),
      saveSucceeded: vi.fn().mockResolvedValue({ id: 'card-1', draft: validDraft }),
    };
    const budget = {
      reserve: vi.fn().mockResolvedValue({ allowed: true, reservationId: 'reservation-1' }),
      settle: vi.fn(), release: vi.fn(),
    };
    const adapter = { analyze: vi.fn().mockResolvedValue(modelResult) };

    const result = await new ResearchAnalysisService(repository, budget, adapter).analyze({
      ...target, envelope, estimatedCostCents: 1,
    });

    expect(repository.saveSucceeded).toHaveBeenCalledWith(target, modelResult);
    expect(budget.settle).toHaveBeenCalledWith('reservation-1', 0.1);
    expect(result.status).toBe('created');
  });
});
