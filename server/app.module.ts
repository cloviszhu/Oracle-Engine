import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { FamilyAuthService } from './auth/family-auth.service.js';
import { RedisLoginLimiter, RedisSessionStore } from './auth/redis-auth.store.js';
import {
  APP_ORIGIN,
  AUTH_SERVICE,
  CONTENT_SERVICE,
  FEEDBACK_SERVICE,
  FamilyAuthGuard,
  OPERATIONS_SERVICE,
  PrivateApiController,
} from './content/private-api.controller.js';
import { DrizzleContentService } from './content/drizzle-content.service.js';
import { DrizzleFeedbackRepository } from './feedback/drizzle-feedback.repository.js';
import { FeedbackService } from './feedback/feedback.service.js';
import { HealthController } from './health/health.controller.js';
import { createDatabase, createDatabasePool } from './infrastructure/database/client.js';
import { createRedisConnection } from './infrastructure/queue/client.js';
import { parseRuntimeConfig, type RuntimeConfig } from './infrastructure/runtime-config.js';
import { DrizzleOperationsService } from './operations/drizzle-operations.service.js';

const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');
const DATABASE = Symbol('DATABASE');
const REDIS = Symbol('REDIS');

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'dist', 'public'),
    }),
  ],
  controllers: [HealthController, PrivateApiController],
  providers: [
    { provide: RUNTIME_CONFIG, useFactory: () => parseRuntimeConfig(process.env) },
    {
      provide: DATABASE,
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig) => createDatabase(createDatabasePool(config.databaseUrl)),
    },
    {
      provide: REDIS,
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig) => createRedisConnection(config.redisUrl),
    },
    {
      provide: AUTH_SERVICE,
      inject: [RUNTIME_CONFIG, REDIS],
      useFactory: (config: RuntimeConfig, redis: ReturnType<typeof createRedisConnection>) =>
        new FamilyAuthService({
          accounts: config.familyAccounts,
          sessionSecret: config.session.secret,
          sessionTtlSeconds: config.session.ttlSeconds,
          secureCookies: config.nodeEnv === 'production',
          store: new RedisSessionStore(redis),
          limiter: new RedisLoginLimiter(redis, { maxAttempts: 5, windowMs: 15 * 60_000 }),
        }),
    },
    {
      provide: CONTENT_SERVICE,
      inject: [DATABASE],
      useFactory: (database: ReturnType<typeof createDatabase>) => new DrizzleContentService(database),
    },
    {
      provide: FEEDBACK_SERVICE,
      inject: [DATABASE],
      useFactory: (database: ReturnType<typeof createDatabase>) =>
        new FeedbackService(new DrizzleFeedbackRepository(database)),
    },
    {
      provide: OPERATIONS_SERVICE,
      inject: [DATABASE, RUNTIME_CONFIG],
      useFactory: (database: ReturnType<typeof createDatabase>, config: RuntimeConfig) =>
        new DrizzleOperationsService(database, {
          feishuEnabled: config.feishu.enabled,
          feishuConfigured: config.feishu.enabled,
          dailyBudgetCents: config.ai.dailyBudgetCents,
          visibilitySloMinutes: config.coreVisibilitySloMinutes,
        }),
    },
    {
      provide: APP_ORIGIN,
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig) => new URL(config.appBaseUrl).origin,
    },
    { provide: APP_GUARD, useClass: FamilyAuthGuard },
  ],
})
export class AppModule {}
