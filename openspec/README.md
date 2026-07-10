# OpenSpec 总览

## 项目信息

| 字段 | 内容 |
|---|---|
| 项目 | Serenity 海外产业信息监控 |
| 用途 | 家庭内部研究辅助 |
| 日期 | 2026-07-10 |
| Schema | `spec-driven` |

## 当前能力

当前仅有 `project-foundation`：前后端可运行骨架、健康检查、配置失败可见、Secret 扫描和标准验证命令。Serenity 监控业务尚未创建 change。

## 目录

```text
openspec/
├── config.yaml
├── README.md
├── specs/
│   └── project-foundation/
│       └── spec.md
└── changes/
    └── archive/
```

## 模块导航

| Capability | 规格 | Purpose |
|---|---|---|
| project-foundation | [spec.md](specs/project-foundation/spec.md) | 定义可验证且安全的工程基础能力 |

## 技术架构

```text
Browser
  │
  ▼
React/Vite ──► NestJS ──► infrastructure adapters
                         ├── MySQL/Drizzle（未连接）
                         └── Redis/BullMQ（未连接）
```

| 层 | 技术 |
|---|---|
| 前端 | React 19、Vite 7 |
| 后端 | NestJS 11、Express 5 |
| 数据 | Drizzle ORM、MySQL 8 |
| 队列 | BullMQ、Redis 7 |
| 验证 | Vitest、TypeScript、ESLint |

当前没有业务数据表。

## 使用指南

1. 新会话先阅读 `AGENTS.md`、`README.md`、`docs/STATUS.md` 和 `docs/PROJECT_MAP.md`。
2. 运行 `git status --short --branch` 和 `openspec list`。
3. 以 `harness-spec` 场景 A 创建 `build-serenity-intelligence-monitor`。
4. 不得绕过 Harness 状态机直接推进原生 OpenSpec change。
