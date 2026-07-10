# Serenity 海外产业信息监控

仅供家庭内部使用的海外产业研究辅助系统。当前仓库只完成工程初始化，尚未实现 X 内容获取、AI 研究卡片、重要性判断、消息推送或私有认证。

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

新会话应以 `harness-spec` 为主控，按场景 A 创建 `build-serenity-intelligence-monitor`。在 proposal、design、test-checklist 和 tasks 完成前，不实现业务功能。
