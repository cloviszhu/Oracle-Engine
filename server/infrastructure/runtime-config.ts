import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
const optionalNonnegativeNumber = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.number().nonnegative().max(100_000_000).optional(),
);
const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const positiveInteger = (defaultValue: number, maximum: number) =>
  z.coerce.number().int().positive().max(maximum).default(defaultValue);

const familyAccountSchema = z
  .object({
    actorId: z.string().min(1).max(64),
    username: z.string().min(1).max(64),
    passwordScrypt: z.string().startsWith('scrypt$').max(512),
  })
  .strict();

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positiveInteger(3000, 65_535),
    DATABASE_URL: z.string().url().startsWith('mysql://'),
    REDIS_URL: z.string().url().startsWith('redis://'),
    FAMILY_ACCOUNTS_JSON: z.string().transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: 'custom', message: 'FAMILY_ACCOUNTS_JSON must be valid JSON' });
        return z.NEVER;
      }
    }).pipe(z.array(familyAccountSchema).length(2)),
    SESSION_SECRET: z.string().min(32),
    SESSION_TTL_SECONDS: positiveInteger(86_400, 2_592_000),
    APP_BASE_URL: z.string().url(),
    X_API_BEARER_TOKEN: optionalString,
    X_PRODUCTION_SYNC_ENABLED: booleanString,
    X_POLICY_CONFIRMED: booleanString,
    X_POLL_INTERVAL_SECONDS: positiveInteger(300, 86_400),
    X_COMPENSATION_INTERVAL_SECONDS: positiveInteger(3_600, 604_800),
    AI_PROVIDER_PRESET: z.enum(['openai', 'custom']).default('openai'),
    AI_PROVIDER: z.string().trim().min(1).max(64).default('openai'),
    AI_PROTOCOL: z.enum(['responses', 'chat_completions']).default('responses'),
    AI_BASE_URL: optionalString,
    AI_MODEL: optionalString,
    OPENAI_MODEL: optionalString,
    OPENAI_API_KEY: optionalString,
    AI_PROVIDER_API_KEY: optionalString,
    OPENAI_INPUT_COST_PER_MILLION_CENTS: optionalNonnegativeNumber,
    OPENAI_OUTPUT_COST_PER_MILLION_CENTS: optionalNonnegativeNumber,
    AI_MAX_REQUEST_COST_CENTS: optionalNonnegativeNumber,
    AI_DAILY_BUDGET_CENTS: z.coerce.number().int().nonnegative().max(10_000_000).default(0),
    AI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
    AI_PRICING_VERSION: z.string().trim().min(1).max(64).default('user-config-v1'),
    FEISHU_ENABLED: booleanString,
    FEISHU_WEBHOOK_URL: optionalString,
    FEISHU_SIGNING_SECRET: optionalString,
    FEISHU_COOLDOWN_SECONDS: positiveInteger(3_600, 604_800),
    CORE_VISIBILITY_SLO_MINUTES: positiveInteger(30, 1_440),
    IMPORTANCE_THRESHOLD: z.coerce.number().min(0).max(100).default(70),
    MIN_ANALYSIS_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
    LEASE_SECONDS: positiveInteger(120, 3_600),
    MAX_ATTEMPTS: positiveInteger(5, 100),
    EXTERNAL_DEADLINE_MS: positiveInteger(20_000, 120_000),
    WORKER_CONCURRENCY: positiveInteger(4, 64),
    MAX_CONTEXT_ITEMS: positiveInteger(20, 200),
    MAX_INPUT_CHARS: positiveInteger(50_000, 1_000_000),
    MAX_OUTPUT_CHARS: positiveInteger(30_000, 1_000_000),
    MAX_RAW_PAYLOAD_BYTES: positiveInteger(1_000_000, 10_000_000),
  })
  .passthrough()
  .superRefine((value, context) => {
    const actors = new Set(value.FAMILY_ACCOUNTS_JSON.map((account) => account.actorId));
    const usernames = new Set(value.FAMILY_ACCOUNTS_JSON.map((account) => account.username));
    if (actors.size !== 2 || usernames.size !== 2) {
      context.addIssue({ code: 'custom', message: 'FAMILY_ACCOUNTS_JSON requires unique actors and usernames' });
    }
    if (value.NODE_ENV === 'production' && !value.APP_BASE_URL.startsWith('https://')) {
      context.addIssue({ code: 'custom', message: 'APP_BASE_URL must use HTTPS in production' });
    }
    if (value.X_PRODUCTION_SYNC_ENABLED && (!value.X_API_BEARER_TOKEN || !value.X_POLICY_CONFIRMED)) {
      context.addIssue({
        code: 'custom',
        message: 'X_API_BEARER_TOKEN and X_POLICY_CONFIRMED=true are required for production sync',
      });
    }
    if (value.FEISHU_ENABLED && (!value.FEISHU_WEBHOOK_URL || !value.FEISHU_SIGNING_SECRET)) {
      context.addIssue({
        code: 'custom',
        message: 'FEISHU_WEBHOOK_URL and FEISHU_SIGNING_SECRET are required when Feishu is enabled',
      });
    }
    const aiModel = value.AI_MODEL ?? value.OPENAI_MODEL ?? 'gpt-5.6-terra';
    const aiApiKey = value.AI_PROVIDER_API_KEY ?? value.OPENAI_API_KEY;
    if (value.AI_PROVIDER_PRESET === 'openai' && (
      value.AI_PROVIDER !== 'openai' || value.AI_PROTOCOL !== 'responses' || aiModel !== 'gpt-5.6-terra' || value.AI_BASE_URL
    )) {
      context.addIssue({ code: 'custom', message: 'AI_PROVIDER, AI_PROTOCOL and OPENAI_MODEL for the OpenAI official preset must use openai/responses/gpt-5.6-terra without AI_BASE_URL' });
    }
    if (value.AI_PROVIDER_PRESET === 'custom' && (!value.AI_BASE_URL || !value.AI_MODEL)) {
      context.addIssue({ code: 'custom', message: 'AI_BASE_URL and AI_MODEL are required for a custom provider preset' });
    }
    if (value.AI_BASE_URL) {
      try {
        if (new URL(value.AI_BASE_URL).protocol !== 'https:') context.addIssue({ code: 'custom', message: 'AI_BASE_URL must use HTTPS' });
      } catch { context.addIssue({ code: 'custom', message: 'AI_BASE_URL must be a valid HTTPS URL' }); }
    }
    if (value.AI_PROVIDER_API_KEY && value.OPENAI_API_KEY) {
      context.addIssue({ code: 'custom', message: 'Configure only one AI provider API key field' });
    }
    if (aiApiKey && (
      value.OPENAI_INPUT_COST_PER_MILLION_CENTS === undefined
      || value.OPENAI_OUTPUT_COST_PER_MILLION_CENTS === undefined
      || value.AI_MAX_REQUEST_COST_CENTS === undefined
    )) {
      context.addIssue({
        code: 'custom',
        message: 'OPENAI_INPUT_COST, OPENAI_OUTPUT_COST and AI_MAX_REQUEST_COST are required when OpenAI is enabled',
      });
    }
    if (value.FEISHU_WEBHOOK_URL && !value.FEISHU_WEBHOOK_URL.startsWith('https://')) {
      context.addIssue({ code: 'custom', message: 'FEISHU_WEBHOOK_URL must use HTTPS' });
    }
    if (value.FEISHU_WEBHOOK_URL) {
      const webhook = new URL(value.FEISHU_WEBHOOK_URL);
      if (
        webhook.hostname !== 'open.feishu.cn'
        || !webhook.pathname.startsWith('/open-apis/bot/v2/hook/')
      ) {
        context.addIssue({
          code: 'custom',
          message: 'FEISHU_WEBHOOK_URL must use the official Feishu custom-bot endpoint',
        });
      }
    }
  });

