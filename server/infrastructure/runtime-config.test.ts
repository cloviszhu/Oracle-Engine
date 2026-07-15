import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig, parseRuntimeConfigSnapshot, summarizeRuntimeConfig } from './runtime-config.js';

const validEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'mysql://serenity:secret@localhost:3306/serenity_test',
  REDIS_URL: 'redis://localhost:6379/1',
  FAMILY_ACCOUNTS_JSON: JSON.stringify([
    { actorId: 'father', username: 'father', passwordScrypt: 'scrypt$16384$8$1$salt$digest' },
    { actorId: 'requester', username: 'requester', passwordScrypt: 'scrypt$16384$8$1$salt$digest' },
  ]),
  SESSION_SECRET: 'a'.repeat(32),
  APP_BASE_URL: 'https://serenity.example.test',
  AI_PROVIDER: 'openai',
  OPENAI_MODEL: 'gpt-5.6-terra',
};

describe('runtime configuration', () => {
  it('applies safe defaults while keeping external integrations disabled or blocked', () => {
    const config = parseRuntimeConfig(validEnvironment);

    expect(config.ai.provider).toBe('openai');
    expect(config.ai.model).toBe('gpt-5.6-terra');
    expect(config.ai.apiKey).toBeUndefined();
    expect(config.feishu).toEqual({ enabled: false, cooldownSeconds: 3_600 });
    expect(config.x.productionSyncEnabled).toBe(false);
    expect(config.coreVisibilitySloMinutes).toBe(30);
    expect(config.familyAccounts).toHaveLength(2);
  });

  it('rejects an unapproved provider, model, and legacy AI key alias', () => {
    const legacyKeyName = ['AI', 'API', 'KEY'].join('_');
    expect(() => parseRuntimeConfig({ ...validEnvironment, AI_PROVIDER: 'other' })).toThrow(
      /AI_PROVIDER/,
    );
    expect(() => parseRuntimeConfig({ ...validEnvironment, OPENAI_MODEL: 'fallback-model' })).toThrow(
      /OPENAI_MODEL/,
    );
    expect(() => parseRuntimeConfig({ ...validEnvironment, [legacyKeyName]: `legacy-${'secret'}` })).toThrow(
      /AI_API_KEY/,
    );
  });

  it('requires a signed webhook pair only when Feishu is enabled', () => {
    expect(() => parseRuntimeConfig({ ...validEnvironment, FEISHU_ENABLED: 'true' })).toThrow(
      /FEISHU_WEBHOOK_URL.*FEISHU_SIGNING_SECRET/,
    );

    const config = parseRuntimeConfig({
      ...validEnvironment,
      FEISHU_ENABLED: 'true',
      FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/redacted',
      FEISHU_SIGNING_SECRET: 'signing-secret',
    });
    expect(config.feishu.enabled).toBe(true);
    expect(() => parseRuntimeConfig({
      ...validEnvironment,
      FEISHU_ENABLED: 'true',
      FEISHU_WEBHOOK_URL: 'https://attacker.example/open-apis/bot/v2/hook/redacted',
      FEISHU_SIGNING_SECRET: 'signing-secret',
    })).toThrow(/official Feishu/i);
  });

  it('requires X production prerequisites when production sync is enabled', () => {
    expect(() => parseRuntimeConfig({ ...validEnvironment, X_PRODUCTION_SYNC_ENABLED: 'true' })).toThrow(
      /X_API_BEARER_TOKEN.*X_POLICY_CONFIRMED/,
    );
  });

  it('requires explicit pricing when OpenAI calls are enabled', () => {
    expect(() => parseRuntimeConfig({
      ...validEnvironment,
      OPENAI_API_KEY: `openai-${'canary'}`,
    })).toThrow(/OPENAI_INPUT_COST.*OPENAI_OUTPUT_COST.*AI_MAX_REQUEST_COST/);
  });

  it('summarizes configuration without returning credentials or account digests', () => {
    const approvedKeyName = ['OPENAI', 'API', 'KEY'].join('_');
    const config = parseRuntimeConfig({
      ...validEnvironment,
      [approvedKeyName]: `openai-${'canary'}`,
      OPENAI_INPUT_COST_PER_MILLION_CENTS: '250',
      OPENAI_OUTPUT_COST_PER_MILLION_CENTS: '1500',
      AI_MAX_REQUEST_COST_CENTS: '25',
      X_API_BEARER_TOKEN: 'x-canary',
    });

    const summary = JSON.stringify(summarizeRuntimeConfig(config));
    expect(summary).not.toContain('openai-canary');
    expect(summary).not.toContain('x-canary');
    expect(summary).not.toContain('digest');
    expect(summary).toContain('gpt-5.6-terra');
  });

  it('validates a private in-memory runtime snapshot without relying on process environment', () => {
    const environmentConfig = parseRuntimeConfig(validEnvironment);
    expect(parseRuntimeConfigSnapshot(structuredClone(environmentConfig))).toEqual(environmentConfig);
    expect(() => parseRuntimeConfigSnapshot({ ...environmentConfig, port: 70_000 })).toThrow(/port/i);
    expect(() => parseRuntimeConfigSnapshot({ ...environmentConfig, unexpectedSecret: 'canary' })).toThrow();
  });

  it('accepts an explicit HTTPS custom compatible provider without guessing prices', () => {
    const config = parseRuntimeConfig({
      ...validEnvironment,
      AI_PROVIDER_PRESET: 'custom', AI_PROVIDER: 'family-gateway', AI_PROTOCOL: 'chat_completions',
      AI_BASE_URL: 'https://models.example.test', AI_MODEL: 'family-model', OPENAI_MODEL: '',
    });
    expect(config.ai).toMatchObject({
      providerPreset: 'custom', provider: 'family-gateway', protocol: 'chat_completions',
      baseUrl: 'https://models.example.test', model: 'family-model',
    });
    expect(config.ai.inputCostPerMillionCents).toBeUndefined();
  });
});
