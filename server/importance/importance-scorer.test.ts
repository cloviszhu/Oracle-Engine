import { describe, expect, it, vi } from 'vitest';
import {
  ImportanceScoringService,
  scoreImportance,
  type ImportancePolicy,
} from './importance-scorer.js';

const policy: ImportancePolicy = {
  version: 'importance-v1',
  threshold: 70,
  minimumConfidence: 0.6,
  weights: {
    industryRelevance: 0.3,
    novelty: 0.2,
    viewpointChange: 0.15,
    evidenceQuality: 0.2,
    timelinessCatalyst: 0.15,
    uncertaintyPenalty: 0.2,
  },
};

describe('deterministic importance scoring', () => {
  it('creates an explainable notification candidate for a high-value card', () => {
    const result = scoreImportance({
      cardId: 'card-high', confidenceScore: 0.8,
      features: {
        industryRelevance: 90, novelty: 80, viewpointChange: 70,
        evidenceQuality: 85, timelinessCatalyst: 80, uncertaintyPenalty: 10,
      },
      modelRecommendation: 'suppress',
    }, policy);

    expect(result.totalScore).toBe(80.5);
    expect(result.decision).toBe('notify_candidate');
    expect(result.reason).toContain('importance-v1');
    expect(result.weights).toEqual(policy.weights);
    expect(result.threshold).toBe(70);
  });

  it('archives a low-value card without creating a notification candidate', () => {
    const result = scoreImportance({
      cardId: 'card-low', confidenceScore: 0.9,
      features: {
        industryRelevance: 20, novelty: 10, viewpointChange: 0,
        evidenceQuality: 50, timelinessCatalyst: 10, uncertaintyPenalty: 20,
      },
      modelRecommendation: 'notify',
    }, policy);
    expect(result.decision).toBe('suppress');
    expect(result.notificationCandidate).toBeUndefined();
  });

  it('uses inclusive score and confidence boundaries', () => {
    const boundaryPolicy = {
      ...policy,
      threshold: 50,
      weights: { ...policy.weights, industryRelevance: 1, novelty: 0, viewpointChange: 0, evidenceQuality: 0, timelinessCatalyst: 0, uncertaintyPenalty: 0 },
    };
    const result = scoreImportance({
      cardId: 'card-boundary', confidenceScore: 0.6,
      features: {
        industryRelevance: 50, novelty: 0, viewpointChange: 0,
        evidenceQuality: 0, timelinessCatalyst: 0, uncertaintyPenalty: 100,
      },
    }, boundaryPolicy);
    expect(result.decision).toBe('notify_candidate');
  });

  it('suppresses a high score when analysis confidence is below policy', () => {
    const result = scoreImportance({
      cardId: 'card-low-confidence', confidenceScore: 0.59,
      features: {
        industryRelevance: 100, novelty: 100, viewpointChange: 100,
        evidenceQuality: 100, timelinessCatalyst: 100, uncertaintyPenalty: 0,
      },
    }, policy);
    expect(result.decision).toBe('suppress');
    expect(result.reason).toContain('confidence');
  });

  it('persists the scoring fact through a repository-only service boundary', async () => {
    const repository = { save: vi.fn().mockResolvedValue({ id: 'score-1' }) };
    const service = new ImportanceScoringService(repository, policy);
    const result = await service.score({
      cardId: 'card-high', confidenceScore: 0.8,
      features: {
        industryRelevance: 90, novelty: 80, viewpointChange: 70,
        evidenceQuality: 85, timelinessCatalyst: 80, uncertaintyPenalty: 10,
      },
    });

    expect(repository.save).toHaveBeenCalledOnce();
    expect(result).toEqual({ id: 'score-1' });
  });
});
