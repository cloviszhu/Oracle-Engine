# Serenity 海外产业信息监控

仅供家庭内部使用的海外产业研究辅助系统。私有网页是主要入口：归档 Serenity 内容，使用 OpenAI `gpt-5.6-terra` 生成分层中文研究卡片，并提供搜索、详情、反馈和运行状态。飞书只承担可选的重要提醒；关闭时不创建通知任务，启用时强制安全签名。

当前 `build-serenity-intelligence-monitor` 已完成本地实现和 Mock/自动化验证，真实 X、OpenAI、可选飞书、Docker/HTTPS 部署和家庭人工验收仍保持待测，不能视为真实闭环已通过。

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
pnpm audit:secrets
pnpm dev
```

开发模式默认使用：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:3000/api/health

## 配置

复制 `.env.example` 为 `.env` 后，只在本地填写实际值。不得提交 `.env`、API Token、Webhook 或 Cookie。

完整的账号摘要生成、migration、Serenity bootstrap、容器启动、政策复核和真实联调步骤见 `docs/OPERATIONS.md`。爸爸只需使用网页，不需要飞书。

## 文档入口

- `AGENTS.md`：Agent 工作约定
- `docs/STATUS.md`：当前状态和验证证据
- `docs/PROJECT_MAP.md`：项目结构和变更地图
- `docs/OPERATIONS.md`：配置、启动、政策复核和真实联调
- `docs/verification/build-serenity-intelligence-monitor.md`：逐条验收证据与待测项
- `openspec/README.md`：OpenSpec 入口

## 下一步

完成 OpenSpec 严格校验、追溯检查和最终本地验证；外部凭据与目标环境具备后，再按验收报告逐条补真实证据。
