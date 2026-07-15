# Serenity 海外产业信息监控

仅供家庭内部使用的海外产业研究辅助系统。当前正在通过 Harness Spec 评审 `build-serenity-intelligence-monitor`：以私有网页为主要入口，合规归档 Serenity 内容，并使用 OpenAI `gpt-5.6-terra` 生成结构化研究卡片；飞书仅作为可选且启用安全签名的重要提醒渠道。业务代码尚未开始实现。

## 技术基线

- React 19 + Vite 7
- NestJS 11
- TypeScript 5.9
- Drizzle ORM + MySQL 8
- BullMQ + Redis 7
- Vitest + ESLint

## 本地命令

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
pnpm dev
```

开发模式默认使用：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:3000/api/health

## 配置

复制 `.env.example` 为 `.env` 后，只在本地填写实际值。不得提交 `.env`、API Token、Webhook 或 Cookie。

## 文档入口

- `AGENTS.md`：Agent 工作约定
- `docs/STATUS.md`：当前状态和验证证据
- `docs/PROJECT_MAP.md`：项目结构和变更地图
- `openspec/README.md`：OpenSpec 入口

## 下一步

当前 change 已完成 proposal、design、test-checklist、tasks 和首轮双审查，正在按用户最新决策修订后重新评审。在 Harness 再次到达实施前确认且用户明确同意前，不实现业务功能。
