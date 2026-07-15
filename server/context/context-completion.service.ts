import type {
  XContentPage,
  XContentSourceAdapter,
} from '../infrastructure/x/content-source.adapter.js';
import {
  buildContextGraph,
  type ArchivedContextNode,
  type ArchivedContextRelation,
} from './context-builder.js';

interface ContextLookupRepository {
  persistLookupPage(page: XContentPage): Promise<void>;
}

type ContextInput = {
  rootId: string;
  nodes: ArchivedContextNode[];
  relations: ArchivedContextRelation[];
  maxNodes: number;
};

export class ContextCompletionService {
  constructor(
    private readonly client: Pick<XContentSourceAdapter, 'lookupContent'>,
    private readonly repository: ContextLookupRepository,
    private readonly lookupBatchLimit: number,
  ) {
    if (lookupBatchLimit < 1 || lookupBatchLimit > 100) {
      throw new Error('lookupBatchLimit must be between 1 and 100');
    }
  }

  async complete(input: ContextInput) {
    const initial = buildContextGraph(input);
    const lookupIds = [...new Set(
      initial.missing
        .filter((item) => item.reason === 'not_archived' || item.reason === 'not_returned_by_provider')
        .map((item) => item.sourceId),
    )].slice(0, this.lookupBatchLimit);

    if (lookupIds.length === 0) return { graph: initial, lookupIds };

    const page = await this.client.lookupContent(lookupIds);
    await this.repository.persistLookupPage(page);
    const returned = [...page.included, ...page.items];
    const returnedIds = new Set(returned.map((item) => item.id));
    const nodes = [
      ...input.nodes,
      ...returned
        .filter((item) => !input.nodes.some((node) => node.id === item.id))
        .map((item): ArchivedContextNode => ({
          id: item.id,
          text: item.text,
          visibility: 'active',
          sourceUrl: `https://x.com/i/web/status/${item.id}`,
          publishedAt: item.createdAt,
        })),
    ];
    const relations = input.relations.map((relation) => returnedIds.has(relation.toId)
      ? { ...relation, missingReason: undefined }
      : relation);

    return {
      graph: buildContextGraph({ ...input, nodes, relations }),
      lookupIds,
    };
  }
}
