# OpenSpec 覆盖度审查报告

## 覆盖统计

- 已覆盖代码元素：10 个
- 未覆盖代码元素：0 个
- 覆盖率：100%

## 覆盖清单

| 代码元素 | 类型 | 所在路径 | Capability |
|---|---|---|---|
| `App` | React 组件 | `client/src/App.tsx` | project-foundation |
| `createRoot` 入口 | 前端入口 | `client/src/main.tsx` | project-foundation |
| `SYSTEM_NAME` | 共享常量 | `shared/system.ts` | project-foundation |
| `AppModule` | NestJS Module | `server/app.module.ts` | project-foundation |
| `bootstrap` | 服务端入口 | `server/main.ts` | project-foundation |
| `HealthController` | Controller | `server/health/health.controller.ts` | project-foundation |
| `readDatabaseUrl` | 配置函数 | `server/infrastructure/database/database.config.ts` | project-foundation |
| `readRedisUrl` | 配置函数 | `server/infrastructure/queue/queue.config.ts` | project-foundation |
| `schema` | Drizzle schema | `drizzle/schema.ts` | project-foundation |
| `audit-secrets.mjs` | 安全工具 | `scripts/audit-secrets.mjs` | project-foundation |

## 未覆盖清单

无。

## 说明

本报告只覆盖当前工程骨架。X API、AI、通知、认证、归档和检索尚无代码，因此不属于当前基础规格的覆盖对象。
