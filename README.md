# Serenity 海外产业信息监控

仅供家庭内部使用的海外产业研究辅助系统。私有网页是主要入口：归档 Serenity 内容，通过统一 AI 适配器生成分层中文研究卡片，并提供搜索、详情、反馈和运行状态。OpenAI 官方 preset 推荐 `gpt-5.6-terra`；修订目标还支持通过 probe 的 Responses-compatible 与 Chat Completions-compatible 配置。飞书只承担可选的重要提醒。

`build-serenity-intelligence-monitor` 的研究闭环与家庭本地版 Group 9～13 已实现；Group 14 的备份、诊断、文档和 Windows 可携带产物已完成本地自动化验证。Docker Desktop 已安装，但 Windows 虚拟机平台启用与重启尚未完成，因此真实 Docker 生命周期、真实外部 API、备份恢复和家庭人工验收仍保持待验，尚未完成最终 `user_accept`。

## 技术基线

- React 19 + Vite 7
- NestJS 11
- TypeScript 5.9
- Drizzle ORM + MySQL 8
- BullMQ + Redis 7
- Vitest + ESLint
- Electron 37 + electron-vite + electron-builder

## 本地命令

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
pnpm build:desktop
pnpm dist:desktop
pnpm audit:secrets
pnpm dev
```

开发模式默认使用：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:3000/api/health

## 配置

`.env.example` 仅供开发和测试。家庭生产路径由 Electron GUI 与 Windows DPAPI vault 管理配置，不要求普通用户手工编辑 `.env` 或生成密码摘要。不得提交 `.env`、API Token、Webhook 或 Cookie。

当前开发者运行步骤和未来家庭启动器边界见 `docs/OPERATIONS.md`。爸爸只需使用网页，不需要飞书。

## 文档入口

- `AGENTS.md`：Agent 工作约定
- `docs/STATUS.md`：当前状态和验证证据
- `docs/PROJECT_MAP.md`：项目结构和变更地图
- `docs/OPERATIONS.md`：配置、启动、政策复核和真实联调
- `docs/verification/build-serenity-intelligence-monitor.md`：逐条验收证据与待测项
- `openspec/README.md`：OpenSpec 入口

## 下一步

在带 Docker Desktop 的 Windows 目标机执行 `docs/verification/windows-docker-target.md`，补齐真实生命周期证据后重新进行 Harness `test_verify`，再回到 `user_accept`。
