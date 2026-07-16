# build-serenity-intelligence-monitor 验收记录

更新时间：2026-07-15
执行环境：Windows 本地工作区；Node/pnpm 自动化环境
真实环境状态：Docker/Compose、生产 HTTPS、真实 X、真实 OpenAI、真实飞书、两个家庭账号和爸爸人工理解均未执行

## 证据规则

每条 TC 只能选择一个实际证明力类别：`自动化已验证`、`Mock 已验证`、`真实 API 已验证`、`待人工配置或验证`。状态和类别是两列：自动化或 Mock 通过不等于真实 API 或人工验收通过。

标记 `真实 API 已验证` 必须同时具有执行时间、目标环境、脱敏 provider/request ID、实际成本或明确的零成本依据，以及本目录下的脱敏证据位置。需要浏览器、Docker、HTTPS、真实家庭账号或人工判断的 TC 还必须有对应现场记录。缺任一关键字段时，机械保持 `待验收`，禁止用 Mock、样例截图、代码存在或本地非容器运行替代。

脱敏附件统一放在 `docs/verification/evidence/build-serenity-intelligence-monitor/`。不得放入 Token、Webhook、签名密钥、Cookie、密码、账户或持仓数据。

## X 政策复核记录

- 状态：待人工复核
- 复核人：待填
- 复核时间（含时区）：待填
- X 文档版本/更新时间：待填
- 允许字段：待按 `docs/OPERATIONS.md` 的最小 allowlist 逐项确认
- 删除/不可访问内容处理结论：待填
- 真实同步批准：否；在以上字段完整前保持 `X_POLICY_CONFIRMED=false` 和 `X_PRODUCTION_SYNC_ENABLED=false`

## 当前逐项记录

