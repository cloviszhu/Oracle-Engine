import type { ResearchCardDraft } from '../../shared/contracts/research-card.js';
import type { ResearchEnvelope } from './research-contract.js';

export interface ResearchModelResult {
  draft: ResearchCardDraft;
  provider: string;
  requestedModel: string;
  actualModel: string;
  providerRequestId: string;
  requestId?: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  costCents: number;
  audit?: {
    protocol: 'responses' | 'chat_completions';
    providerHost: string;
    pricingVersion: string;
    promptVersion?: string;
    schemaVersion: string;
    probeVersion?: string;
  };
}

export interface ResearchModelAdapter {
  analyze(envelope: ResearchEnvelope): Promise<ResearchModelResult>;
}
