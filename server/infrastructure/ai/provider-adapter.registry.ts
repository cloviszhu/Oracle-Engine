import type { ResearchModelAdapter } from '../../research/research-model.adapter.js';
import { CompatibleResearchModelAdapter, ProviderAdapterError, type CompatibleProtocol } from './compatible-research.adapter.js';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface ProviderAdapterConfig {
  preset: 'openai' | 'custom';
  provider: string;
  protocol: CompatibleProtocol;
  baseUrl?: string;
  apiKey: string;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high';
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
  pricingVersion?: string;
  probeVersion?: string;
  probePassedAt?: string;
}

export class ProviderAdapterRegistry {
  readonly nativeBoundaries = ['anthropic-native', 'gemini-native'] as const;
  constructor(private readonly fetch: Fetch = globalThis.fetch) {}

  resolve(config: ProviderAdapterConfig): { adapter: ResearchModelAdapter; descriptor: { preset: string; protocol: CompatibleProtocol; host: string; model: string } } {
    let baseUrl: string;
    if (config.preset === 'openai') {
      if (config.provider !== 'openai') throw new ProviderAdapterError('configuration', false);
      baseUrl = normalizeProviderBaseUrl(config.baseUrl || 'https://api.openai.com');
    } else {
      if (!config.baseUrl) throw new ProviderAdapterError('configuration', false);
      baseUrl = normalizeProviderBaseUrl(config.baseUrl);
    }
    const url = new URL(baseUrl);
    const adapter = new CompatibleResearchModelAdapter({
      ...config, providerPreset: config.preset, baseUrl, pricingVersion: config.pricingVersion ?? 'user-config-v1', fetch: this.fetch,
    });
    return { adapter, descriptor: { preset: config.preset, protocol: config.protocol, host: url.host, model: config.model } };
  }
}

export function normalizeProviderBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new ProviderAdapterError('configuration', false); }
  if (url.protocol !== 'https:') throw new ProviderAdapterError('configuration', false, undefined, 'AI 服务地址必须使用 HTTPS');
  if (url.username || url.password || url.search || url.hash) {
    throw new ProviderAdapterError('configuration', false, undefined, 'AI 服务地址不得包含凭据、查询参数或片段');
  }
  return url.toString().replace(/\/+$/, '');
}
