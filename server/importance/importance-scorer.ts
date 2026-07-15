export interface ImportanceFeatures {
  industryRelevance: number;
  novelty: number;
  viewpointChange: number;
  evidenceQuality: number;
  timelinessCatalyst: number;
  uncertaintyPenalty: number;
}

export interface ImportancePolicy {
  version: string;
  threshold: number;
  minimumConfidence: number;
  weights: ImportanceFeatures;
}

export interface ImportanceInput {
  cardId: string;
  confidenceScore: number;
  features: ImportanceFeatures;
  modelRecommendation?: 'notify' | 'suppress';
}

export interface ImportanceScoreFact {
  cardId: string;
  policyVersion: string;
  features: ImportanceFeatures;
  weights: ImportanceFeatures;
  totalScore: number;
  threshold: number;
  minimumConfidence: number;
  confidenceScore: number;
  decision: 'notify_candidate' | 'suppress';
  reason: string;
  notificationCandidate?: { cardId: string; policyVersion: string };
}

const POSITIVE_FEATURES: Array<Exclude<keyof ImportanceFeatures, 'uncertaintyPenalty'>> = [
  'industryRelevance',
  'novelty',
  'viewpointChange',
  'evidenceQuality',
  'timelinessCatalyst',
];

export function scoreImportance(
  input: ImportanceInput,
  policy: ImportancePolicy,
): ImportanceScoreFact {
  validatePolicyAndInput(input, policy);
  const positive = POSITIVE_FEATURES.reduce(
    (total, key) => total + input.features[key] * policy.weights[key],
    0,
  );
  const penalized = positive
    - input.features.uncertaintyPenalty * policy.weights.uncertaintyPenalty;
  const totalScore = roundScore(Math.max(0, Math.min(100, penalized)));
  const scoreQualified = totalScore >= policy.threshold;
  const confidenceQualified = input.confidenceScore >= policy.minimumConfidence;
  const decision = scoreQualified && confidenceQualified
    ? 'notify_candidate' as const
    : 'suppress' as const;
  const reason = decision === 'notify_candidate'
    ? `${policy.version}: score ${totalScore} >= ${policy.threshold}; confidence ${input.confidenceScore} >= ${policy.minimumConfidence}`
    : `${policy.version}: ${scoreQualified ? 'confidence below threshold' : 'score below threshold'}`;
  return {
    cardId: input.cardId,
    policyVersion: policy.version,
    features: { ...input.features },
    weights: { ...policy.weights },
    totalScore,
    threshold: policy.threshold,
    minimumConfidence: policy.minimumConfidence,
    confidenceScore: input.confidenceScore,
    decision,
    reason,
    ...(decision === 'notify_candidate'
      ? { notificationCandidate: { cardId: input.cardId, policyVersion: policy.version } }
      : {}),
  };
}

interface ImportanceScoreRepository {
  save(fact: ImportanceScoreFact): Promise<unknown>;
}

export class ImportanceScoringService {
  constructor(
    private readonly repository: ImportanceScoreRepository,
    private readonly policy: ImportancePolicy,
  ) {}

  async score(input: ImportanceInput): Promise<unknown> {
    return this.repository.save(scoreImportance(input, this.policy));
  }
}

function validatePolicyAndInput(input: ImportanceInput, policy: ImportancePolicy): void {
  if (!policy.version.trim()) throw new Error('importance policy version is required');
  for (const [name, value] of Object.entries(input.features)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${name} must be between 0 and 100`);
    }
  }
  for (const [name, value] of Object.entries(policy.weights)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${name} weight must be between 0 and 1`);
    }
  }
  if (!Number.isFinite(policy.threshold) || policy.threshold < 0 || policy.threshold > 100) {
    throw new Error('importance threshold must be between 0 and 100');
  }
  if (
    !Number.isFinite(input.confidenceScore)
    || input.confidenceScore < 0
    || input.confidenceScore > 1
    || !Number.isFinite(policy.minimumConfidence)
    || policy.minimumConfidence < 0
    || policy.minimumConfidence > 1
  ) {
    throw new Error('confidence must be between 0 and 1');
  }
}

function roundScore(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
