import { describe, expect, it, vi } from 'vitest';
import { validDraft } from '../../research/research-contract.test.js';
import { buildResearchEnvelope } from '../../research/research-contract.js';
import { CompatibleResearchModelAdapter, ProviderAdapterError } from './compatible-research.adapter.js';

const envelope = buildResearchEnvelope({
  current: { sourceId: 'post-1', text: 'evidence', sourceUrl: 'https://x.com/i/web/status/1', publishedAt: '2026-07-15T00:00:00Z', contentType: 'post' },
  context: [], history: [], completeness: 'complete',
});
const testCredential = 'compatible-test-credential';
const base = {
  provider: 'custom', baseUrl: 'https://models.example.test', apiKey: testCredential,
  model: 'custom-model', reasoningEffort: 'medium' as const, inputCostPerMillionCents: 100,
  outputCostPerMillionCents: 200, pricingVersion: 'user-2026-07-15',
};

describe('CompatibleResearchModelAdapter', () => {
  it.each([
    ['responses', '/v1/responses', 'text'],
    ['chat_completions', '/v1/chat/completions', 'response_format'],
  ] as const)('uses strict schema and disables tools for %s', async (protocol, path, schemaField) => {
    const body = protocol === 'responses'
      ? { id: 'resp-1', model: 'custom-model', status: 'completed', output_text: JSON.stringify(validDraft), usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } }
      : { id: 'chat-1', model: 'custom-model', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validDraft) } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'x-request-id': 'request-1' } }));
    const adapter = new CompatibleResearchModelAdapter({ ...base, protocol, fetch });
    const result = await adapter.analyze(envelope);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    const request = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(url).toBe(`https://models.example.test${path}`);
    expect(request.tools).toEqual([]);
    expect(request).toHaveProperty(schemaField);
    expect(JSON.stringify(request)).toContain('"strict":true');
    expect(result).toMatchObject({ actualModel: 'custom-model', providerRequestId: expect.any(String), usage: { totalTokens: 30 } });
  });

  it.each([
    [{ id: 'r', model: 'custom-model', status: 'incomplete', incomplete_details: {} }, 'incomplete'],
    [{ id: 'r', model: 'custom-model', status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'no' }] }] }, 'refusal'],
    [{ id: 'r', model: 'wrong-model', status: 'completed', output_text: JSON.stringify(validDraft), usage: {} }, 'capability'],
  ])('classifies incomplete, refusal, and model mismatch without fallback', async (body, category) => {
    const adapter = new CompatibleResearchModelAdapter({ ...base, protocol: 'responses', fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(body))) });
    const error = await adapter.analyze(envelope).catch((value: unknown) => value) as ProviderAdapterError;
    expect(error.category).toBe(category);
  });
});
