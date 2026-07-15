# Serenity 家庭本地版交付修订 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有开发者启动流程补齐为可打包的 Windows Electron 家庭本地版：通过 GUI 完成安全配置、环境检查、服务编排、AI 兼容性探测、备份和脱敏诊断，普通使用不依赖终端或手工编辑 `.env`。

**Architecture:** Electron main 是唯一可信桌面控制面，负责 DPAPI vault、运行配置快照、Docker Compose 生命周期和 `utilityProcess` 子进程；preload 只暴露按动作划分的窄 IPC，renderer 只持有当前表单输入。现有 NestJS API、worker、React 私有网页、MySQL 与 Redis 保持业务主体；业务流水线只依赖 `ResearchModelAdapter`，由 `ProviderAdapterRegistry` 选择 Responses-compatible 或 Chat Completions-compatible adapter，并以 capability probe 作为启用门禁。

**Tech Stack:** Electron、electron-builder、React 19、NestJS 11、TypeScript 5.9、MySQL 8、Redis 7、BullMQ、Docker Compose、Vitest、Playwright Electron、Windows `safeStorage`/DPAPI。

## Global Constraints

- 包管理器固定为 `pnpm@10.4.1`。
- 第一版只支持 Windows 自包含 `.exe`；目标电脑无需安装 Node，但 MySQL/Redis 仍由 Docker Desktop 管理。
- 普通家庭使用不得要求终端或手工编辑 `.env`。
- 第一版网页只允许同一台 Windows 电脑访问；跨设备、公网、Sites、云端 KMS 和电脑关机后持续运行延期到后续 change。
- Secret 只存在于 Electron main 的加密 vault 和进程内运行配置快照；不得进入 renderer 持久化、URL、日志、错误详情、Git、命令行参数、普通环境文件或 Docker inspect。
- OpenAI 官方 preset 推荐 `gpt-5.6-terra`，但不得固定为唯一模型；只承诺通过 probe 的 Responses-compatible 与 Chat Completions-compatible 必要子集。
- X 与飞书默认关闭；未配置时不得发起真实请求或制造通知积压。
- 不连接券商、证券账户或交易接口，不生成自动买卖指令。

---

## 文件边界

- `desktop/main/`：Electron 主进程、应用生命周期、窗口/托盘和组合根。
- `desktop/preload/`：类型化窄 IPC；禁止导出通用 `ipcRenderer`、文件系统、shell 或进程执行能力。
- `desktop/renderer/`：首次设置与启动器管理 UI；与现有 `client/` 私有研究网页分离。
- `desktop/config/`：非敏感元数据、DPAPI vault、账号摘要和运行配置快照。
- `desktop/environment/`：Windows、Docker、Compose、虚拟化、端口、磁盘和权限检查。
- `desktop/runtime/`：Serenity Compose project、migration、API/worker `utilityProcess`、健康检查与停止顺序。
- `desktop/backup/`：MySQL 一致性备份、恢复清单和脱敏诊断包。
- `server/infrastructure/ai/`：provider registry、Responses-compatible、Chat Completions-compatible 与 capability probe。
- `shared/desktop/`：IPC DTO、配置状态、probe 结果和稳定错误分类；所有返回类型默认不含 Secret 原值。

### Task 1: Electron 壳、共享 IPC 契约与可打包入口

**Files:**
- Create: `desktop/main/index.ts`
- Create: `desktop/main/window-manager.ts`
- Create: `desktop/main/tray-manager.ts`
- Create: `desktop/preload/index.ts`
- Create: `desktop/renderer/App.tsx`
- Create: `desktop/renderer/App.test.tsx`
- Create: `shared/desktop/contracts.ts`
- Create: `electron.vite.config.ts`
- Create: `electron-builder.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `window.serenityLauncher`，仅包含 `getSetupStatus`、`runEnvironmentChecks`、`saveSettings`、`probeAI`、`startSerenity`、`stopSerenity`、`getHealth`、`openWorkspace`、`createBackup`、`exportDiagnostics`。
- Produces: `SetupStatus`、`EnvironmentCheckResult`、`ServiceHealthSummary` 和 `SecretConfiguredState`；所有读取接口只返回 `configured` 与脱敏元数据。

- [ ] 编写 renderer 与 preload 契约测试，验证不存在通用 IPC、Node、shell、文件系统和 Secret 读取接口；运行 `pnpm test -- desktop/renderer shared/desktop`，预期新增测试先失败。
- [ ] 建立 Electron main/preload/renderer 最小入口，窗口启用 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`，并设置严格 CSP；再次运行上述测试，预期通过。
- [ ] 配置 electron-vite 与 electron-builder，打包编译后的 API、worker、网页和 Compose 资源；运行 `pnpm check` 与 `pnpm build:desktop`，预期生成 Windows 安装/便携产物且不依赖系统 Node。
- [ ] 关闭主窗口时缩入托盘；只有“停止 Serenity 并退出”触发完整停止回调；补充生命周期测试并运行 `pnpm test -- desktop/main`。

