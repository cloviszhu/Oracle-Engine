export interface ArchivedContextNode {
  id: string;
  text: string;
  visibility: 'active' | 'verification_pending' | 'deleted' | 'unavailable';
  sourceUrl?: string;
  publishedAt?: string;
}

export interface ArchivedContextRelation {
  fromId: string;
  toId: string;
  type: 'reply_to' | 'quotes' | 'conversation' | 'edit_predecessor';
  missingReason?: string;
}

export function buildContextGraph(input: {
  rootId: string;
  nodes: ArchivedContextNode[];
  relations: ArchivedContextRelation[];
  maxNodes: number;
}) {
  if (input.maxNodes < 1) throw new Error('maxNodes must be positive');
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, ArchivedContextRelation[]>();
  for (const relation of input.relations) {
    const existing = adjacency.get(relation.fromId) ?? [];
    existing.push(relation);
    adjacency.set(relation.fromId, existing);
  }
  const resultNodes: ArchivedContextNode[] = [];
  const resultRelations: ArchivedContextRelation[] = [];
  const missing: Array<{ sourceId: string; reason: string; relationType: string }> = [];
  const queued = [input.rootId];
  const visited = new Set<string>();

  while (queued.length > 0 && resultNodes.length < input.maxNodes) {
    const currentId = queued.shift() as string;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const current = nodesById.get(currentId);
    if (!current || current.visibility !== 'active') continue;
    resultNodes.push(current);
    for (const relation of adjacency.get(currentId) ?? []) {
      const target = nodesById.get(relation.toId);
      if (!target || target.visibility !== 'active') {
        const reason = target ? target.visibility : relation.missingReason ?? 'not_archived';
        if (!missing.some((item) => item.sourceId === relation.toId && item.relationType === relation.type)) {
          missing.push({ sourceId: relation.toId, reason, relationType: relation.type });
        }
        continue;
      }
      resultRelations.push(relation);
      if (!visited.has(relation.toId)) queued.push(relation.toId);
    }
  }

  return {
    nodes: resultNodes,
    relations: resultRelations,
    missing,
    completeness: missing.length === 0 ? ('complete' as const) : ('partial' as const),
  };
}

export interface HistoricalCardCandidate {
  id: string;
  sourceActor: string;
  tickers: string[];
  topics: string[];
  summary: string;
  publishedAt?: string;
}

export function selectHistoricalCandidates(
  query: { tickers: string[]; topics: string[] },
  cards: HistoricalCardCandidate[],
  limit: number,
): { candidates: HistoricalCardCandidate[]; reason?: string } {
  const tickers = new Set(query.tickers.map((value) => value.toUpperCase()));
  const topics = new Set(query.topics.map((value) => value.toLocaleLowerCase()));
  const candidates = cards
    .filter((card) => card.sourceActor === 'serenity')
    .filter(
      (card) =>
        card.tickers.some((ticker) => tickers.has(ticker.toUpperCase())) ||
        card.topics.some((topic) => topics.has(topic.toLocaleLowerCase())),
    )
    .slice(0, limit);
  return candidates.length > 0
    ? { candidates }
    : { candidates, reason: '历史样本不足，无法判断观点变化' };
}
