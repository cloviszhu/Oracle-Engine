# 项目地图

## 目录职责

| 路径 | 职责 | 当前状态 |
|---|---|---|
| `client/` | React 私有网站 | 登录、最新、时间线、筛选、分层详情、反馈、状态和响应式界面 |
| `server/auth/`、`server/content/`、`server/feedback/`、`server/operations/` | 私有 API 能力 | 家庭会话、检索/详情、反馈和安全状态 DTO |
| `server/ingestion/`、`server/context/`、`server/research/`、`server/importance/` | 核心研究流水线 | X 归档、上下文、结构化 AI、预算和评分边界 |
| `server/notifications/` | 可选通知业务 | 评分候选扫描、reservation、冷却/去重、dispatch、attempt、恢复审计和结果未知状态 |
| `server/infrastructure/` | 数据库、队列和外部适配器 | X、双协议 AI registry/probe、飞书签名、Redis/BullMQ、运行快照和日志脱敏 |
| `desktop/` | Electron 家庭本地启动器 | main/preload/renderer、DPAPI vault、环境检查、Compose/utilityProcess、备份和诊断 |
| `shared/` | 前后端与桌面共享类型 | 基础状态、错误、研究卡片和窄 IPC 契约 |
| `drizzle/` | MySQL schema 与 migration | 19 张业务/审计表、双协议 AI 审计字段和版本化迁移 |
| `openspec/` | SDD 规格和 change | `build-serenity-intelligence-monitor` 修订实现完成至目标环境待验，仍停留 `user_accept` |
| `docs/` | 状态、运维和验收 | 状态、项目地图、运维说明和逐 TC 验收记录 |

## 变更指引

- 新 API：`server/<capability>/`
- 外部服务适配器：`server/infrastructure/<provider>/`
- 页面和筛选交互：`client/src/`
- 前后端共享契约：`shared/`
- 数据模型：由已批准 change 更新 `drizzle/schema.ts`
- 规范：由 `harness-spec` 更新 `openspec/`

## 禁止扩展

当前范围限定为 Serenity 单账号、Windows 家庭本地启动器、通过 probe 的 Responses-compatible/Chat Completions-compatible AI、同机私有网页主入口和可选签名飞书提醒。Sites、关机后持续运行、云端 API/worker/MySQL/Redis、KMS、远程访问、云厂商选择、多 X 信息源、新闻、A 股公司级映射、行情、持仓、QQ/邮件、客户端抓取、Cookie 获取和交易能力均不在本 change。
