import { randomBytes } from 'node:crypto';
import type { LauncherSettingsInput, SetupStatus, CapabilityProbeResult } from '../../shared/desktop/contracts.js';
import { createFamilyAccountDigests, type FamilyAccountDigest } from '../config/account-hasher.js';
import type { LauncherMetadata } from '../config/config-store.js';
import { validateOptionalIntegrations } from './settings-policy.js';

interface VaultLike {
  save(value: Record<string, string>): Promise<void>;
  load(): Promise<Record<string, string>>;
  getConfiguredState(): Promise<Record<string, { configured: boolean; updatedAt?: string }>>;
}
interface StoreLike { save(value: LauncherMetadata): Promise<void>; load(): Promise<LauncherMetadata | undefined> }

export class LauncherSettingsService {
  constructor(private readonly dependencies: {
    vault: VaultLike;
    store: StoreLike;
    probeAI(settings: NonNullable<LauncherSettingsInput['ai']>): Promise<CapabilityProbeResult>;
    testX(token: string): Promise<boolean>;
    testFeishu(webhookUrl: string, signingSecret: string): Promise<boolean>;
    revokeActorSessions(actorId: string): Promise<void>;
  }) {}

  async getStatus(): Promise<SetupStatus> {
    const metadata = await this.dependencies.store.load();
    if (!metadata) return { configured: false };
    const configured = await this.dependencies.vault.getConfiguredState();
    return {
      configured: Boolean(metadata.accountsConfigured), accountsConfigured: metadata.accountsConfigured,
      ai: { enabled: Boolean(metadata.ai?.enabled), configured: Boolean(configured.aiApiKey?.configured) },
      x: { enabled: Boolean(metadata.x?.enabled), configured: Boolean(configured.xBearerToken?.configured) },
      feishu: { enabled: Boolean(metadata.feishu?.enabled), configured: Boolean(configured.feishuSigningSecret?.configured) },
    };
  }

  async save(settings: LauncherSettingsInput): Promise<SetupStatus> {
    const existing = await this.loadSecrets();
    const previousAccounts = parseAccounts(existing.familyAccountsJson);
    const accounts = await createFamilyAccountDigests(settings.familyAccounts.map((account) => ({
      actorId: account.actorId, username: account.username, password: account.password ?? '',
    })), previousAccounts, this.dependencies.revokeActorSessions);
    const integrations = await validateOptionalIntegrations(settings, this.dependencies);
    if (settings.ai?.enabled) {
      const probe = await this.dependencies.probeAI({ ...settings.ai, apiKey: settings.ai.apiKey || existing.aiApiKey });
      if (!probe.compatible) throw new Error(`AI 能力验证未通过：${probe.category ?? '能力不完整'}`);
    }
    const secrets: Record<string, string> = {
      familyAccountsJson: JSON.stringify(accounts),
      sessionSecret: existing.sessionSecret ?? randomBytes(32).toString('base64url'),
    };
    if (settings.ai?.enabled) secrets.aiApiKey = settings.ai.apiKey || existing.aiApiKey || '';
    if (integrations.xEnabled) secrets.xBearerToken = settings.x?.token || existing.xBearerToken || '';
    if (integrations.feishuEnabled) {
      secrets.feishuWebhookUrl = settings.feishu?.webhookUrl ?? '';
      secrets.feishuSigningSecret = settings.feishu?.signingSecret || existing.feishuSigningSecret || '';
    }
    if (Object.values(secrets).some((value) => !value)) throw new Error('启用的服务缺少敏感配置');
    await this.dependencies.vault.save(secrets);
    await this.dependencies.store.save({
      version: 1, accountsConfigured: true, updatedAt: new Date().toISOString(),
      ...(settings.ai?.enabled ? { ai: { enabled: true, provider: settings.ai.providerPreset === 'openai' ? 'openai' : 'custom', protocol: settings.ai.protocol, model: settings.ai.model, ...(settings.ai.baseUrl ? { baseUrl: settings.ai.baseUrl } : {}) } } : {}),
      x: { enabled: integrations.xEnabled }, feishu: { enabled: integrations.feishuEnabled },
    });
    return this.getStatus();
  }

  private async loadSecrets(): Promise<Record<string, string>> {
    try { return await this.dependencies.vault.load(); } catch { return {}; }
  }
}

function parseAccounts(value?: string): FamilyAccountDigest[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as FamilyAccountDigest[] : [];
  } catch { return []; }
}
