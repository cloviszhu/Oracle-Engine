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
}

export class ProviderAdapterRegistry {
  readonly nativeBoundaries = ['anthropic-native', 'gemini-native'] as const;
  constructor(private readonly fetch: Fetch = globalThis.fetch) {}

  resolve(config: ProviderAdapterConfig): { adapter: ResearchModelAdapter; descriptor: { preset: string; protocol: CompatibleProtocol; host: string; model: string } } {
    let baseUrl: string;
    if (config.preset === 'openai') {
      if (config.provider !== 'openai' || config.protocol !== 'responses' || config.model !== 'gpt-5.6-terra' || config.baseUrl) {
        throw new ProviderAdapterError('configuration', false, undefined, 'OpenAI 官方预设固定使用 Responses、官方地址和 gpt-5.6-terra');
      }
      baseUrl = 'https://api.openai.com';
    } else {
      if (!config.baseUrl) throw new ProviderAdapterError('configuration', false);
      baseUrl = config.baseUrl;
    }
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new ProviderAdapterError('configuration', false); }
    if (url.protocol !== 'https:') throw new Error('自定义 AI 服务地址必须使用 HTTPS');
    const adapter = new CompatibleResearchModelAdapter({
      ...config, baseUrl, pricingVersion: config.pricingVersion ?? 'user-config-v1', fetch: this.fetch,
    });
    return { adapter, descriptor: { preset: config.preset, protocol: config.protocol, host: url.host, model: config.model } };
  }
}