export interface RuntimeConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  familyAccounts: Array<{ actorId: string; username: string; passwordScrypt: string }>;
  session: { secret: string; ttlSeconds: number };
  appBaseUrl: string;
  x: {
    bearerToken?: string;
    productionSyncEnabled: boolean;
    policyConfirmed: boolean;
    pollIntervalSeconds: number;
    compensationIntervalSeconds: number;
  };
  ai: {
    providerPreset: 'openai' | 'custom';
    provider: string;
    protocol: 'responses' | 'chat_completions';
    baseUrl?: string;
    model: string;
    apiKey?: string;
    dailyBudgetCents: number;
    inputCostPerMillionCents?: number;
    outputCostPerMillionCents?: number;
    maxRequestCostCents?: number;
    reasoningEffort: 'low' | 'medium' | 'high';
    pricingVersion: string;
  };
  feishu:
    | { enabled: false; cooldownSeconds: number }
    | { enabled: true; webhookUrl: string; signingSecret: string; cooldownSeconds: number };
  coreVisibilitySloMinutes: number;
  importance: { threshold: number; minimumConfidence: number };
  work: {
    leaseSeconds: number;
    maxAttempts: number;
    externalDeadlineMs: number;
    concurrency: number;
    maxContextItems: number;
    maxInputChars: number;
    maxOutputChars: number;
    maxRawPayloadBytes: number;
  };
}

const runtimeConfigSnapshotSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  port: z.number().int().positive().max(65_535),
  databaseUrl: z.string().url().startsWith('mysql://'),
  redisUrl: z.string().url().startsWith('redis://'),
  familyAccounts: z.array(familyAccountSchema).length(2),
  session: z.object({ secret: z.string().min(32), ttlSeconds: z.number().int().positive().max(2_592_000) }).strict(),
  appBaseUrl: z.string().url(),
  x: z.object({
    bearerToken: z.string().min(1).optional(),
    productionSyncEnabled: z.boolean(),
    policyConfirmed: z.boolean(),
    pollIntervalSeconds: z.number().int().positive(),
    compensationIntervalSeconds: z.number().int().positive(),
  }).strict(),
  ai: z.object({
    providerPreset: z.enum(['openai', 'custom']),
    provider: z.string().min(1).max(64),
    protocol: z.enum(['responses', 'chat_completions']),
    baseUrl: z.string().url().startsWith('https://').optional(),
    model: z.string().min(1).max(128),
    apiKey: z.string().min(1).optional(),
    dailyBudgetCents: z.number().int().nonnegative(),
    inputCostPerMillionCents: z.number().nonnegative().optional(),
    outputCostPerMillionCents: z.number().nonnegative().optional(),
    maxRequestCostCents: z.number().nonnegative().optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']),
    pricingVersion: z.string().min(1).max(64),
  }).strict(),
  feishu: z.discriminatedUnion('enabled', [
    z.object({ enabled: z.literal(false), cooldownSeconds: z.number().int().positive() }).strict(),
    z.object({ enabled: z.literal(true), webhookUrl: z.string().url(), signingSecret: z.string().min(1), cooldownSeconds: z.number().int().positive() }).strict(),
  ]),
  coreVisibilitySloMinutes: z.number().int().positive(),
  importance: z.object({ threshold: z.number().min(0).max(100), minimumConfidence: z.number().min(0).max(1) }).strict(),
  work: z.object({
    leaseSeconds: z.number().int().positive(),
    maxAttempts: z.number().int().positive(),
    externalDeadlineMs: z.number().int().positive(),
    concurrency: z.number().int().positive(),
    maxContextItems: z.number().int().positive(),
    maxInputChars: z.number().int().positive(),
    maxOutputChars: z.number().int().positive(),
    maxRawPayloadBytes: z.number().int().positive(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.ai.providerPreset === 'openai' && (
    value.ai.provider !== 'openai' || value.ai.protocol !== 'responses' || value.ai.model !== 'gpt-5.6-terra' || value.ai.baseUrl
  )) context.addIssue({ code: 'custom', message: 'Invalid OpenAI official preset snapshot', path: ['ai'] });
  if (value.ai.providerPreset === 'custom' && !value.ai.baseUrl) {
    context.addIssue({ code: 'custom', message: 'Custom provider snapshot requires HTTPS baseUrl', path: ['ai', 'baseUrl'] });
  }
});

export type RuntimeConfigSnapshot = RuntimeConfig;

export function parseRuntimeConfigSnapshot(input: unknown): RuntimeConfigSnapshot {
  return runtimeConfigSnapshotSchema.parse(input);
}

