import { describe, expect, it } from 'vitest';
import { buildContextGraph, selectHistoricalCandidates } from './context-builder.js';

describe('bounded research context', () => {
  it('uses only archived nodes, reports missing references, and stops cycles', () => {
    const result = buildContextGraph({
      rootId: 'post-1',
      maxNodes: 3,
      nodes: [
        { id: 'post-1', text: 'root', visibility: 'active' },
        { id: 'post-2', text: 'parent', visibility: 'active' },
      ],
      relations: [
        { fromId: 'post-1', toId: 'post-2', type: 'reply_to' },
        { fromId: 'post-2', toId: 'post-1', type: 'conversation' },
        { fromId: 'post-1', toId: 'missing-3', type: 'quotes', missingReason: 'not_returned_by_provider' },
      ],
    });

    expect(result.nodes.map((node) => node.id)).toEqual(['post-1', 'post-2']);
    expect(result.missing).toEqual([
      { sourceId: 'missing-3', reason: 'not_returned_by_provider', relationType: 'quotes' },
    ]);
    expect(result.completeness).toBe('partial');
  });

  it('does not expose tombstoned text to downstream analysis', () => {
    const result = buildContextGraph({
      rootId: 'post-1', maxNodes: 3,
      nodes: [
        { id: 'post-1', text: 'root', visibility: 'active' },
        { id: 'post-2', text: 'restricted', visibility: 'deleted' },
      ],
      relations: [{ fromId: 'post-1', toId: 'post-2', type: 'quotes' }],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.missing[0]?.reason).toBe('deleted');
  });

  it('selects only archived Serenity cards that share a ticker or topic', () => {
    const result = selectHistoricalCandidates(
      { tickers: ['NVDA'], topics: ['AI accelerator'] },
      [
        { id: 'card-1', sourceActor: 'serenity', tickers: ['NVDA'], topics: [], summary: 'earlier view' },
        { id: 'card-2', sourceActor: 'other', tickers: ['NVDA'], topics: [], summary: 'other author' },
        { id: 'card-3', sourceActor: 'serenity', tickers: ['TSLA'], topics: [], summary: 'unrelated' },
      ],
      5,
    );
    expect(result.candidates.map((candidate) => candidate.id)).toEqual(['card-1']);
    expect(result.reason).toBeUndefined();
    expect(selectHistoricalCandidates({ tickers: [], topics: [] }, [], 5).reason).toBe(
      '历史样本不足，无法判断观点变化',
    );
  });
});