| TC | 执行方式 | 唯一实际证明力类别 | 状态 | 证据位置 | 执行时间 | Provider / Request ID | 成本 | 环境 |
|---|---|---|---|---|---|---|---|---|
| TC-1.1 | 用户手动 | 待人工配置或验证 | 待验收：无真实 X 凭据/credits | 待补 | — | — | — | 待部署 |
| TC-1.2 | 用户手动 | 待人工配置或验证 | 待验收：尚未在隔离部署环境操作 | 待补 | — | — | — | 待部署 |
| TC-2.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/context/context-builder.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-2.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/context/context-builder.test.ts`、`server/context/context-completion.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-3.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/pipeline/core-pipeline.service.test.ts`、`server/notifications/notification-reservation.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-3.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/ingestion/poll-source.service.test.ts`、`server/infrastructure/work/coordination.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-4.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/ingestion/content-lifecycle.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-4.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/ingestion/content-lifecycle.test.ts`、`server/ingestion/content-lifecycle.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-5.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/research/research-contract.test.ts`、`server/research/drizzle-research-analysis.repository.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-5.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/research/research-contract.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-6.1 | 用户手动 | 待人工配置或验证 | 待验收：无真实 OpenAI 调用 | 待补 | — | — | — | 待部署 |
| TC-6.2 | 用户手动 | 待人工配置或验证 | 待验收：无真实内容抽查 | 待补 | — | — | — | 待部署 |
| TC-7.1 | AI 自测 | 自动化已验证 | 通过 | `server/importance/importance-scorer.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-7.2 | AI 自测 | 自动化已验证 | 通过 | `server/importance/importance-scorer.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-8.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/notifications/notification-reservation.service.test.ts`、`server/notifications/drizzle-notification.repository.test.ts`、`server/notifications/notification-candidate-dispatcher.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实发送 | 本地 Vitest |
| TC-8.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/notifications/notification-delivery.service.test.ts`、`server/notifications/delivery-recovery.test.ts`、`server/operations/drizzle-operations.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实发送 | 本地 Vitest |
| TC-9.1 | 用户手动 | 待人工配置或验证 | 待验收：无签名飞书目标和真实发送 | 待补 | — | — | — | 待部署 |
| TC-9.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/pipeline/core-pipeline.service.test.ts`、`server/operations/operations.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实发送 | 本地 Vitest |
| TC-10.1 | 回写后测 | Mock 已验证 | 待运行验证；已有 UI Mock 证据，双人现场未执行 | `client/src/App.test.tsx` | 2026-07-15 | 不适用 | 0 | 本地 jsdom |
| TC-10.2 | 回写后测 | 自动化已验证 | 待运行验证；已有接口边界证据 | `server/content/private-api.controller.test.ts`、`server/content/content-query.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-11.1 | 回写后测 | Mock 已验证 | 待运行验证；已有追加反馈 Mock 证据，双人现场未执行 | `server/feedback/feedback.service.test.ts`、`client/src/App.test.tsx` | 2026-07-15 | 不适用 | 0 | 本地 Vitest/jsdom |
| TC-11.2 | 回写后测 | 自动化已验证 | 待运行验证；已有非法载荷拒绝证据 | `server/feedback/feedback.service.test.ts`、`server/content/private-api.controller.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-12.1 | 回写后测 | Mock 已验证 | 待运行验证；已有状态页 Mock 证据，部署现场未执行 | `server/operations/operations.service.test.ts`、`client/src/App.test.tsx` | 2026-07-15 | 不适用 | 0 | 本地 Vitest/jsdom |
| TC-12.2 | 回写后测 | Mock 已验证 | 待运行验证；已有阻断与配置摘要证据 | `server/operations/operations.service.test.ts`、`server/infrastructure/runtime-config.test.ts` | 2026-07-15 | fixture，无真实 ID | 0 | 本地 Vitest |
| TC-13.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/infrastructure/work/coordination.test.ts`、`server/infrastructure/work/dispatcher.test.ts`、`server/notifications/notification-dispatcher.test.ts` | 2026-07-15 | fixture，无真实 ID | 0 | 本地 Vitest |
| TC-13.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/infrastructure/work/state-machine.test.ts`、`server/notifications/notification-delivery.service.test.ts`、`server/notifications/drizzle-notification.repository.test.ts`、`server/operations/drizzle-operations.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 0 | 本地 Vitest |
| TC-14.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/security/capability-boundary.test.ts`、`server/infrastructure/ai/openai-research.adapter.test.ts` | 2026-07-15 | mock response IDs | 无真实调用 | 本地 Vitest |
| TC-14.2 | 用户手动 | 待人工配置或验证 | 待验收：无真实 `gpt-5.6-terra` 对抗调用 | 待补 | — | — | — | 待部署 |
| TC-15.1 | AI 自测 | 自动化已验证 | 通过 | `scripts/audit-secrets.mjs`、`server/infrastructure/logging/redaction.test.ts` | 2026-07-15 | 不适用 | 0 | 源码与 `dist` 扫描 |
| TC-15.2 | AI 自测 | 自动化已验证 | 通过 | `server/infrastructure/runtime-config.test.ts`、`server/infrastructure/ai/openai-research.adapter.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-16.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/security/capability-boundary.test.ts`、`server/research/research-contract.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-16.2 | AI 自测 | 自动化已验证 | 通过 | `server/security/capability-boundary.test.ts` | 2026-07-15 | 不适用 | 0 | 依赖与路由审计 |
| TC-17.1 | AI 自测 | Mock 已验证 | Mock 通过 | `server/infrastructure/x/x-api.client.test.ts`、`server/infrastructure/ai/openai-research.adapter.test.ts`、`server/research/drizzle-research-analysis.repository.test.ts` | 2026-07-15 | mock request IDs | 模拟费用 | 本地 Vitest |
| TC-17.2 | AI 自测 | Mock 已验证 | Mock 通过 | `server/research/drizzle-budget.guard.test.ts`、`server/research/research-analysis.service.test.ts` | 2026-07-15 | fixture，无真实 ID | 无真实调用 | 本地 Vitest |
| TC-18.1 | 用户手动 | 待人工配置或验证 | 待验收：报告已建立，尚无人工作证复核 | 本文件 | — | — | — | 待人工复核 |
| TC-18.2 | 用户手动 | 待人工配置或验证 | 待验收：机械规则已写入，尚无人工作证驳回演练 | 本文件 | — | — | — | 待人工复核 |
| TC-19.1 | 用户手动 | 待人工配置或验证 | 待验收：缺真实 X/OpenAI/HTTPS/爸爸参与 | 待补 | — | — | — | 待部署 |
| TC-19.2 | 用户手动 | 待人工配置或验证 | 待验收：缺真实普通内容与冷启动现场 | 待补 | — | — | — | 待部署 |
| TC-20.1 | 用户手动 | 待人工配置或验证 | portable 已构建并冒烟；全新 user-data + Docker GUI 首启待验 | `docs/verification/windows-docker-target.md` | 2026-07-15 | 不适用 | 0 | 待目标机 |
| TC-20.2 | 用户手动 | 待人工配置或验证 | 中断恢复和无 Node 目标机现场待验 | `docs/verification/windows-docker-target.md` | — | 不适用 | 0 | 待目标机 |
| TC-21.1 | AI 自测 | 自动化已验证 | 通过 | `desktop/environment/environment-checker.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-21.2 | AI 自测 | 自动化已验证 | 通过；真实 Docker 缺失路径保持待目标机复核 | `desktop/environment/environment-checker.test.ts`、`desktop/runtime/compose-layout.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-22.1 | AI 自测 | 自动化已验证 | 通过 | `desktop/config/secret-vault.test.ts`、`desktop/config/config-store.test.ts`、`desktop/main/launcher-settings.service.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-22.2 | AI 自测 | 自动化已验证 | 通过 | `desktop/config/secret-vault.test.ts`、`desktop/preload/index.test.ts`、`desktop/main/window-manager.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-23.1 | AI 自测 | 自动化已验证 | 编排契约通过；真实进程/容器生命周期待目标机 | `desktop/runtime/service-orchestrator.test.ts`、`desktop/runtime/utility-process-manager.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-23.2 | AI 自测 | 自动化已验证 | 失败关闭和固定 Compose project 通过 | `desktop/runtime/service-orchestrator.test.ts`、`desktop/runtime/compose-controller.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |
| TC-24.1 | AI 自测 | Mock 已验证 | 双协议严格 schema、probe 和运行门禁通过 | `server/infrastructure/ai/compatible-research.adapter.test.ts`、`server/infrastructure/ai/capability-probe.test.ts`、`desktop/main/launcher-settings.service.test.ts` | 2026-07-15 | mock request IDs | 模拟费用 | 本地 Vitest |
| TC-24.2 | AI 自测 | Mock 已验证 | 不安全 URL、模型不一致和能力缺失均阻断，无 fallback | `server/infrastructure/ai/provider-adapter.registry.test.ts`、`server/infrastructure/ai/compatible-research.adapter.test.ts` | 2026-07-15 | mock request IDs | 无真实调用 | 本地 Vitest |
| TC-25.1 | AI 自测 | Mock 已验证 | 默认跳过路径通过 | `desktop/renderer/App.test.tsx`、`desktop/main/settings-policy.test.ts` | 2026-07-15 | 无真实 ID | 无真实调用 | 本地 jsdom/Vitest |
| TC-25.2 | AI 自测 | Mock 已验证 | 缺项和连接失败阻断通过 | `desktop/main/settings-policy.test.ts` | 2026-07-15 | 无真实 ID | 无真实调用 | 本地 Vitest |
| TC-26.1 | 用户手动 | 待人工配置或验证 | 流式原子备份契约通过；真实 MySQL/DPAPI 恢复待验 | `desktop/maintenance/backup.service.test.ts`、`docs/verification/windows-docker-target.md` | 2026-07-15 | 不适用 | 0 | 待目标机 |
| TC-26.2 | AI 自测 | 自动化已验证 | 原始数据 canary 命中时无文件，普通日志脱敏后导出 | `desktop/maintenance/diagnostics.service.test.ts` | 2026-07-15 | 不适用 | 0 | 本地 Vitest |

## 真实验收填写模板

## 2026-07-15 家庭本地版修订验证补记

- Group 9：Electron 窄 IPC、CSP、托盘、`build:desktop`、portable 打包和启动冒烟通过；证据位于 `desktop/main`、`desktop/preload`、`desktop/renderer`、`shared/desktop`。
- Group 10：非敏感配置/DPAPI vault 分离、随机盐账号摘要、一次性运行快照和 Secret canary 测试通过；真实 Windows DPAPI 跨用户恢复仍待目标机。
- Group 11：环境检查、固定 `serenity-local` Compose、回环 MySQL/Redis、动态已验证端口、阶段编排和非 Serenity 容器保护的自动化测试通过；Docker Desktop 已安装，但 Windows 虚拟机平台启用与重启尚未完成，真实生命周期保持待验。
- Group 12：Responses-compatible 与 Chat Completions-compatible 严格 schema、refusal/incomplete/error 分类、registry 无 fallback、capability probe 和 migration `0005_burly_slipstream.sql` 通过 Mock 验证；无真实 provider 调用。
- Group 13：GUI-only 首启跳过路径、账号输入、AI probe 门禁、X/飞书默认关闭、日常管理入口和网页固定中文状态通过 jsdom/组件测试。
- Group 14：一致性备份契约、Redis 排除、跨用户重输 Secret 清单、诊断脱敏和 canary 拒绝导出通过自动化测试。真实数据库恢复见 `windows-docker-target.md`，状态待验。

本补记只提升自动化/Mock/Windows 打包证据，不改变表中真实 X、AI、飞书、Docker 和家庭人工验收的“待验”分类。

对每个待验收 TC 复制以下记录，完成后再更新上表：

- TC：
- 执行方式：
- 唯一实际证明力类别：
- 状态：
- 执行人 / 复核人：
- 执行时间（含时区）：
- 环境与版本（Docker、HTTPS、代码提交）：
- Provider / API / 模型版本：
- 脱敏 provider request ID / 阶段关联 ID：
- token、资源用量与实际成本：
- 证据相对路径：
- 结论与未通过原因：
