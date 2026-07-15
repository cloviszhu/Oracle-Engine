import { describe, expect, it } from 'vitest';
import { validDraft } from '../../research/research-contract.test.js';
import { runCapabilityProbe } from './capability-probe.js';

describe('AI capability probe', () => {
  it('requires a complete card, source, request id, matching model, and non-empty usage', async () => {
    const adapter = { analyze: async () => ({
      draft: validDraft, provider: 'custom', requestedModel: 'custom-model', actualModel: 'custom-model',
      providerRequestId: 'provider-request-1', requestId: 'request-1',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }, costCents: 0.01,
    }) };
    await expect(runCapabilityProbe(adapter, 'custom-model')).resolves.toMatchObject({ compatible: true, probeVersion: '1' });
    const missingUsage = { analyze: async () => ({ ...(await adapter.analyze()), usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }) };
    await expect(runCapabilityProbe(missingUsage, 'custom-model')).resolves.toMatchObject({ compatible: false, category: 'usage_missing' });
    const silentAlias = { analyze: async () => ({ ...(await adapter.analyze()), actualModel: 'custom-model-2026-07-15' }) };
    await expect(runCapabilityProbe(silentAlias, 'custom-model')).resolves.toMatchObject({ compatible: false, category: 'model_mismatch' });
  });
});
