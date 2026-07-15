# Serenity 配置、启动与真实联调

> 状态说明（2026-07-15）：Electron 家庭本地路径已实现并生成 Windows portable 产物；当前开发机没有 Docker CLI，真实服务生命周期仍待目标环境验证。下方开发者命令不是家庭用户操作步骤。

## 0. 家庭本地版目标流程

1. 运行自包含 `.exe`，无需安装 Node、打开终端或编辑 `.env`。
2. GUI 检查 Docker Desktop、Compose、虚拟化、端口、磁盘和权限；缺少 Docker 时显示中文安装与复查说明。
3. GUI 设置两个家庭账号、AI、可选 X 和可选飞书；Secret 保存后只显示是否已配置。
4. 启动器只用 Compose 管理 Serenity MySQL/Redis，并用 `utilityProcess` 管理 API/worker。
5. 一键启动、停止、检查健康、打开本机私有网页、备份和导出脱敏诊断。

OpenAI 官方 preset 推荐 `gpt-5.6-terra`；家庭 GUI 已支持 Responses-compatible 与 Chat Completions-compatible、自定义 HTTPS base URL/model 和 capability probe。任一能力缺失都会阻断启用，不自动 fallback。价格只取用户配置，不从模型名猜测。Sites、云端、远程访问及关机后持续运行延期到后续 change。

本文是 `build-serenity-intelligence-monitor` 的固定运维入口。系统只供家庭内部使用；爸爸只使用私有网页。飞书是可选的重要提醒渠道，第一版仅允许发送到需求提出者控制的私有群，不支持个人私聊或任意定向。

## 1. 安全准备

1. 开发/测试时可复制 `.env.example` 为 `.env`，只填写在开发机器本地；不得提交、截图或粘贴任何实际 Token、Webhook、签名密钥、Cookie、账号密码或持仓信息。该步骤不得用于家庭用户交付说明。
2. 运行 `pnpm account:hash` 两次，分别生成两个家庭账号的 scrypt 摘要。命令会隐藏输入，只输出摘要。
3. 将两个摘要写入 `FAMILY_ACCOUNTS_JSON`，两个对象的 `actorId` 和 `username` 必须唯一。爸爸和需求提出者各用自己的网页账号。
4. `SESSION_SECRET` 使用至少 32 字符的随机值。密码轮换时重新生成对应摘要；如需立即撤销全部旧会话，同时轮换 `SESSION_SECRET` 并重启 API。所有家庭成员随后重新登录。
5. `APP_BASE_URL` 在生产环境必须是私有站点的绝对 HTTPS 地址；飞书详情链接由它生成。

## 2. 核心配置

数据库与运行：

- `DATABASE_URL`、`REDIS_URL`
- `FAMILY_ACCOUNTS_JSON`、`SESSION_SECRET`、`SESSION_TTL_SECONDS`
- `APP_BASE_URL`
- `CORE_VISIBILITY_SLO_MINUTES`、`LEASE_SECONDS`、`MAX_ATTEMPTS`

X 官方接口：

- `X_API_BEARER_TOKEN`
- `X_PRODUCTION_SYNC_ENABLED=false`：初次配置和政策复核期间保持关闭
- `X_POLICY_CONFIRMED=false`：只有人工复核完成后才能改为 `true`
- `X_POLL_INTERVAL_SECONDS`、`X_COMPENSATION_INTERVAL_SECONDS`

政策复核必须在验收报告中记录复核人、时间、X 文档版本，以及允许获取和保留的字段。当前 allowlist 仅包括 Serenity 单账号帖子/回复/引用所需的平台 ID、作者、正文、发布时间、会话/引用/编辑关系和最小响应审计；不启用浏览器抓取、Cookie 获取或其他 X 信息源。

OpenAI：

- `AI_PROVIDER=openai`
- `OPENAI_MODEL=gpt-5.6-terra`
- `OPENAI_API_KEY`
- `OPENAI_INPUT_COST_PER_MILLION_CENTS`、`OPENAI_OUTPUT_COST_PER_MILLION_CENTS`
- `AI_MAX_REQUEST_COST_CENTS`、`AI_DAILY_BUDGET_CENTS`
- `AI_REASONING_EFFORT`

