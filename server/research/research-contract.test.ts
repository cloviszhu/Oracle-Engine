import { describe, expect, it } from 'vitest';
import {
  buildResearchEnvelope,
  createAnalysisKey,
  validateResearchCardDraft,
} from './research-contract.js';

export const validDraft = {
  original: { sourceId: 'post-1', text: 'It may improve.', sourceUrl: 'https://x.com/i/web/status/1' },
  faithfulTranslation: '这可能会改善。',
  contentType: 'post',
  serenityStatements: [{ text: 'Serenity 表示这可能改善。', sourceIds: ['post-1'] }],
  otherPartyStatements: [],
  aiInterpretations: [{ text: '这是一项带条件的判断。', sourceIds: ['post-1'] }],
  unverifiedInferences: [],
  viewpointChange: { status: 'insufficient_history', summary: '历史样本不足，无法判断观点变化', sourceIds: [] },
  entities: [{ type: 'topic', value: '测试主题', market: 'unknown', verificationStatus: 'source_supported', sourceIds: ['post-1'] }],
  evidence: [{ claim: '原文使用 may', sourceIds: ['post-1'] }],
  uncertainties: ['结果尚未确认'],
  confidence: { level: 'medium', score: 0.72 },
  importanceFeatures: { novelty: 40, materiality: 30, evidenceStrength: 60, viewpointChange: 0, urgency: 20 },
};

describe('research envelope and card contract', () => {
  it('whitelists research fields and excludes family, session, feedback, notification and raw payload data', () => {
    const envelope = buildResearchEnvelope({
      current: {
        sourceId: 'post-1', text: 'It may improve.', sourceUrl: 'https://x.com/i/web/status/1',
        publishedAt: '2026-07-15T00:00:00Z', contentType: 'post',
        rawPayload: { forbidden: true }, actorId: 'father', cookie: 'session-value',
      },
      context: [], history: [], completeness: 'complete',
      feedback: [{ note: 'private' }], webhookUrl: 'https://example.invalid/hook',
    });
    const serialized = JSON.stringify(envelope);
    expect(serialized).toContain('post-1');
    for (const forbidden of ['rawPayload', 'actorId', 'cookie', 'feedback', 'webhookUrl', 'session-value']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('accepts a layered card with valid source citations', () => {
    expect(validateResearchCardDraft(validDraft, new Set(['post-1']), 'complete')).toEqual(validDraft);
  });

  it('rejects fabricated citations, extra fields, and unjustified high confidence', () => {
    expect(() =>
      validateResearchCardDraft(
        { ...validDraft, evidence: [{ claim: 'fabricated', sourceIds: ['not-archived'] }] },
        new Set(['post-1']),
        'complete',
      ),
    ).toThrow(/source/i);
    expect(() => validateResearchCardDraft({ ...validDraft, secret: 'extra' }, new Set(['post-1']), 'complete')).toThrow();
    expect(() =>
      validateResearchCardDraft(
        { ...validDraft, confidence: { level: 'high', score: 0.98 } },
        new Set(['post-1']),
        'partial',
      ),
    ).toThrow(/confidence/i);
  });

  it('requires A-share company claims to remain explicitly unverified without source evidence', () => {
    expect(() =>
      validateResearchCardDraft(
        {
          ...validDraft,
          entities: [{
            type: 'company', value: '示例股份', market: 'a_share',
            verificationStatus: 'source_supported', sourceIds: [],
          }],
        },
        new Set(['post-1']),
        'complete',
      ),
    ).toThrow(/A-share/i);
  });

  it('rejects lost speculative wording and claims that an external link was read', () => {
    expect(() => validateResearchCardDraft(
      { ...validDraft, faithfulTranslation: '这必然改善。' },
      new Set(['post-1']),
      'complete',
    )).toThrow(/speculative/i);
    expect(() => validateResearchCardDraft(
      {
        ...validDraft,
        aiInterpretations: [{ text: '我已打开并阅读外部链接。', sourceIds: ['post-1'] }],
      },
      new Set(['post-1']),
      'complete',
    )).toThrow(/external link/i);
  });

  it('creates a stable analysis key from versioned inputs', () => {
    const left = createAnalysisKey({ contentVersionId: 'v1', contextHash: 'ctx', promptVersion: 'p1', model: 'gpt-5.6-terra' });
    const right = createAnalysisKey({ contentVersionId: 'v1', contextHash: 'ctx', promptVersion: 'p1', model: 'gpt-5.6-terra' });
    expect(left).toBe(right);
  });
});