### Task 2: DPAPI vault、家庭账号和 GUI 配置事务

**Files:**
- Create: `desktop/config/config-store.ts`
- Create: `desktop/config/secret-vault.ts`
- Create: `desktop/config/account-hasher.ts`
- Create: `desktop/config/runtime-snapshot.ts`
- Create: `desktop/config/config-store.test.ts`
- Create: `desktop/config/secret-vault.test.ts`
- Create: `desktop/config/account-hasher.test.ts`
- Modify: `server/infrastructure/runtime-config.ts`
- Modify: `server/infrastructure/runtime-config.test.ts`

**Interfaces:**
- Produces: `SecretVault.write(name, plaintext): Promise<void>`、`SecretVault.configured(name): Promise<boolean>`；不提供返回明文的 renderer/IPC 接口。
- Produces: `RuntimeConfigSnapshot`，仅通过 Electron main 与受控 `utilityProcess` 的私有 IPC 发送一次，不落普通环境文件。

- [ ] 用固定 canary 编写 vault、日志、错误对象、renderer storage、IPC 返回和普通配置文件零泄漏测试；运行 `pnpm test -- desktop/config server/infrastructure/runtime-config.test.ts`，预期先失败。
- [ ] 使用 Electron `safeStorage` 写入 `%LOCALAPPDATA%\Serenity` 的加密 vault，并把非敏感 schema version、配置状态与功能开关分开保存；目录 ACL 失败时返回稳定中文错误且不降级为明文。
- [ ] 从 GUI 接收两个不同家庭账号，在 main 内使用随机盐和现有 `scrypt` 格式生成摘要；验证同密码两次生成不同摘要、修改密码撤销对应会话、读取只返回是否已设置。
- [ ] 将 `parseRuntimeConfig` 拆成开发环境入口与受信 `RuntimeConfigSnapshot` 校验入口；生产桌面路径拒绝从 `.env`、命令行参数或 Docker inspect 接收 Secret。

### Task 3: 环境检查、Compose 和受控服务生命周期

**Files:**
- Create: `desktop/environment/environment-checker.ts`
- Create: `desktop/environment/environment-checker.test.ts`
- Create: `desktop/runtime/compose-controller.ts`
- Create: `desktop/runtime/service-orchestrator.ts`
- Create: `desktop/runtime/utility-process-host.ts`
- Create: `desktop/runtime/service-orchestrator.test.ts`
- Modify: `docker-compose.yml`
- Modify: `server/main.ts`
- Modify: `server/worker.ts`
- Modify: `server/infrastructure/database/migrate.ts`

**Interfaces:**
- Produces: `EnvironmentChecker.run(): Promise<EnvironmentCheckResult[]>`，每项含稳定 code、`pass|warning|fail`、中文说明和下一步操作。
- Produces: `ServiceOrchestrator.start/stop/health`；只管理固定 Serenity Compose project，API/worker 由 `utilityProcess` 托管。

- [ ] 编写 Docker 缺失、engine 未运行、Compose 缺失、虚拟化关闭、端口占用、空间不足和目录无权限测试；结果必须保持 GUI 可用并提供官方安装入口与复查动作。
- [ ] 修改 Compose 只运行 MySQL/Redis，随机或验证后的端口仅绑定 `127.0.0.1`；禁止关闭 Docker Desktop 或其他 Compose project。
- [ ] 实现启动顺序：目录/端口→Docker→MySQL/Redis 健康→幂等 migration→API 健康→worker heartbeat→打开网页；任一步失败均停止后续步骤并保留可恢复状态。
- [ ] 实现停止顺序：停止接收新任务→worker 可恢复边界→API→Serenity 容器；运行故障注入与重复 start/stop 测试，验证幂等且不影响其他容器。

### Task 4: AI provider registry、双协议 adapter 与 capability probe

**Files:**
- Create: `server/infrastructure/ai/provider-adapter.registry.ts`
- Create: `server/infrastructure/ai/responses-compatible.adapter.ts`
- Create: `server/infrastructure/ai/chat-completions-compatible.adapter.ts`
- Create: `server/infrastructure/ai/capability-probe.service.ts`
- Create: `server/infrastructure/ai/capability-probe.service.test.ts`
- Modify: `server/research/research-model.adapter.ts`
- Modify: `server/infrastructure/ai/openai-research.adapter.ts`
- Modify: `server/infrastructure/ai/openai-research.adapter.test.ts`
- Modify: `server/research/research-analysis.service.ts`
- Modify: `drizzle/schema.ts`
- Create: `drizzle/migrations/0005_provider_configuration_audit.sql`

**Interfaces:**
- Produces: `ProviderAdapterRegistry.create({ providerPreset, protocol, baseUrl, apiKey, model, reasoning })`。
- Produces: `CapabilityProbeResult`，含 requested/actual model、response ID、usage、schema/card/source 校验、错误类别、probe version 与通过时间。

