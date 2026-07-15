import { describe, expect, it } from 'vitest';
import { validDraft } from './research-contract.test.js';
import {
  toExternalUsageRecord,
  toResearchCardRecord,
} from './drizzle-research-analysis.repository.js';

const target = {
  analysisKey: 'key-1', contentId: 'content-1', contentVersionId: 'version-1',
  cardVersion: 1, promptVersion: 'research-v1',
};
const result = {
  draft: validDraft,
  provider: 'openai', requestedModel: 'gpt-5.6-terra', actualModel: 'gpt-5.6-terra-2026-07-01',
  providerRequestId: 'resp-1', requestId: 'request-1',
  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, costCents: 0.1,
};

describe('research audit persistence mapping', () => {
  it('maps the layered card without collapsing author, other-party and AI claims', () => {
    expect(toResearchCardRecord('card-1', target, result)).toMatchObject({
      id: 'card-1', analysisKey: 'key-1', authorJudgment: validDraft.serenityStatements,
      othersContent: validDraft.otherPartyStatements, aiExplanation: validDraft.aiInterpretations,
      unverifiedInferences: validDraft.unverifiedInferences, promptVersion: 'research-v1',
      provider: 'openai', model: 'gpt-5.6-terra-2026-07-01', providerRequestId: 'resp-1',
    });
  });

  it('preserves requested/actual model, request ids, token usage and cost in the audit record', () => {
    expect(toExternalUsageRecord('usage-1', result, new Date('2026-07-15T00:00:00Z'))).toEqual({
      id: 'usage-1', provider: 'openai', operation: 'research_card', apiVersion: 'responses-v1',
      requestedModel: 'gpt-5.6-terra', model: 'gpt-5.6-terra-2026-07-01',
      providerRequestId: 'resp-1', requestId: 'request-1', status: 'succeeded',
      inputUnits: 100, outputUnits: 50, resourceUnits: 150, costCents: '0.1000',
      occurredAt: new Date('2026-07-15T00:00:00Z'),
    });
  });

  it('persists compatible protocol, host, user pricing, prompt, schema, and probe versions', () => {
    const audited = toExternalUsageRecord('usage-2', {
      ...result,
      audit: {
        protocol: 'chat_completions' as const, providerHost: 'models.example.test',
        pricingVersion: 'user-2026-07-15', promptVersion: 'research-prompt-v1',
        schemaVersion: 'research-card-v1', probeVersion: '1',
      },
    }, new Date('2026-07-15T00:00:00Z'));
    expect(audited).toMatchObject({
      apiVersion: 'chat-completions-v1', protocol: 'chat_completions', providerHost: 'models.example.test',
      pricingVersion: 'user-2026-07-15', promptVersion: 'research-prompt-v1',
      schemaVersion: 'research-card-v1', probeVersion: '1',
    });
  });
});
