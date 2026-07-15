import { describe, expect, it } from 'vitest';
import { toImportanceScoreRecord } from './drizzle-importance.repository.js';

describe('importance score persistence mapping', () => {
  it('stores the versioned feature, weight and decision snapshot', () => {
    const record = toImportanceScoreRecord('score-1', {
      cardId: 'card-1', policyVersion: 'importance-v1',
      features: {
        industryRelevance: 90, novelty: 80, viewpointChange: 70,
        evidenceQuality: 85, timelinessCatalyst: 80, uncertaintyPenalty: 10,
      },
      weights: {
        industryRelevance: 0.3, novelty: 0.2, viewpointChange: 0.15,
        evidenceQuality: 0.2, timelinessCatalyst: 0.15, uncertaintyPenalty: 0.2,
      },
      totalScore: 80.5, threshold: 70, minimumConfidence: 0.6, confidenceScore: 0.8,
      decision: 'notify_candidate', reason: 'importance-v1: qualified',
      notificationCandidate: { cardId: 'card-1', policyVersion: 'importance-v1' },
    }, new Date('2026-07-15T00:00:00Z'));

    expect(record).toEqual({
      id: 'score-1', cardId: 'card-1', policyVersion: 'importance-v1',
      features: {
        industryRelevance: 90, novelty: 80, viewpointChange: 70,
        evidenceQuality: 85, timelinessCatalyst: 80, uncertaintyPenalty: 10,
      },
      weights: {
        industryRelevance: 0.3, novelty: 0.2, viewpointChange: 0.15,
        evidenceQuality: 0.2, timelinessCatalyst: 0.15, uncertaintyPenalty: 0.2,
      },
      totalScore: '80.500', threshold: '70.000', decision: 'notify_candidate',
      reason: 'importance-v1: qualified', createdAt: new Date('2026-07-15T00:00:00Z'),
    });
  });
});