export function parseRuntimeConfig(environment: Record<string, string | undefined>): RuntimeConfig {
  if (environment.AI_API_KEY !== undefined) {
    throw new Error('AI_API_KEY is not supported; use OPENAI_API_KEY');
  }
  const value = environmentSchema.parse(environment);
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    familyAccounts: value.FAMILY_ACCOUNTS_JSON,
    session: { secret: value.SESSION_SECRET, ttlSeconds: value.SESSION_TTL_SECONDS },
    appBaseUrl: value.APP_BASE_URL,
    x: {
      bearerToken: value.X_API_BEARER_TOKEN,
      productionSyncEnabled: value.X_PRODUCTION_SYNC_ENABLED,
      policyConfirmed: value.X_POLICY_CONFIRMED,
      pollIntervalSeconds: value.X_POLL_INTERVAL_SECONDS,
      compensationIntervalSeconds: value.X_COMPENSATION_INTERVAL_SECONDS,
    },
    ai: {
      providerPreset: value.AI_PROVIDER_PRESET,
      provider: value.AI_PROVIDER,
      protocol: value.AI_PROTOCOL,
      baseUrl: value.AI_BASE_URL,
      model: value.AI_MODEL ?? value.OPENAI_MODEL ?? 'gpt-5.6-terra',
      apiKey: value.AI_PROVIDER_API_KEY ?? value.OPENAI_API_KEY,
      dailyBudgetCents: value.AI_DAILY_BUDGET_CENTS,
      inputCostPerMillionCents: value.OPENAI_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents: value.OPENAI_OUTPUT_COST_PER_MILLION_CENTS,
      maxRequestCostCents: value.AI_MAX_REQUEST_COST_CENTS,
      reasoningEffort: value.AI_REASONING_EFFORT,
      pricingVersion: value.AI_PRICING_VERSION,
    },
    feishu: value.FEISHU_ENABLED
      ? {
          enabled: true,
          webhookUrl: value.FEISHU_WEBHOOK_URL as string,
          signingSecret: value.FEISHU_SIGNING_SECRET as string,
          cooldownSeconds: value.FEISHU_COOLDOWN_SECONDS,
        }
      : { enabled: false, cooldownSeconds: value.FEISHU_COOLDOWN_SECONDS },
    coreVisibilitySloMinutes: value.CORE_VISIBILITY_SLO_MINUTES,
    importance: {
      threshold: value.IMPORTANCE_THRESHOLD,
      minimumConfidence: value.MIN_ANALYSIS_CONFIDENCE,
    },
    work: {
      leaseSeconds: value.LEASE_SECONDS,
      maxAttempts: value.MAX_ATTEMPTS,
      externalDeadlineMs: value.EXTERNAL_DEADLINE_MS,
      concurrency: value.WORKER_CONCURRENCY,
      maxContextItems: value.MAX_CONTEXT_ITEMS,
      maxInputChars: value.MAX_INPUT_CHARS,
      maxOutputChars: value.MAX_OUTPUT_CHARS,
      maxRawPayloadBytes: value.MAX_RAW_PAYLOAD_BYTES,
    },
  };
}

export function summarizeRuntimeConfig(config: RuntimeConfig): Record<string, unknown> {
  return {
    nodeEnv: config.nodeEnv,
    familyAccountCount: config.familyAccounts.length,
    appBaseUrl: config.appBaseUrl,
    x: {
      configured: Boolean(config.x.bearerToken),
      productionSyncEnabled: config.x.productionSyncEnabled,
      policyConfirmed: config.x.policyConfirmed,
    },
    ai: {
      providerPreset: config.ai.providerPreset,
      provider: config.ai.provider,
      protocol: config.ai.protocol,
      host: config.ai.baseUrl ? new URL(config.ai.baseUrl).host : 'api.openai.com',
      model: config.ai.model,
      configured: Boolean(config.ai.apiKey),
      dailyBudgetCents: config.ai.dailyBudgetCents,
    },
    feishu: {
      enabled: config.feishu.enabled,
      configured: config.feishu.enabled,
      cooldownSeconds: config.feishu.cooldownSeconds,
    },
    coreVisibilitySloMinutes: config.coreVisibilitySloMinutes,
  };
}
