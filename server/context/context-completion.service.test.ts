import { describe, expect, it, vi } from 'vitest';
import type { XContentPage } from '../infrastructure/x/content-source.adapter.js';
import { ContextCompletionService } from './context-completion.service.js';

const emptyPage: XContentPage = {
  items: [], included: [], evidenceKind: 'mock', rawAudit: {},
};

describe('context completion', () => {
  it('looks up only missing provider ids in one bounded batch', async () => {
    const client = { lookupContent: vi.fn().mockResolvedValue(emptyPage) };
    const repository = { persistLookupPage: vi.fn() };
    const service = new ContextCompletionService(client, repository, 100);

    const result = await service.complete({
      rootId: '1',
      nodes: [{ id: '1', text: 'root', visibility: 'active' }],
      relations: [
        { fromId: '1', toId: '2', type: 'reply_to', missingReason: 'not_archived' },
        { fromId: '1', toId: '2', type: 'conversation', missingReason: 'not_archived' },
        { fromId: '1', toId: '3', type: 'quotes', missingReason: 'deleted' },
      ],
      maxNodes: 10,
    });

    expect(client.lookupContent).toHaveBeenCalledWith(['2']);
    expect(repository.persistLookupPage).toHaveBeenCalledWith(emptyPage);
    expect(result.lookupIds).toEqual(['2']);
    expect(result.graph.completeness).toBe('partial');
  });

  it('does not call the provider when archived expansions already complete context', async () => {
    const client = { lookupContent: vi.fn() };
    const repository = { persistLookupPage: vi.fn() };
    const service = new ContextCompletionService(client, repository, 100);

    const result = await service.complete({
      rootId: '1',
      nodes: [
        { id: '1', text: 'root', visibility: 'active' },
        { id: '2', text: 'parent', visibility: 'active' },
      ],
      relations: [{ fromId: '1', toId: '2', type: 'reply_to' }],
      maxNodes: 10,
    });

    expect(client.lookupContent).not.toHaveBeenCalled();
    expect(repository.persistLookupPage).not.toHaveBeenCalled();
    expect(result.graph.completeness).toBe('complete');
  });

  it('rejects an unsafe provider batch limit', () => {
    expect(() => new ContextCompletionService(
      { lookupContent: vi.fn() }, { persistLookupPage: vi.fn() }, 101,
    )).toThrow('lookupBatchLimit');
  });
});
