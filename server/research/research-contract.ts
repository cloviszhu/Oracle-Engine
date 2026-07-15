import { createHash } from 'node:crypto';
import {
  researchCardDraftSchema,
  type ResearchCardDraft,
} from '../../shared/contracts/research-card.js';

export type ContextCompleteness = 'complete' | 'partial' | 'missing';

interface ResearchSourceInput extends Record<string, unknown> {
  sourceId: string;
  text: string;
  sourceUrl: string;
  publishedAt: string;
  contentType: 'post' | 'reply' | 'quote';
}

interface RelatedResearchSource extends Record<string, unknown> {
  sourceId: string;
  text: string;
  sourceUrl?: string;
  publishedAt?: string;
  relationType: string;
}

interface HistoricalResearchSource extends Record<string, unknown> {
  sourceId: string;
  summary: string;
  publishedAt?: string;
}

export interface ResearchEnvelope {
  current: ResearchSourceInput;
  context: RelatedResearchSource[];
  history: HistoricalResearchSource[];
  completeness: ContextCompleteness;
}

export function buildResearchEnvelope(input: {
  current: ResearchSourceInput;
  context: RelatedResearchSource[];
  history: HistoricalResearchSource[];
  completeness: ContextCompleteness;
  [key: string]: unknown;
}): ResearchEnvelope {
  return {
    current: {
      sourceId: input.current.sourceId,
      text: input.current.text,
      sourceUrl: input.current.sourceUrl,
      publishedAt: input.current.publishedAt,
      contentType: input.current.contentType,
    },
    context: input.context.map((item) => ({
      sourceId: item.sourceId,
      text: item.text,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      relationType: item.relationType,
    })),
    history: input.history.map((item) => ({
      sourceId: item.sourceId,
      summary: item.summary,
      publishedAt: item.publishedAt,
    })),
    completeness: input.completeness,
  };
}

function collectSourceIds(card: ResearchCardDraft): string[] {
  return [
    card.original.sourceId,
    ...card.serenityStatements.flatMap((item) => item.sourceIds),
    ...card.otherPartyStatements.flatMap((item) => item.sourceIds),
    ...card.aiInterpretations.flatMap((item) => item.sourceIds),
    ...card.unverifiedInferences.flatMap((item) => item.sourceIds),
    ...card.viewpointChange.sourceIds,
    ...card.entities.flatMap((item) => item.sourceIds),
    ...card.evidence.flatMap((item) => item.sourceIds),
  ];
}

export function validateResearchCardDraft(
  value: unknown,
  allowedSourceIds: ReadonlySet<string>,
  completeness: ContextCompleteness,
): ResearchCardDraft {
  const card = researchCardDraftSchema.parse(value);
  const invalidSource = collectSourceIds(card).find((sourceId) => !allowedSourceIds.has(sourceId));
  if (invalidSource) throw new Error(`Research card cites an unavailable source: ${invalidSource}`);
  if (completeness !== 'complete' && card.confidence.level === 'high') {
    throw new Error('High confidence is not allowed with incomplete context');
  }
  const unsupportedAShare = card.entities.find(
    (entity) =>
      entity.type === 'company' &&
      entity.market === 'a_share' &&
      entity.verificationStatus === 'source_supported' &&
      entity.sourceIds.length === 0,
  );
  if (unsupportedAShare) throw new Error('A-share company claims require archived source evidence');
  const originalIsSpeculative = /\b(may|might|could|possibly|likely|unlikely)\b|可能|也许|或许|不确定/i
    .test(card.original.text);
  const translationPreservesUncertainty = /可能|也许|或许|不确定|大概|未必|倾向于/i
    .test(card.faithfulTranslation);
  if (originalIsSpeculative && !translationPreservesUncertainty) {
    throw new Error('Faithful translation must preserve speculative wording');
  }
  const generatedClaims = [
    ...card.aiInterpretations,
    ...card.unverifiedInferences,
    ...card.evidence.map((item) => ({ text: item.claim })),
  ];
  if (generatedClaims.some((item) =>
    /(?:I|we) (?:opened|read|visited) (?:the )?(?:external )?link|(?:已|已经)(?:打开|阅读|访问).{0,8}(?:外部)?链接/i
      .test(item.text))) {
    throw new Error('Claims of reading an external link are not allowed without a supplied source');
  }
  return card;
}

export function createAnalysisKey(input: {
  contentVersionId: string;
  contextHash: string;
  promptVersion: string;
  model: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.contentVersionId,
        input.contextHash,
        input.promptVersion,
        input.model,
      ]),
    )
    .digest('hex');
}

export function sourceIdsFromEnvelope(envelope: ResearchEnvelope): Set<string> {
  return new Set([
    envelope.current.sourceId,
    ...envelope.context.map((item) => item.sourceId),
    ...envelope.history.map((item) => item.sourceId),
  ]);
}
