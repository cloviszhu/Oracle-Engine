import type { AISettingsInput } from '../../shared/desktop/contracts.js';
import { normalizeProviderBaseUrl } from '../../server/infrastructure/ai/provider-adapter.registry.js';

type EndpointSettings = Pick<AISettingsInput, 'providerPreset' | 'baseUrl'>;

export function aiAuthBinding(settings: EndpointSettings): string {
  const baseUrl = settings.baseUrl || (settings.providerPreset === 'openai' ? 'https://api.openai.com' : '');
  if (!baseUrl) return `${settings.providerPreset}|missing`;
  return `${settings.providerPreset}|${new URL(normalizeProviderBaseUrl(baseUrl)).origin}`;
}

export function resolveBoundAIKey(
  settings: EndpointSettings & { apiKey?: string },
  saved: { authBinding?: string } | undefined,
  storedKey: string | undefined,
): string | undefined {
  if (settings.apiKey) return settings.apiKey;
  return saved?.authBinding === aiAuthBinding(settings) ? storedKey : undefined;
}
