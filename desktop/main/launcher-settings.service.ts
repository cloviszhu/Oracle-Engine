import { createHash, randomBytes } from 'node:crypto';
import type { AISettingsInput, LauncherSettingsInput, SetupStatus, CapabilityProbeResult } from '../../shared/desktop/contracts.js';
import { createFamilyAccountDigests, type FamilyAccountDigest } from '../config/account-hasher.js';
import type { LauncherMetadata } from '../config/config-store.js';
import { parseRuntimeConfigSnapshot, type RuntimeConfigSnapshot } from '../../server/infrastructure/runtime-config.js';
import { validateOptionalIntegrations } from './settings-policy.js';
import { normalizeProviderBaseUrl } from '../../server/infrastructure/ai/provider-adapter.registry.js';
import { aiAuthBinding, resolveBoundAIKey } from '../config/ai-auth-binding.js';
import type { LocalServicePorts } from '../runtime/local-ports.js';

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
    const secrets = await this.loadSecrets();
    const accounts = parseAccounts(secrets.familyAccountsJson);
    return {
      configured: Boolean(metadata.accountsConfigured), accountsConfigured: metadata.accountsConfigured,
      ai: { enabled: Boolean(metadata.ai?.enabled), configured: Boolean(configured.aiApiKey?.configured) },
      x: { enabled: Boolean(metadata.x?.enabled), configured: Boolean(configured.xBearerToken?.configured) },
      feishu: { enabled: Boolean(metadata.feishu?.enabled), configured: Boolean(configured.feishuSigningSecret?.configured) },
      editable: {
        familyAccounts: accounts.map(({ actorId, username }) => ({ actorId, username })),
        ...(metadata.ai ? { ai: {
          enabled: metadata.ai.enabled, providerPreset: metadata.ai.providerPreset, protocol: metadata.ai.protocol,
          baseUrl: metadata.ai.baseUrl ?? '', model: metadata.ai.model, reasoning: metadata.ai.reasoningEffort,
          inputCostPerMillionCents: metadata.ai.inputCostPerMillionCents,
          outputCostPerMillionCents: metadata.ai.outputCostPerMillionCents,
          maxRequestCostCents: metadata.ai.maxRequestCostCents, dailyBudgetCents: metadata.ai.dailyBudgetCents,
        } } : {}),
        x: { enabled: Boolean(metadata.x?.enabled), policyConfirmed: Boolean(metadata.x?.policyConfirmed) },
        feishu: { enabled: Boolean(metadata.feishu?.enabled) },
      },
    };
  }

  async save(settings: LauncherSettingsInput): Promise<SetupStatus> {
    const existing = await this.loadSecrets();
    const existingMetadata = await this.dependencies.store.load();
    const previousAccounts = parseAccounts(existing.familyAccountsJson);
    let passwordChanged = false;
    const accounts = await createFamilyAccountDigests(settings.familyAccounts.map((account) => ({
      actorId: account.actorId, username: account.username, password: account.password ?? '',
    })), previousAccounts, async (actorId) => {
      passwordChanged = true;
      await this.dependencies.revokeActorSessions(actorId).catch(() => undefined);
    });
    const effectiveSettings: LauncherSettingsInput = {
      ...settings,
      x: settings.x?.enabled ? { ...settings.x, token: settings.x.token || existing.xBearerToken } : settings.x,
      feishu: settings.feishu?.enabled ? {
        ...settings.feishu, webhookUrl: settings.feishu.webhookUrl || existing.feishuWebhookUrl,
        signingSecret: settings.feishu.signingSecret || existing.feishuSigningSecret,
      } : settings.feishu,
    };
    const integrations = await validateOptionalIntegrations(effectiveSettings, this.dependencies);
    const normalizedAI = settings.ai ? {
      ...settings.ai,
      baseUrl: settings.ai.baseUrl ? normalizeProviderBaseUrl(settings.ai.baseUrl) : '',
    } : undefined;
    let probeEvidence: NonNullable<LauncherMetadata['ai']>['probe'] | undefined;
    const effectiveAIKey = normalizedAI ? resolveBoundAIKey(normalizedAI, existingMetadata?.ai, existing.aiApiKey) : undefined;
    let aiEnabled = false;
    if (normalizedAI?.enabled) {
      if (!effectiveAIKey) throw new Error('AI 服务地址已变化，请重新输入 API Key');
      const probe = await this.dependencies.probeAI({ ...normalizedAI, apiKey: effectiveAIKey });
      if (probe.compatible && probe.actualModel && probe.providerRequestId) {
        aiEnabled = true;
        probeEvidence = {
          fingerprint: aiFingerprint(normalizedAI), actualModel: probe.actualModel,
          providerRequestId: probe.providerRequestId, passedAt: new Date().toISOString(), probeVersion: probe.probeVersion,
        };
      } else throw new Error(`AI 能力验证未通过：${probe.category ?? '能力不完整'}`);
    }
    const secrets: Record<string, string> = {
      familyAccountsJson: JSON.stringify(accounts),
      sessionSecret: passwordChanged || !existing.sessionSecret ? randomBytes(32).toString('base64url') : existing.sessionSecret,
    };
    if (normalizedAI && effectiveAIKey) secrets.aiApiKey = effectiveAIKey;
    if (integrations.xEnabled) secrets.xBearerToken = effectiveSettings.x?.token || '';
    if (integrations.feishuEnabled) {
      secrets.feishuWebhookUrl = effectiveSettings.feishu?.webhookUrl ?? '';
      secrets.feishuSigningSecret = effectiveSettings.feishu?.signingSecret ?? '';
    }
    if (Object.values(secrets).some((value) => !value)) throw new Error('启用的服务缺少敏感配置');
    await this.dependencies.vault.save(secrets);
    await this.dependencies.store.save({
      version: 1, accountsConfigured: true, updatedAt: new Date().toISOString(),
      ...(normalizedAI ? { ai: {
        enabled: aiEnabled, providerPreset: normalizedAI.providerPreset, provider: normalizedAI.providerPreset === 'openai' ? 'openai' : 'custom',
        protocol: normalizedAI.protocol, model: normalizedAI.model, ...(normalizedAI.baseUrl ? { baseUrl: normalizedAI.baseUrl } : {}),
        reasoningEffort: normalizedAI.reasoning, inputCostPerMillionCents: normalizedAI.inputCostPerMillionCents,
        outputCostPerMillionCents: normalizedAI.outputCostPerMillionCents, maxRequestCostCents: normalizedAI.maxRequestCostCents,
        dailyBudgetCents: normalizedAI.dailyBudgetCents, ...(effectiveAIKey ? { authBinding: aiAuthBinding(normalizedAI) } : {}),
        ...(probeEvidence ? { probe: probeEvidence } : {}),
      } } : {}),
      x: { enabled: integrations.xEnabled, policyConfirmed: Boolean(settings.x?.policyConfirmed) },
      feishu: { enabled: integrations.feishuEnabled, cooldownSeconds: 3_600 },
    });
    return this.getStatus();
  }

  private async loadSecrets(): Promise<Record<string, string>> {
    try { return await this.dependencies.vault.load(); } catch { return {}; }
  }

  async getRuntimeSnapshot(ports: LocalServicePorts = { api: 3000, mysql: 33060, redis: 36379 }): Promise<RuntimeConfigSnapshot> {
    const metadata = await this.dependencies.store.load();
    const secrets = await this.dependencies.vault.load();
    if (!metadata?.accountsConfigured) throw new Error('首次设置尚未完成');
    const accounts = parseAccounts(secrets.familyAccountsJson);
    const ai = metadata.ai;
    if (ai?.enabled && (!ai.probe || ai.probe.fingerprint !== aiMetadataFingerprint(ai))) {
      throw new Error('AI 配置已变化，必须重新通过能力验证');
    }
    return parseRuntimeConfigSnapshot({
      nodeEnv: 'development', port: ports.api,
      databaseUrl: `mysql://root@127.0.0.1:${ports.mysql}/serenity`, redisUrl: `redis://127.0.0.1:${ports.redis}/0`,
      familyAccounts: accounts, session: { secret: secrets.sessionSecret, ttlSeconds: 86_400 },
      appBaseUrl: `http://127.0.0.1:${ports.api}`,
      x: { bearerToken: secrets.xBearerToken, productionSyncEnabled: Boolean(metadata.x?.enabled), policyConfirmed: Boolean(metadata.x?.policyConfirmed), pollIntervalSeconds: 300, compensationIntervalSeconds: 3_600 },
      ai: {
        providerPreset: ai?.providerPreset ?? 'openai', provider: ai?.provider ?? 'openai', protocol: ai?.protocol ?? 'responses',
        baseUrl: ai?.baseUrl, model: ai?.model ?? 'gpt-5.6-terra', apiKey: ai?.enabled ? secrets.aiApiKey : undefined, dailyBudgetCents: ai?.dailyBudgetCents ?? 0,
        inputCostPerMillionCents: ai?.inputCostPerMillionCents, outputCostPerMillionCents: ai?.outputCostPerMillionCents,
        maxRequestCostCents: ai?.maxRequestCostCents, reasoningEffort: ai?.reasoningEffort ?? 'medium', pricingVersion: 'user-config-v1',
        probeVersion: ai?.probe?.probeVersion,
        probePassedAt: ai?.probe?.passedAt,
      },
      feishu: metadata.feishu?.enabled
        ? { enabled: true, webhookUrl: secrets.feishuWebhookUrl, signingSecret: secrets.feishuSigningSecret, cooldownSeconds: metadata.feishu.cooldownSeconds ?? 3_600 }
        : { enabled: false, cooldownSeconds: 3_600 },
      coreVisibilitySloMinutes: 30, importance: { threshold: 70, minimumConfidence: 0.6 },
      work: { leaseSeconds: 120, maxAttempts: 5, externalDeadlineMs: 20_000, concurrency: 4, maxContextItems: 20, maxInputChars: 50_000, maxOutputChars: 30_000, maxRawPayloadBytes: 1_000_000 },
    });
  }
}

function aiFingerprint(settings: AISettingsInput): string {
  return hashAI({
    providerPreset: settings.providerPreset, provider: settings.providerPreset === 'openai' ? 'openai' : 'custom',
    protocol: settings.protocol, baseUrl: settings.baseUrl || undefined, model: settings.model,
    reasoningEffort: settings.reasoning, inputCostPerMillionCents: settings.inputCostPerMillionCents,
    outputCostPerMillionCents: settings.outputCostPerMillionCents, maxRequestCostCents: settings.maxRequestCostCents,
    dailyBudgetCents: settings.dailyBudgetCents,
  });
}

function aiMetadataFingerprint(settings: NonNullable<LauncherMetadata['ai']>): string {
  return hashAI(Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'probe' && key !== 'enabled' && key !== 'authBinding')));
}

function hashAI(value: object): string {
  const canonical = Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function parseAccounts(value?: string): FamilyAccountDigest[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as FamilyAccountDigest[] : [];
  } catch { return []; }
}
