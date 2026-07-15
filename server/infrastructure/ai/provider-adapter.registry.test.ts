import { describe, expect, it, vi } from 'vitest';
import { ProviderAdapterRegistry } from './provider-adapter.registry.js';

const testCredential = 'provider-test-credential';
const common = {
  apiKey: testCredential, model: 'custom-model', reasoningEffort: 'medium' as const,
  inputCostPerMillionCents: 10, outputCostPerMillionCents: 20,
};

describe('ProviderAdapterRegistry', () => {
  it('keeps the official OpenAI preset fixed and registers both compatible protocols', () => {
    const registry = new ProviderAdapterRegistry(vi.fn());
    expect(registry.resolve({ ...common, preset: 'openai', protocol: 'responses', provider: 'openai', model: 'gpt-5.6-terra' }).descriptor)
      .toMatchObject({ preset: 'openai', protocol: 'responses', host: 'api.openai.com', model: 'gpt-5.6-terra' });
    expect(registry.resolve({ ...common, preset: 'custom', protocol: 'chat_completions', provider: 'local-compatible', baseUrl: 'https://models.example.test' }).descriptor)
      .toMatchObject({ preset: 'custom', protocol: 'chat_completions', host: 'models.example.test' });
  });

  it('rejects invalid preset combinations and never falls back to another adapter', () => {
    const registry = new ProviderAdapterRegistry(vi.fn());
    expect(() => registry.resolve({ ...common, preset: 'openai', protocol: 'chat_completions', provider: 'openai' })).toThrow(/OpenAI 官方预设/);
    expect(() => registry.resolve({ ...common, preset: 'custom', protocol: 'responses', provider: 'custom', baseUrl: 'http://insecure.example' })).toThrow(/HTTPS/);
    expect(registry.nativeBoundaries).toEqual(['anthropic-native', 'gemini-native']);
  });
});
