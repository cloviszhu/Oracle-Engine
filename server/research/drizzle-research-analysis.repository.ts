import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  cardEntities,
  externalUsage,
  researchCards,
} from '../../drizzle/schema.js';
import type { createDatabase } from '../infrastructure/database/client.js';
import type {
  ResearchAnalysisRepository,
  ResearchAnalysisTarget,
} from './research-analysis.service.js';
import type { ResearchModelResult } from './research-model.adapter.js';

type Database = ReturnType<typeof createDatabase>;

export function toResearchCardRecord(
  id: string,
  target: ResearchAnalysisTarget,
  result: ResearchModelResult,
) {
  return {
    id,
    contentId: target.contentId,
    contentVersionId: target.contentVersionId,
    version: target.cardVersion,
    analysisKey: target.analysisKey,
    translation: result.draft.faithfulTranslation,
    authorJudgment: result.draft.serenityStatements,
    othersContent: result.draft.otherPartyStatements,
    aiExplanation: result.draft.aiInterpretations,
    unverifiedInferences: result.draft.unverifiedInferences,
    viewpointChange: result.draft.viewpointChange.summary,
    evidence: result.draft.evidence,
    uncertainties: result.draft.uncertainties,
    confidence: result.draft.confidence.level,
    confidenceScore: result.draft.confidence.score.toFixed(4),
    promptVersion: target.promptVersion,
    provider: result.provider,
    model: result.actualModel,
    providerRequestId: result.providerRequestId,
    createdAt: new Date(),
  };
}

export function toExternalUsageRecord(
  id: string,
  result: ResearchModelResult,
  occurredAt: Date,
) {
  return {
    id,
    provider: result.provider,
    operation: 'research_card',
    apiVersion: result.audit?.protocol === 'chat_completions' ? 'chat-completions-v1' : 'responses-v1',
    requestedModel: result.requestedModel,
    model: result.actualModel,
    providerRequestId: result.providerRequestId,
    requestId: result.requestId,
    status: 'succeeded',
    inputUnits: result.usage.inputTokens,
    outputUnits: result.usage.outputTokens,
    resourceUnits: result.usage.totalTokens,
    costCents: result.costCents.toFixed(4),
    ...(result.audit ? {
      protocol: result.audit.protocol,
      providerHost: result.audit.providerHost,
      pricingVersion: result.audit.pricingVersion,
      promptVersion: result.audit.promptVersion,
      schemaVersion: result.audit.schemaVersion,
      probeVersion: result.audit.probeVersion,
    } : {}),
    occurredAt,
  };
}

export class DrizzleResearchAnalysisRepository implements ResearchAnalysisRepository {
  constructor(private readonly database: Database) {}

  async findSucceeded(analysisKey: string): Promise<unknown | undefined> {
    const [card] = await this.database
      .select()
      .from(researchCards)
      .where(eq(researchCards.analysisKey, analysisKey))
      .limit(1);
    return card;
  }

  async saveSucceeded(
    target: ResearchAnalysisTarget,
    result: ResearchModelResult,
  ): Promise<unknown> {
    return this.database.transaction(async (transaction) => {
      const proposedCardId = randomUUID();
      await transaction
        .insert(researchCards)
        .values(toResearchCardRecord(proposedCardId, target, result))
        .onDuplicateKeyUpdate({ set: { analysisKey: target.analysisKey } });
      const [card] = await transaction
        .select()
        .from(researchCards)
        .where(eq(researchCards.analysisKey, target.analysisKey))
        .limit(1);
      if (!card) throw new Error('Research card persistence did not return a record');

      for (const entity of result.draft.entities) {
        const verificationStatus = entity.verificationStatus === 'source_supported'
          ? 'verified_source' as const
          : entity.verificationStatus;
        await transaction
          .insert(cardEntities)
          .values({
            id: randomUUID(),
            cardId: card.id,
            type: entity.type,
            normalizedValue: entity.value.trim().toLocaleLowerCase('en-US'),
            displayValue: entity.value,
            verificationStatus,
          })
          .onDuplicateKeyUpdate({ set: { displayValue: entity.value, verificationStatus } });
      }
      await transaction.insert(externalUsage).values(
        toExternalUsageRecord(randomUUID(), result, new Date()),
      );
      return card;
    });
  }
}
