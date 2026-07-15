import { describe, expect, it, vi } from 'vitest';
import { ProviderAdapterRegistry } from './provider-adapter.registry.js';

const testCredential = 'provider-test-credential';
const common = {
  apiKey: testCredential, model: 'custom-model', reasoningEffort: 'medium' as const,
  inputCostPerMillionCents: 10, outputCostPerMillionCents: 20,
};

describe('ProviderAdapterRegistry', () => {
  it('uses safe official defaults while allowing approved model, protocol, and HTTPS endpoint overrides', () => {
    const registry = new ProviderAdapterRegistry(vi.fn());
    expect(registry.resolve({ ...common, preset: 'openai', protocol: 'responses', provider: 'openai', model: 'gpt-5.6-terra' }).descriptor)
      .toMatchObject({ preset: 'openai', protocol: 'responses', host: 'api.openai.com', model: 'gpt-5.6-terra' });
    expect(registry.resolve({ ...common, preset: 'custom', protocol: 'chat_completions', provider: 'local-compatible', baseUrl: 'https://models.example.test' }).descriptor)
      .toMatchObject({ preset: 'custom', protocol: 'chat_completions', host: 'models.example.test' });
    expect(registry.resolve({ ...common, preset: 'openai', protocol: 'chat_completions', provider: 'openai', baseUrl: 'https://gateway.example.test/openai/' }).descriptor)
      .toMatchObject({ preset: 'openai', protocol: 'chat_completions', host: 'gateway.example.test', model: 'custom-model' });
  });

  it('rejects invalid preset combinations and never falls back to another adapter', () => {
    const registry = new ProviderAdapterRegistry(vi.fn());
    expect(() => registry.resolve({ ...common, preset: 'openai', protocol: 'responses', provider: 'custom' })).toThrow();
    expect(() => registry.resolve({ ...common, preset: 'custom', protocol: 'responses', provider: 'custom', baseUrl: 'http://insecure.example' })).toThrow(/HTTPS/);
    expect(() => registry.resolve({ ...common, preset: 'custom', protocol: 'responses', provider: 'custom', baseUrl: 'https://user:pass@models.example.test' })).toThrow(/凭据/);
    expect(() => registry.resolve({ ...common, preset: 'custom', protocol: 'responses', provider: 'custom', baseUrl: 'https://models.example.test?api_key=secret' })).toThrow(/查询参数/);
    expect(registry.nativeBoundaries).toEqual(['anthropic-native', 'gemini-native']);
  });
});