- [ ] 编写 Responses-compatible 与 Chat Completions-compatible mock contract 测试：分别使用 `text.format` 和 `response_format` 的严格 JSON Schema，并验证 refusal、不完整输出、缺 usage、缺 response ID、超时、429、5xx 与认证错误分类。
- [ ] 将 OpenAI 官方 preset 与自定义 OpenAI-compatible preset 注册到 registry；保留 `gpt-5.6-terra` 推荐值但允许修改 model，不实现原生 Anthropic/Gemini adapter。
- [ ] 实现 probe：URL/HTTPS 规则、认证、模型调用、requested/actual model、严格 schema、完整研究卡片、来源约束、response ID、usage 和稳定错误分类；不满足时允许保存为未启用，但 worker 不得使用。
- [ ] 将 provider、protocol、base URL host、requested/actual model、local/provider request ID、usage、费用、价格版本、prompt/schema/probe version 持久化；价格只取 GUI 配置，不按模型名猜测。

### Task 5: 首次设置、可选 X/飞书与日常启动器界面

**Files:**
- Create: `desktop/renderer/setup/SetupWizard.tsx`
- Create: `desktop/renderer/setup/SetupWizard.test.tsx`
- Create: `desktop/renderer/dashboard/LauncherDashboard.tsx`
- Create: `desktop/renderer/dashboard/LauncherDashboard.test.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/App.test.tsx`
- Modify: `server/ingestion/serenity-scheduler.ts`
- Modify: `server/notifications/notification-candidate-dispatcher.ts`

**Interfaces:**
- Consumes: Tasks 1-4 的窄 IPC、环境检查、配置状态、probe 与服务健康摘要。
- Produces: GUI-only 首启流程和日常“启动、停止、健康检查、打开网页、修改设置、备份、诊断”入口。

- [ ] 编写全新 user-data 目录的 GUI 首启测试，完成家庭账号、AI、X/飞书跳过与一键启动；验证表单提交后清空 Secret 字段且重新编辑不回显原值。
- [ ] X 默认关闭；未配置时零真实请求并在启动器和网页显示“X 未配置，尚未进行真实同步”；启用必须 Token、政策确认与连接测试。
- [ ] 飞书默认跳过；启用必须 Webhook 与签名密钥成对填写并通过签名测试；未配置时零 delivery、零任务、零失败积压。
- [ ] 启用 AI 前强制 probe；incompatible 配置只可保存为未启用，不得自动换模型、改协议或降低卡片契约。

### Task 6: 备份、脱敏诊断、安装产物与最终验证

**Files:**
- Create: `desktop/backup/backup-service.ts`
- Create: `desktop/backup/diagnostics-service.ts`
- Create: `desktop/backup/backup-service.test.ts`
- Create: `desktop/backup/diagnostics-service.test.ts`
- Create: `tests/e2e/launcher-first-run.spec.ts`
- Create: `tests/e2e/launcher-lifecycle.spec.ts`
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/PROJECT_MAP.md`
- Modify: `docs/verification/build-serenity-intelligence-monitor.md`
- Modify: `README.md`

**Interfaces:**
- Produces: MySQL 一致性备份、非敏感配置清单、版本信息和 DPAPI 密文副本；跨用户/跨电脑恢复要求重新输入 Secret。
- Produces: 脱敏诊断包；导出前 canary 扫描命中时拒绝生成。

- [ ] 编写备份/恢复、DPAPI 用户边界、Redis 非事实源和诊断 canary 拒绝测试；运行 `pnpm test -- desktop/backup`。
- [ ] 在带 Docker Desktop 的 Windows 目标环境执行 GUI 首启、启动/停止、健康检查、worker heartbeat 和打开网页 E2E；若环境不可用，保持为待目标环境验证，不用 Mock 冒充。
- [ ] 运行 `pnpm check`、`pnpm test`、`pnpm lint`、`pnpm build`、`pnpm audit:secrets`、Electron 打包、安装产物 Secret 扫描和 OpenSpec 严格校验；任何失败先修复再继续。
- [ ] 独立代码复核与 Harness `test_verify` 完成后回到 `user_accept`，展示自动化、Mock、真实 API、目标环境和用户手动证据；未经用户纯确认不得归档。

## 自审

- 规格覆盖：六个 Task 覆盖 Electron、GUI 首启、DPAPI、窄 IPC、Compose 生命周期、双协议 registry/probe、X/飞书可选、备份、诊断、打包与最终证据分层。
- 占位符扫描：所有步骤均给出具体文件、动作、命令和可判定预期，无待补内容或未定义相邻接口。
- 类型一致性：`RuntimeConfigSnapshot`、`CapabilityProbeResult`、`EnvironmentCheckResult`、`ServiceHealthSummary` 与 `SecretConfiguredState` 在首次产生后保持同名使用。
- 范围检查：Sites、云端、远程访问、关机后运行和云厂商选择只保留后续约束，不进入任何实现 Task。
