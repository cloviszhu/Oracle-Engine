# 任务启动复审

审计日期：2026-07-10

## 结论

启动审计通过，可以进入 SDD/OpenSpec。主控必须使用 `harness-spec`，场景为 A（新需求）；`super-openspec-v2` 不作为主控或并列流程。

建议 change-id：`build-serenity-intelligence-monitor`。

## 任务类型

- 业务任务：绿地新需求
- 当前交付：工程初始化与文档交付
- 不是需求变更、Bug 修复或重构

## 已读取项目与文件

参考项目：

- `C:\Users\zhuhongyu06\Desktop\U声开发\uvoice`
- `C:\Users\zhuhongyu06\Desktop\开物\uxAiLobster`

重点读取了两个项目的 `AGENTS.md`、`README.md`、`package.json`、构建与容器配置、OpenSpec 目录、源码地图和 Git 状态。只复用工程模式，没有复制业务代码、`.env`、数据库、构建产物或依赖目录。

当前项目重点文件：

- `AGENTS.md`
- `README.md`
- `package.json`
- `docs/STATUS.md`
- `docs/PROJECT_MAP.md`
- `openspec/config.yaml`
- `openspec/README.md`
- `openspec/specs/project-foundation/spec.md`
- `C:\Users\zhuhongyu06\.codex\skills\spec-review-debate\SKILL.md`

## 当前项目状态

- 技术栈：React/Vite + NestJS + TypeScript + Drizzle/MySQL + BullMQ/Redis。
- Git：已初始化；初始化改动在 `bootstrap/serenity-project` 隔离分支完成。
- OpenSpec：已初始化，无活动 change。
- 主规格：`project-foundation` 严格校验通过。
- Harness 依赖：项目内已有 `openspec-*` skills；全局环境已有 `spec-review-debate`。
- 业务代码：只有初始化页、健康检查和配置边界；Serenity 监控业务尚未实现。

## 已执行命令与结果

| 命令 | 结果 |
|---|---|
| `git status --short --branch` | 仓库与分支状态可读取 |
| `pnpm install` | 成功，生成锁文件 |
| `pnpm check` | 成功 |
| `pnpm test` | 3 个文件、6 个测试通过 |
| `pnpm lint` | 成功 |
| `pnpm build` | 成功 |
| `pnpm audit:secrets` | `secret-audit-ok` |
| `openspec list` | 无活动 change |
| `openspec validate --specs --strict --no-interactive` | 1 个规格通过 |
| Harness `status`（建议 change 路径） | 明确返回尚未 init，而非项目目录错误 |
| 生产运行冒烟 | 健康接口正确，根页面 HTTP 200 |
| `check_traceability.py --self-test` | 通过 |
| 全局 `spec-review-debate` 安装 | 源/目标 SHA-256 一致，正反自测和结构校验通过 |

## 环境检查

- Git、Node.js、pnpm、Python 和 OpenSpec CLI 可用。
- OpenSpec CLI 版本：1.3.1。
- Docker / docker-compose 当前机器未安装，因此容器构建和 Compose 联调未验证。
- X API、AI 模型和飞书真实密钥未配置，真实外部 API 闭环未验证。

## 阻塞与风险

没有阻止进入 proposal/design 的硬阻塞。

后续真实验收仍受以下条件约束：

- X Developer 账号、计费额度和 Bearer Token；
- AI 服务商、模型、预算和密钥；
- 飞书机器人 Webhook；
- 私有部署环境和认证方案；
- Docker 或等价部署环境；
- X 内容编辑、删除、不可访问和展示政策的真实验证。

这些条件必须在 design/test-checklist 中区分 Mock、真实 API 和人工配置，不得静默降级。

## 推荐工作流与 skill

最小必要：

- `harness-spec`：唯一主控；
- `openspec-new-change`、`openspec-apply-change`、`openspec-sync-specs`、`openspec-archive-change`：仅由 Harness 对应步骤调用；
- `spec-review-debate`：tasks 后追溯与收敛硬门禁；
- `verification-before-completion`：测试、验收与归档前复核。

按需增强：

- `systematic-debugging`：失败恢复和 repair lane；
- `test-driven-development`：实现与缺陷修复；
- `requesting-code-review`：主要任务组完成后的评审；
- `openai-docs`：仅在最终选择 OpenAI API 时使用。

## 下一步

1. 新会话先读 `AGENTS.md`、`README.md`、`docs/STATUS.md`、`docs/PROJECT_MAP.md`、`docs/STARTUP_AUDIT.md` 和 `openspec/config.yaml`。
2. 运行 `git status --short --branch`、`openspec list`，再检查 Harness 对 `openspec/changes/build-serenity-intelligence-monitor` 的状态。
3. 使用 `harness-spec` 场景 A 初始化 change；建议 L2 驾驶模式。
4. 按 Harness 状态机进入 proposal，不提前实现业务代码。

## Repair lane

- 第 1 类“实现未满足既有规范”：当前 change 内做最小修复并补回归测试。
- 第 2 类“原目标必要行为但规范遗漏”：先更新 spec/design/test-checklist，再同步 tasks 和受影响审查。
- 第 3 类“新增需求或范围扩大”：新开 change。
- 第 4 类“环境、数据或操作问题”：先复现和解释，未证明为业务缺陷前不改业务代码。
- 当前 change 未解决第 1、2 类验收问题前不得归档；归档后的问题通过后续 Bug change 处理。
