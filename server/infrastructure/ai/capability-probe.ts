import type { ResearchModelAdapter } from '../../research/research-model.adapter.js';
import { buildResearchEnvelope } from '../../research/research-contract.js';
import { ProviderAdapterError } from './compatible-research.adapter.js';

export type CapabilityProbeResult =
  | { compatible: true; probeVersion: '1'; actualModel: string; providerRequestId: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }
  | { compatible: false; probeVersion: '1'; category: string };

export async function runCapabilityProbe(adapter: ResearchModelAdapter, requestedModel: string): Promise<CapabilityProbeResult> {
  try {
    const result = await adapter.analyze(buildResearchEnvelope({
      current: { sourceId: 'post-1', text: 'Capability probe evidence.', sourceUrl: 'https://x.com/i/web/status/1', publishedAt: '2026-07-15T00:00:00.000Z', contentType: 'post' },
      context: [], history: [], completeness: 'complete',
    }));
    if (result.requestedModel !== requestedModel || !result.actualModel.startsWith(requestedModel)) return failure('model_mismatch');
    if (!result.providerRequestId) return failure('request_id_missing');
    if (result.usage.totalTokens <= 0 || result.usage.inputTokens < 0 || result.usage.outputTokens < 0) return failure('usage_missing');
    if (result.draft.original.sourceId !== 'post-1' || result.draft.evidence.length === 0) return failure('source_schema_invalid');
    return { compatible: true, probeVersion: '1', actualModel: result.actualModel, providerRequestId: result.providerRequestId, usage: result.usage };
  } catch (error) {
    return failure(error instanceof ProviderAdapterError ? error.category : 'probe_failed');
  }
}
function failure(category: string): CapabilityProbeResult { return { compatible: false, probeVersion: '1', category }; }