只有配置实际密钥时才填写经人工确认的价格与单次预算。预算或限流阻断后不会切换到其他模型；AI 仍隔离在适配器和配置边界后，未来可独立替换。

飞书（默认关闭）：

- `FEISHU_ENABLED=false`
- `FEISHU_WEBHOOK_URL=`
- `FEISHU_SIGNING_SECRET=`
- `FEISHU_COOLDOWN_SECONDS=3600`

未启用时保持后两项为空，系统不会创建 delivery、队列任务、重试或失败积压，网页归档、AI 分析、评分、搜索和查看不受影响。启用时必须把 Webhook 和签名密钥成对配置，并在飞书自定义机器人安全设置中开启“签名校验”；任一项缺失会机械阻断启动。目标必须是需求提出者控制的私有群。

## 3. 构建、迁移与启动

本地验证：

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
pnpm audit:secrets
```

容器部署：

```powershell
docker compose build
docker compose up -d db redis
docker compose run --rm api node dist/server/infrastructure/database/migrate.js
docker compose run --rm api node dist/server/bootstrap-source.js
docker compose up -d api worker
```

`bootstrap-source` 通过 X 官方服务端接口把 `@aleabitoreddit` 解析为稳定用户 ID；缺少 X Token 时必须失败，不得改用浏览器或 Mock。首次启动先保持 `X_PRODUCTION_SYNC_ENABLED=false`，完成政策和费用复核后再开启并重启 worker。

启动后检查：

1. `GET /api/health` 返回健康状态。
2. 只有 `/login` 和健康检查可公开访问；归档、详情、搜索、反馈和状态均要求家庭会话。
3. 爸爸只需打开 `APP_BASE_URL` 登录，无需安装或使用飞书。
4. `/status` 分开展示获取、上下文、AI、评分等核心阶段和可选通知分支；不得显示配置值或内部堆栈。

## 4. 真实联调顺序

1. 先在飞书关闭状态验证同一条真实内容的 X 获取、上下文、OpenAI `gpt-5.6-terra`、评分、网页详情和搜索闭环。
2. 再选择一条普通内容校准“普通归档、不提醒”。
3. 核对 X/OpenAI provider request ID、模型、token、费用和阶段关联 ID。
4. 爸爸用自己的网页账号，在不打开 X 和英文原文的前提下说明“发生了什么、谁说的、证据和不确定性”。
5. 只有已配置带安全签名的飞书时，才把同一条高价值内容纳入真实 delivery 验证；否则在报告中记录 `disabled`，核心闭环仍可通过。

真实凭据、Docker/HTTPS 环境或人工参与者缺失时，对应项目必须保持“待人工配置或验证”。Mock、样例截图、本地非容器运行和静态代码检查不能冒充真实 API、真实部署或爸爸人工理解验收。

## 5. 故障与恢复

- 明确的临时发送失败按上限退避重试，达到上限进入死信，可人工恢复。
- 签名拒绝或配置错误进入 `blocked`，修正配置后才允许人工恢复。
- 请求超时等结果未知进入 `outcome_unknown`，只允许对账，禁止自动重发。
- worker 在发送开始后中断时，超过外部请求时限与保护窗口的 `sending` 会转为 `outcome_unknown`，不会自动重发。
- 运行状态页只对 `blocked`/`dead_letter` 且明确允许人工恢复的通知显示重试；每次操作写入 `notification_recovery_requests`，旧 `notification_attempts` 保持不变。
- 飞书启用时，worker 会扫描已落库但尚无 delivery 的高重要性评分，先创建持久化 reservation，再发布稳定队列任务。
- 通知任务入队前已有数据库 reservation；队列发布失败时，worker dispatcher 会从 `pending` 记录恢复。
- 任何通知失败都不得回滚或阻塞已经完成的网页归档、AI 结果、评分、搜索和查看。
