import type { RuntimeConfigSnapshot } from './runtime-config.js';

export function runtimeSnapshotToEnvironment(config: RuntimeConfigSnapshot): Record<string, string> {
  return {
    NODE_ENV: config.nodeEnv, PORT: String(config.port), DATABASE_URL: config.databaseUrl, REDIS_URL: config.redisUrl,
    FAMILY_ACCOUNTS_JSON: JSON.stringify(config.familyAccounts), SESSION_SECRET: config.session.secret,
    SESSION_TTL_SECONDS: String(config.session.ttlSeconds), APP_BASE_URL: config.appBaseUrl,
    X_API_BEARER_TOKEN: config.x.bearerToken ?? '', X_PRODUCTION_SYNC_ENABLED: String(config.x.productionSyncEnabled),
    X_POLICY_CONFIRMED: String(config.x.policyConfirmed), X_POLL_INTERVAL_SECONDS: String(config.x.pollIntervalSeconds),
    X_COMPENSATION_INTERVAL_SECONDS: String(config.x.compensationIntervalSeconds),
    AI_PROVIDER_PRESET: config.ai.providerPreset, AI_PROVIDER: config.ai.provider, AI_PROTOCOL: config.ai.protocol,
    AI_BASE_URL: config.ai.baseUrl ?? '', AI_MODEL: config.ai.model, OPENAI_MODEL: config.ai.providerPreset === 'openai' ? config.ai.model : '', AI_PROBE_VERSION: config.ai.probeVersion ?? '', AI_PROBE_PASSED_AT: config.ai.probePassedAt ?? '',
    AI_PROVIDER_API_KEY: config.ai.apiKey ?? '', OPENAI_INPUT_COST_PER_MILLION_CENTS: String(config.ai.inputCostPerMillionCents ?? ''),
    OPENAI_OUTPUT_COST_PER_MILLION_CENTS: String(config.ai.outputCostPerMillionCents ?? ''),
    AI_MAX_REQUEST_COST_CENTS: String(config.ai.maxRequestCostCents ?? ''), AI_DAILY_BUDGET_CENTS: String(config.ai.dailyBudgetCents),
    AI_REASONING_EFFORT: config.ai.reasoningEffort, AI_PRICING_VERSION: config.ai.pricingVersion,
    FEISHU_ENABLED: String(config.feishu.enabled), FEISHU_WEBHOOK_URL: config.feishu.enabled ? config.feishu.webhookUrl : '',
    FEISHU_SIGNING_SECRET: config.feishu.enabled ? config.feishu.signingSecret : '', FEISHU_COOLDOWN_SECONDS: String(config.feishu.cooldownSeconds),
    CORE_VISIBILITY_SLO_MINUTES: String(config.coreVisibilitySloMinutes), IMPORTANCE_THRESHOLD: String(config.importance.threshold),
    MIN_ANALYSIS_CONFIDENCE: String(config.importance.minimumConfidence), LEASE_SECONDS: String(config.work.leaseSeconds),
    MAX_ATTEMPTS: String(config.work.maxAttempts), EXTERNAL_DEADLINE_MS: String(config.work.externalDeadlineMs),
    WORKER_CONCURRENCY: String(config.work.concurrency), MAX_CONTEXT_ITEMS: String(config.work.maxContextItems),
    MAX_INPUT_CHARS: String(config.work.maxInputChars), MAX_OUTPUT_CHARS: String(config.work.maxOutputChars),
    MAX_RAW_PAYLOAD_BYTES: String(config.work.maxRawPayloadBytes),
  };
}
