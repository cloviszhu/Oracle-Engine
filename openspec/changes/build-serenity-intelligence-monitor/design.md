# build-serenity-intelligence-monitor — 技术设计

> 本 change 遵循 harness-spec 工作流；用户原声与验收清单以 `proposal.md` 为真相源，本设计不得降低其范围或证据门禁。

## 概述

本 change 在现有 React 19、NestJS 11、Drizzle/MySQL 8 和 BullMQ/Redis 7 基线上实现 Serenity（`@aleabitoreddit`）单信息源闭环。系统仅在服务端通过官方 X API 获取内容，以 MySQL 保存可审计事实和处理状态，以 BullMQ 执行可重试流水线；X、OpenAI 和可选飞书均通过适配器接入。私有网页是主要使用入口，浏览器只访问同源私有 API，不接触外部凭据。飞书未配置时，归档、OpenAI 分析、搜索和查看仍完整运行。第一阶段以可靠轮询和周期补偿为获取基线，不把 Filtered Stream、多个信息源、A 股公司级自动映射或任何交易能力纳入实现。

## 设计依据与现有边界

### 现有代码事实

- `server/app.module.ts` 目前只注册静态站点和健康检查，没有业务模块、数据库连接或队列消费者。
- `server/infrastructure/database/database.config.ts` 与 `server/infrastructure/queue/queue.config.ts` 已提供缺失配置失败可见的读取边界。
- `drizzle/schema.ts` 为空，允许本 change 首次定义业务表。
- `client/src/App.tsx` 只是初始化页，可在保持 Vite/React 入口不变的前提下替换为私有站点路由与页面。
- 测试使用 Vitest，前后端当前均为直接单元测试；本 change 延续该工具，并增加适配器契约、服务集成和 API 行为测试。

### 外部约束核对（2026-07-10）

- X `GET /2/users/{id}/tweets` 支持 `since_id`、分页游标、回复内容、`referenced_tweets` 和相关 expansions，适合作为单账号可靠轮询基线：<https://docs.x.com/x-api/users/get-posts>。
- X API 当前按使用量和读取资源计费，价格可能变化，控制台提供 spending limit；系统不能把固定单价写成业务常量：<https://docs.x.com/x-api/getting-started/pricing>。
- X 内容的保存、删除和展示受 Developer Policy、Agreement 与 Display Requirements 约束；生产启用前必须记录一次人工政策复核证据：<https://docs.x.com/developer-terms>。
- Filtered Stream 只作为未来可选实时输入，不替代轮询补偿：<https://docs.x.com/x-api/posts/filtered-stream/introduction>。
- 飞书自定义机器人仅作为本 change 的生产通知渠道：<https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot>。
- `yan-labs/serenity-aleabitoreddit` 当前未发现明确 License；不得复制或导入其代码、提示词或数据，只能参考高层分类思路。

## 技术决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| X 获取基线 | 官方用户帖子接口周期轮询 + 游标 + 重叠补偿 + 近期内容复核 | 单账号场景简单、可审计；断线不丢失；不依赖 Stream 套餐和长连接稳定性 |
| Filtered Stream | 第一阶段不实现，保留窄化的 `XContentSourceAdapter` 输入边界 | 避免把未验证套餐能力变成闭环前提，也不提前建设假多源框架 |
| 事实存储 | MySQL/Drizzle 保存内容、关系、卡片、评分、通知、反馈和处理审计 | 与现有技术基线一致，唯一约束和事务可保证幂等 |
| 异步执行 | BullMQ/Redis 负责调度和重试，MySQL 状态为可审计真相源 | Redis 负责执行效率，MySQL 防止队列丢失后无法判断业务状态 |
| AI 接入 | `ResearchModelAdapter` + 单一运行时实现 + Zod 结构化输出 | 便于 Mock、替换和严格字段校验；不让模型直接决定通知或调用工具 |
| 重要性 | 确定性加权评分器消费结构化特征，模型只能提供有证据的特征候选 | 可解释、可调、可测试，避免模型任意决定是否打扰用户 |
| 私有认证 | 两个预配置同权限家庭账号、无注册/角色系统、服务端 Redis 会话、HttpOnly/SameSite Cookie | 父亲与提出需求的用户可分别登录并追溯反馈，同时不引入多租户或复杂身份系统 |
| 家庭凭据 | 服务端配置保存 actor ID、用户名与 Node `scrypt` 密码摘要列表，`SESSION_SECRET` 签名会话 Cookie | 不保存明文密码；可单独轮换并撤销某个家庭账号会话，Secret 不进入数据库和前端 |
| 通知 | `NotificationAdapter`，本 change 仅实现可选且强制安全签名的飞书机器人 | 网页闭环不依赖通知，同时保留以后增加邮件/QQ 的清晰边界 |
| 搜索 | 低数据量阶段使用受限分页的文本匹配 + 规范化 ticker/topic 关系表 | 不假设部署环境已配置中文全文索引；后续有数据量证据再升级 |
| 部署 | 单 NestJS 进程承载 API/静态资源，独立 worker 进程消费队列；MySQL/Redis 为外部依赖 | 延续现有构建方式并隔离 Web 与后台任务故障，不引入集群和多租户 |
| 内容生命周期 | 活跃、已编辑、已删除、不可访问四态；删除/不可访问默认隐藏正文并清除受限原始载荷，只保留政策允许的最小 tombstone | 同时满足可追踪与平台政策；最终保留字段由生产前政策复核确认 |
| 时间与标识 | 数据库存 UTC；X ID、业务 ID、幂等键均作为字符串 | 避免大整数精度问题，前端按本地时区展示 |

## 总体架构

```text
X API
  │ XContentSourceAdapter
  ▼
ingest queue ─► 归档/去重 ─► context queue ─► 上下文图
                                      │
                                      ▼
                              analysis queue
                                      │
                        ResearchModelAdapter
                                      ▼
                              研究卡片 + 特征
                                      │
                         ImportanceScorer
                         ├─ 低分：仅归档
                         └─ 高分：notify queue
                                      │
                              FeishuAdapter

React 私有站点 ─► NestJS API ─► MySQL
                          ├────► Redis 会话
                          └────► 运行状态/人工反馈
```

所有队列作业只传内部 ID，不传 Token、Webhook 或完整帖子正文。每次业务事务同时创建唯一的下一阶段 `pending` 工作意图；dispatcher 再把工作意图投递到 BullMQ，reconciliation 只扫描该持久记录补偿“已提交未入队”窗口。lease claim 使用 owner、fencing token 和条件更新，过期 worker 的迟到完成不得覆盖新 owner。

## 模块划分

### 服务端业务模块

- `server/auth/`：登录、注销、会话 Guard、CSRF 校验和限速。
- `server/content/`：归档内容、关系图、详情、时间线和搜索。
- `server/ingestion/`：轮询计划、游标、补偿、内容 upsert、生命周期复核。
- `server/context/`：回复、引用与本地历史观点关联。
- `server/research/`：提示构造、结构化 AI 输出校验、卡片版本和观点演化。
- `server/importance/`：确定性评分、阈值和解释明细。
- `server/notifications/`：通知入队、去重、发送、重试和飞书实现。
- `server/feedback/`：固定枚举反馈与备注。
- `server/operations/`：流水线状态、失败记录、死信、用量和恢复入口。
- `server/worker.ts`：启动 BullMQ consumers；不暴露 HTTP。

### 构建与测试工程策略

- 服务端 TypeScript 使用 `rootDir: "."`、`outDir: "dist"` 并 include `server/**/*.ts`、`shared/**/*.ts`、`drizzle/**/*.ts`；现有 Nest `deleteOutDir=false` 保留先生成的 `dist/public`。构建后 API 保持 `dist/server/main.js`，worker 为 `dist/server/worker.js`，共享契约和 schema 分别位于 `dist/shared`、`dist/drizzle`，必须有 Node ESM 构建后导入测试。
- Vitest 拆分 Node service 项目与 jsdom UI 项目；前端交互采用 Testing Library，Nest API 采用 `@nestjs/testing` + Supertest。真实浏览器视觉/可理解性仍由 AC-19 人工验收，不以 jsdom 冒充。
- MySQL/Redis repository、唯一约束、BullMQ 和跨进程重启测试必须在具备 MySQL 8/Redis 7 的 CI/Compose 或目标环境运行；当前无 Docker 的本机只运行纯单元和 Mock 契约测试，报告保持分层。

### 基础设施适配器

- `server/infrastructure/x/content-source.adapter.ts`
  - `resolveAccount(username)`
  - `listUserContent({ userId, sinceId, paginationToken, maxResults })`
  - `lookupContent(ids)`
  - 返回规范化 DTO 和经脱敏的 provider metadata，不向业务层暴露 Bearer Token。
- `server/infrastructure/ai/research-model.adapter.ts`
  - `analyze(input, policy)` 返回通过 Zod 校验的 `ResearchCardDraft`、token usage 和 provider request ID。
  - 不提供浏览器、网络、文件、Secret 或工具调用能力。
- `server/infrastructure/notifications/notification.adapter.ts`
  - `send(message, idempotencyKey)` 返回 provider message ID 或分类错误。
- `server/infrastructure/database/`：Drizzle client、事务和 repository。
- `server/infrastructure/queue/`：队列注册、job scheduler、退避和死信约定。

## 数据设计

### 核心表

| 表 | 关键字段与约束 | 用途 |
|---|---|---|
| `source_accounts` | `id`、`provider`、`external_user_id`、`username`；唯一 `(provider, external_user_id)` | 本阶段固定一条 Serenity 配置，但不把账号写死到业务逻辑 |
| `source_sync_states` | `source_account_id` 唯一、`since_id`、`last_success_at`、`last_attempt_at`、`next_poll_at`、`status` | 轮询游标和补偿状态 |
| `ingestion_runs` | `id`、`mode`、`started_at`、`finished_at`、`status`、`pages`、`items`、`error_code` | 每次轮询/补偿/复核的审计记录 |
| `content_items` | `provider`、`external_id` 唯一；作者、URL、当前版本 ID、可见状态 | 内容稳定身份与当前可见状态 |
| `content_versions` | `content_id`、`external_edit_id/payload_hash` 唯一；原文、发布时间、抓取时间、`raw_payload` | 不可变内容版本；受政策约束时正文/载荷可清除但版本号、hash 和时间审计保留 |
| `content_lifecycle_events` | `content_id`、from/to、provider evidence、confirmed_at | 编辑、待确认、删除、不可访问与恢复的追加式状态历史 |
| `content_relations` | `from_content_id`、`relation_type`、`to_external_id`；唯一三元组 | reply、quote、edit predecessor、conversation 关系 |
| `processing_attempts` | `content_id`、`stage`、`status`、`attempt`、lease owner/fencing、错误分类、模型/API 版本；下一阶段唯一 pending 约束 | durable work intent、各阶段恢复与错误审计 |
| `research_cards` | `content_id`、`version` 唯一；翻译、作者判断、他人内容、AI 解释、推断、不确定性、证据、置信度、prompt/model 版本 | 不可混淆的信息分层和版本化研究结论 |
| `card_entities` | `card_id`、`type`、`normalized_value`、`display_value`、`verification_status` | 公司、Ticker、主题；A 股具体公司默认 `needs_verification` |
| `importance_scores` | `card_id`、各维度分数、权重快照、总分、阈值、决策、解释 | 可解释的重要性判断 |
| `notification_deliveries` | `channel`、`dedupe_key` 唯一、`status`、attempt、provider ID、错误、发送时间 | 防重复通知和失败恢复 |
| `user_feedback` | `card_id`、`actor_id`、`type`、`note`、时间 | 重要、已知、不相关、继续跟踪、翻译有误、分析有误 |
| `external_usage_records` | provider、operation、resource count、token usage、estimated/actual cost、request ID、时间 | X/AI 用量和预算审计，不保存 Secret |
| `budget_reservations` | provider、budget window、estimated/actual cost、status；原子额度约束 | 并发调用前预占、完成后结算，防止 worker 共同越过硬预算 |

`raw_payload` 只保存 API 实际返回且业务审计需要的字段，不保存请求 Authorization header。删除或不可访问事件触发受限字段清理；审计日志只能记录内部 ID、provider request ID、错误类别和计数。

### 枚举与状态机

- 内容可见性：`active → verification_pending → deleted | unavailable`，明确 provider 删除事件可直接确认；批量缺项、限流、权限变化或暂态错误只能进入非破坏性的待确认状态。编辑是 `content_versions` 的新增事件，不与可见性状态混用。重新可访问时允许恢复为 `active`。
- 核心流水线阶段：`ingest → context → analysis → score`；`notify` 是评分后的可选子分支，单独记录 delivery 状态。飞书未配置不得把已完成评分的内容标记为核心流水线失败。
- 处理状态：`pending → processing → succeeded | retryable_failed | blocked | dead_letter`；`blocked` 通过 `block_reason=budget|configuration|policy|permission` 区分，不自动重试；`dead_letter` 只有显式允许时才能创建新 attempt。lease 超时可由 reconciliation 回收，迟到 worker 受 fencing 拒绝。
- 通知：`pending → sending → sent | retryable_failed | outcome_unknown | blocked | dead_letter | suppressed`；`outcome_unknown` 代表 provider 可能已收但本地无确认，禁止盲目自动重发。
- 卡片置信度：`low | medium | high`，另保留 0–1 数值；上下文不足时不得标为 `high`。

## 获取、幂等与补偿

1. BullMQ Job Scheduler 周期创建 `poll-source:{sourceId}`，固定 job ID 防止同一周期重复调度。
2. worker 读取 `source_sync_states` 并创建 `ingestion_runs`。每页调用官方用户帖子接口，不排除 replies；请求所需 `referenced_tweets`、`conversation_id`、`edit_history_tweet_ids` 等字段与 expansions。
3. 以 `(provider, external_id)` upsert `content_items` 稳定身份，以 payload hash/平台 edit ID 幂等追加 `content_versions`；关系表使用唯一键 upsert，X ID 以字符串持久化但所有水位比较使用 `BigInt`/任意精度十进制语义。
4. 只有本轮所有页面持久化成功后才在同一事务推进 `since_id`。分页中途失败不推进游标，重跑依赖唯一键去重。
5. 周期补偿使用最后成功游标重新读取并允许重叠；另对近期活跃内容批量 lookup。只有明确删除证据或连续复核达到配置门槛才执行清理；批量部分响应、429、权限/网络异常先进入 `verification_pending`，保留旧正文但停止下游再使用。
6. 每次成功 upsert 后以 `context:{contentId}:{payloadHash}` 创建后续 job；卡片和通知使用内容版本参与幂等键。
7. 服务启动和定时 reconciliation 扫描 `pending`、过期 `processing`、可重试失败以及“数据库已提交但未入队”的记录，重新排队。
8. 429、5xx、网络超时为可重试错误，采用指数退避和 jitter；认证失败、预算耗尽、无权限为阻断错误，进入可见终态等待人工处理。

## 上下文构造

`ContextBuilder` 只使用实际已获取的数据：

- 首选当前响应 expansions 中的回复对象和引用内容；缺失时通过 `lookupContent(ids)` 补全并归档。
- 以 `content_relations` 构造有深度和条数上限的上下文图，防止循环与成本失控。
- 本地历史观点通过规范化 ticker/topic 和 Serenity 作者条件检索既有卡片，输出候选及证据链接；证据不足时标记“无法判断变化”。
- 外部 URL 仅作为未读取链接保存，不自动抓取；AI 输入明确列出“已获取材料”和“未读取链接”。
- 不可访问节点保留 `missing_reason`，禁止用模型猜测正文。

## AI 研究卡片与安全边界

### 结构化契约

`ResearchCardDraft` 至少包含：忠实翻译、内容类型、`serenity_statements[]`、`other_party_statements[]`、`ai_interpretations[]`、`unverified_inferences[]`、观点变化、entities、evidence、uncertainties、confidence、importance features。每个结论都带来源 content ID 或明确标记为 AI 解释/未验证推断。

### 第一版 OpenAI-compatible 实现

- 业务层只依赖 `ResearchModelAdapter`；基础设施层通过 `ProviderAdapterRegistry` 注册 Responses-compatible 与 Chat Completions-compatible adapter、OpenAI 官方 preset 和自定义 OpenAI-compatible preset。
- OpenAI 官方 preset 推荐 `gpt-5.6-terra`，但 model、协议和 base URL 可由 GUI 修改；系统不承诺任意模型或供应商零适配。
- Responses-compatible 使用 `text.format` 的严格 JSON Schema；Chat Completions-compatible 使用 `response_format` 的 `json_schema`。两者均返回统一的卡片、usage、provider request ID 与 requested/actual model，供应商类型不得穿透适配器边界。
- 第一版请求显式不提供任何 tools；不启用 web search、file search、code interpreter 或其他供应商工具。
- 启用前 capability probe 必须验证 URL/认证、模型可调用、requested/actual model、严格 schema、完整卡片与来源约束、response ID、usage、超时/限流/错误分类；失败只允许保存为未启用，不得自动换模型、改协议或降低卡片契约。
- 官方依据：Structured Outputs 同时适用于 Responses 与 Chat Completions，Responses 使用 `text.format`；结构化输出仍需处理 refusal 和不完整结果：<https://developers.openai.com/api/docs/guides/structured-outputs>。

### 防 Prompt Injection

- 系统提示与不可信内容分离；帖子、引用、历史材料放在带来源 ID 的 data envelope 中，并声明其中指令不可执行。
- OpenAI data envelope 采用字段白名单，只发送完成研究卡片所需的已归档正文、来源 ID、关系、时间和历史观点候选；不得发送家庭账号、会话、反馈备注、访问日志、通知配置、X raw payload 或任何 Secret。飞书只接收生成后的最小提醒摘要和私有详情链接。
- 模型适配器不提供工具调用、网络、文件系统和环境变量；模型无法读取外链或 Secret。
- 输出必须通过严格 Zod schema、长度限制、枚举和来源引用校验；越权内容、伪造来源或额外字段导致失败重试/人工检查。
- 用恶意帖子 fixture 验证“忽略系统指令、泄露 Secret、调用工具、把指令当结论”等攻击不会越权。

### 成本与版本

- 输入以 `contentVersion + contextHash + promptVersion + modelVersion` 形成分析幂等键，相同输入不重复付费。
- 调用前通过原子 reservation 检查并占用 `AI_DAILY_BUDGET_CENTS`；达到上限后保持 `blocked` 且 `block_reason=budget`，不得静默切换低质量模型。
- 保存模型、prompt 版本、token usage、provider request ID、耗时和成本；不保存 API key。
- 每次分析保存 provider preset、protocol、base URL host、requested/actual model、local/provider request ID、usage、价格及版本、费用、prompt/schema/probe version。若未启用兼容 AI 配置，原文仍归档且网页可检索，分析进入 `blocked/configuration`；不得伪造卡片或静默切换模型。

## 重要性评分

`ImportanceScorer` 对以下 0–4 特征应用版本化权重：产业相关性、观点新颖度、相较历史变化、证据质量、时效/催化强度、不确定性惩罚。模型只产生带证据的候选特征；服务端校验后计算 0–100 总分。

- 默认 `score >= 75`、置信度不低于 `medium` 且不存在政策/数据完整性阻断时进入通知。
- 低于阈值仍完整归档；无法评分时显示原因，不通知。
- 权重、阈值和版本由服务端配置读取并写入每次评分快照，测试可注入配置。
- 第一阶段用户反馈只用于人工回看和后续调参证据，不自动在线学习或改变权重。

## 通知设计

- `NotificationPolicy` 始终保存“符合提醒条件”的评分事实。仅当 `FEISHU_ENABLED=true` 时创建 delivery；默认禁用时渠道状态为 `disabled`，不创建发送 intent、不入队、不重试、不计入失败/积压。技术 delivery key 继续包含 card/policy version；另以内容事件 ID + 用户提醒策略维护用户感知去重与 cooldown，单纯模型/prompt/策略重算不得再次打扰，只有正文实质编辑、观点实质变化或管理员明确重发才允许新提醒。
- 飞书是可选提醒而不是使用入口。第一版由提出需求的用户控制的私有飞书群 Webhook 接收，父亲只使用私有网页；不实现个人私聊或任意用户定向发送。
- 飞书消息使用稳定事件 ID，并只包含保留不确定性标签的分层摘要、重要性理由、内容 ID 和由受校验本机 base URL 生成的回环详情链接；消息明确该链接只能在运行 Serenity 的同一台电脑打开，不暗示手机或跨设备访问。不包含 Token、Webhook、签名密钥、完整 raw payload 或未经验证的 A 股公司结论。
- 启用开关、Webhook 与安全签名密钥仅从服务端 `FEISHU_ENABLED`、`FEISHU_WEBHOOK_URL`、`FEISHU_SIGNING_SECRET` 读取；启用飞书必须后两者同时存在并按飞书机器人协议为每次请求生成带时间戳的签名，缺一即不发送。请求和错误日志对 URL、签名和密钥完全脱敏。
- 成功响应保存 provider message ID；明确拒绝、连接建立前失败、429、5xx 按分类重试；请求已经发送但响应超时/进程在发送后落库前崩溃时进入 `outcome_unknown`，不自动重发，由管理员核对后显式处理。只有真实联调证明 provider 支持幂等/结果查询时才能收紧为自动补偿。
- `FEISHU_ENABLED=false` 时状态页显示渠道已禁用但不显示故障；`FEISHU_ENABLED=true` 且 Webhook 或签名密钥缺失时才创建/保留 `blocked/configuration` 状态。两种情况下归档、OpenAI 分析、评分、搜索和网页查看均继续运行。

## 私有认证与 API

### 认证

- `/api/auth/login` 在两个预配置家庭账号列表中查找用户名并校验对应 `scrypt` 密码摘要，比较使用恒定时间函数；失败统一返回通用错误并按账号/IP 限速。
- 登录成功后生成 256-bit 随机会话 token，Cookie 使用 `HttpOnly`、`SameSite=Strict`、生产环境 `Secure` 并由 `SESSION_SECRET` 签名；Redis 只保存 token 哈希、actor、创建时间和绝对 TTL。注销、Redis 记录删除或 Secret 轮换后旧 Cookie 必须失效。
- 除 `/api/health` 和登录接口外，所有 API 由 `SessionGuard` 保护。写请求额外校验 CSRF token 与 Origin。
- 两个账号权限相同，无公开注册、找回密码、多角色、OAuth 或多租户；账号密码摘要轮换会撤销该 actor 的全部会话。任一必需家庭账号配置缺失时生产启动失败可见，外网部署必须启用 HTTPS。

### API 契约

| 方法与路径 | 行为 |
|---|---|
| `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session` | 私有会话生命周期 |
| `GET /api/intelligence` | 最新/历史分页，支持 keyword、ticker、topic、importance、contentType、date range |
| `GET /api/intelligence/:id` | 内容、上下文图、卡片、评分、通知状态和反馈 |
| `POST /api/intelligence/:id/feedback` | 提交固定枚举反馈和可选短备注 |
| `GET /api/operations/status` | ingestion run（poll/compensation mode）、ingest/context/analysis/score 核心阶段、可选 notify 分支、worker heartbeat、阻断/失败摘要 |
| `GET /api/operations/audit/:runId` | 管理员读取脱敏 ingestion/provider/attempt 证据，不返回 raw payload 或 Secret |
| `POST /api/operations/retry/:attemptId` | 仅管理员对明确 `manual_retry_allowed` 的 blocked/dead-letter 任务创建新 attempt；不可恢复终态拒绝请求 |

列表 API 使用白名单排序、上限 100 的游标分页和转义后的查询条件。响应 DTO 位于 `shared/contracts/`，不返回 `raw_payload`、内部错误栈、Secret 或 provider credentials。

## 前端设计

- `/login`：管理员登录，错误信息不泄露账号是否存在。
- `/`：最新情报卡片列表，显示内容类型、时间、主题、评分、置信度和通知状态。
- `/timeline`：历史时间线及 keyword/ticker/topic/importance/contentType 筛选。
- `/intelligence/:id`：原文与来源、忠实翻译、Serenity 判断、他人内容、AI 解释、未验证推断、证据、不确定性、观点变化和上下文图分区展示。
- `/status`：最近各阶段状态、失败原因、待配置项和可恢复操作。
- 状态页展示从 X 首次成功观察到研究卡片网页可见的耗时。默认 `CORE_VISIBILITY_SLO_MINUTES=30`，超目标只告警并显示阻塞阶段，不丢弃或跳过处理。
- 反馈按钮固定为“重要、已知、不相关、继续跟踪、翻译有误、分析有误”，提交后显示时间和当前选择。

NestJS 静态交付 MUST 对非 `/api/**` 且非真实静态文件的 GET 请求回退到 `dist/public/index.html`，使飞书绝对详情链接、`/timeline`、`/status` 和详情页刷新可用；API 404 不得被 SPA fallback 吞掉。

前端不读取 X、AI 或飞书环境变量，不直接请求外部 API；所有错误页仅展示稳定错误码和面向用户的说明。

## 运行状态、日志和恢复

- 结构化日志字段仅包含 correlation ID、内部实体 ID、stage、attempt、duration 和错误分类；建立集中脱敏函数过滤 URL query、Authorization、Cookie 和已知 Secret 形式。
- `/api/health` 保持当前稳定响应；私有状态页另展示 MySQL/Redis、队列 backlog、最后成功时间和配置状态，不回显配置值。
- worker 在处理前取得数据库 lease，在完成/失败时更新 attempt；进程崩溃后 lease 到期可恢复。
- 超过最大重试次数进入 `dead_letter`；只有 `manual_retry_allowed=true` 时管理员才能创建新 attempt chain，不覆盖历史。政策/权限等不可恢复 `blocked` 状态不展示虚假重试入口。
- 数据源、模型和通知分别有断路/预算状态，禁止把失败记作成功。

## Secret、合规和投资边界

- Secret 仅来自服务端环境变量；Secret 扫描覆盖源码、前端产物、日志 fixture、错误快照和 Git diff。
- 禁止浏览器 Cookie、模拟登录、X 抓取插件、微信/QQ Hook、远程控制和客户端直接调用海外服务。
- 系统没有券商、持仓、行情、组合、回测、交易指令或自动交易接口；研究卡片模板明确“研究辅助、非交易指令”。
- A 股只允许行业/产业方向的谨慎相关性描述；具体公司实体默认 `needs_verification`，没有可核查证据不得生成受益名单。
- X 生产启用前必须人工确认 Developer Policy、Agreement、Display Requirements 与删除处理；政策未确认时真实同步保持关闭。

## 测试与验收策略

### 自动化与 Mock

- repository/服务单元测试：唯一键、事务、游标推进、状态机、评分和权限。
- 适配器契约测试：X 分页/expansions/429/删除、AI schema/注入/预算、飞书成功/超时/重复。
- 服务集成测试：fixture 从 ingest 到通知/静默归档，重复运行不产生重复数据。
- 恢复测试：队列中断、进程在各阶段崩溃、lease 超时、入队失败和死信显式可见。
- API/页面测试：未认证拒绝、筛选、详情分层、反馈和状态页。
- Secret 测试：`pnpm audit:secrets` 加前端 bundle、日志与错误响应断言。

### 真实 API 与人工验收

- X：需要 Developer 账号、credits、Bearer Token 和政策确认；记录真实获取证据与资源成本。
- AI：使用已通过 probe 的真实配置和预算；分别记录 Responses-compatible 或 Chat Completions-compatible 协议、requested/actual model、严格结构化输出、翻译、证据引用、不确定性与注入边界。
- 飞书：仅在用户选择启用时配置真实机器人 Webhook 与安全签名密钥，验证签名请求、单条高价值通知和去重；未启用不阻塞核心网页闭环。
- 认证/部署：在最终私有部署环境验证 HTTPS、Secure Cookie、重启恢复和网络访问边界。
- Docker 当前不可用，因此容器验证必须标为待人工/目标环境验证，不能由本地 Mock 代替。

验收报告必须按“自动化已验证 / Mock 已验证 / 真实 API 已验证 / 待人工配置或验证”四类记录证据。

## 部署与迁移顺序

1. 先确定服务端可导入 `shared/` 与 `drizzle/` 的 TypeScript/ESM 构建策略，并为 API、worker 分别生成可运行产物与构建后导入测试。
2. 生成、审查并通过显式 `db:migrate` 在空库应用 Drizzle migration；生产禁止用 `db:push` 代替版本化迁移，执行前记录备份/停用同步步骤，失败时停止 API/worker 并恢复应用版本或向前修复。
3. 以幂等 bootstrap 将稳定 X user ID 绑定到 `@aleabitoreddit`，handle 变化只更新显示值，身份不随 handle 漂移。
4. 由 GUI 配置 MySQL/Redis 本地连接、两名家庭账号、Session Secret、外部服务与运行上限；Electron main 把 Secret 存入 DPAPI vault，并通过私有进程 IPC 传递运行快照。
5. 启动器只用 Compose 管理 MySQL/Redis，并用 Electron `utilityProcess` 启动 API/worker；验证 liveness、readiness、worker heartbeat、优雅退出和 reconciliation。
6. 配置 X 凭据和预算并记录政策确认人、时间、政策版本及允许 tombstone 字段后启用单账号轮询。
7. 通过 GUI 配置 AI preset/protocol/base URL/model/价格/预算并通过 probe；如启用飞书，再同时配置 Webhook 与安全签名密钥完成可选通知联调。任何一步失败均保留在状态页，不回滚已归档事实。
8. 本地无 Docker 时，单元/Mock 测试可继续；MySQL/Redis 跨进程恢复、Node 20 镜像与目标部署证据保持待 CI/目标环境验证，不得以内存 Mock 替代。

## Repair lane

- 第 1 类“实现未满足既有规范”：在本 change 内最小修复，增加对应 AC 的回归测试，不改目标范围。
- 第 2 类“原目标必要行为但规范遗漏”：先同步更新 proposal、相关 spec、design、test-checklist 和 tasks，再重跑受影响审查与测试。
- 第 3 类“新增需求或范围扩大”：新建 change；多账号、新闻抓取、公司级映射和新通知渠道均属于此类。
- 第 4 类“环境、数据或操作问题”：先用 ingestion run、processing attempt 和 provider request ID 复现解释；未证明是业务缺陷前不改代码。
- 第 1、2 类未关闭前不得归档；修复不得通过降低断言、伪造 Mock 或把待人工项标记通过来收敛。

## 实现路径概述

### 2026-07-15 家庭本地版交付修订

本节取代与固定模型、手工 `.env`、开发者命令和 API/worker 容器运行方式冲突的旧条款；未受影响的研究流水线、网页、X、评分和可选飞书设计继续有效。

#### Electron 组件和信任边界

- `desktop/main/`：bootstrap、DPAPI vault、环境检查、Compose、migration、`utilityProcess`、备份、诊断、窗口和托盘。
- `desktop/preload/`：只暴露 `getSetupStatus`、`runEnvironmentChecks`、`saveSettings`、`probeAI`、`startSerenity`、`stopSerenity`、`getHealth`、`openWorkspace`、`createBackup`、`exportDiagnostics`；禁止通用 `ipcRenderer`、文件系统、shell 和进程执行接口。
- `desktop/renderer/`：首次设置和启动器管理 UI；生产窗口启用 `contextIsolation`、sandbox、严格 CSP，关闭 Node integration。
- 现有 `client/`：父亲和家庭用户日常使用的本机私有网页，不承担 Secret 配置。

Secret 输入只在当前控件内短暂存在，提交后清空。IPC 读取、诊断和设置摘要只返回 `configured`、更新时间和允许的脱敏标识。renderer 不把 Secret 写入 `localStorage`、`sessionStorage`、IndexedDB、URL、路由状态、剪贴板、错误对象或持久化表单缓存。

#### 配置库和 DPAPI vault

配置目录固定在 `%LOCALAPPDATA%\Serenity`。非敏感元数据与加密 vault 分离；Electron main 使用 `safeStorage`，Windows 上由 DPAPI 保护，并把目录 ACL 限制为当前用户。若加密或 ACL 设置失败，保存必须失败且给出中文说明，禁止退回明文。

两名家庭账号在 main 内使用随机盐与现有 `scrypt` 契约生成摘要；密码原值不写盘、不回显。修改某账号密码后撤销该 actor 的会话。DPAPI 只隔离其他 Windows 用户，不能抵御同一用户权限下的恶意程序，操作文档必须明确这一边界。

API/worker 不通过 `.env`、命令行参数或 Docker inspect 接收 Secret。Electron main 解密后，把一次性 `RuntimeConfigSnapshot` 通过受控 `utilityProcess` 私有 IPC 传入；开发/测试命令仍可使用 `.env.example`，但不是家庭生产路径。

#### 环境检查和服务生命周期

环境检查覆盖 Windows 版本、Docker Desktop、Docker engine、Compose、虚拟化、端口、磁盘空间和目录权限。Docker 缺失时 GUI 仍可运行，显示组件用途、官方安装入口和“重新检查”，不静默安装。

Compose 只运行 MySQL 与 Redis，只绑定 `127.0.0.1` 的随机或已验证端口。启动器使用固定 Serenity project name，不得停止 Docker Desktop 或其他 Compose project。API/worker 使用 Electron `utilityProcess` 运行打包内 Node 运行时。

启动顺序：目录/端口检查 → Docker engine → MySQL/Redis 健康 → 幂等 migration → API 健康 → worker heartbeat → 打开网页。停止顺序：停止接收新任务 → worker 到可恢复边界 → API → Serenity 容器。关闭窗口缩入托盘；只有明确“停止 Serenity 并退出”执行停止顺序。

#### 首次设置和日常管理

首次设置在数据库未启动时可用，依次完成环境检查、两个家庭账号、AI、可选 X、可选飞书和完成页。X 默认关闭，未配置时零真实请求并显示“X 未配置，尚未进行真实同步”。飞书默认跳过；启用必须同时填写 Webhook 与签名密钥并通过签名测试。

完成页分别显示 MySQL、Redis、AI、X、飞书的成功、跳过或失败。日常界面提供启动、停止、健康检查、打开网页、修改设置、备份和脱敏诊断；错误统一映射为环境缺失、权限不足、端口占用、Docker 未运行、依赖不健康、migration 失败、API/worker 启动失败、外部未配置、认证失败、模型不存在、结构化输出不兼容、限流、预算阻断、provider 暂时不可用和通知结果未知。

#### AI registry 和 probe

GUI 字段包括 provider preset、protocol、base URL、API Key、model、reasoning、输入/输出价格、单次预算和每日预算。自定义 URL 禁止用户名、密码、query 和 fragment；非回环地址必须 HTTPS。

`ProviderAdapterRegistry` 根据 `providerPreset + protocol` 构造 adapter。本轮只实现 OpenAI 官方 preset、自定义 OpenAI-compatible preset、Responses-compatible 和 Chat Completions-compatible；Anthropic/Gemini 原生协议只保留注册扩展点。

probe 验证 URL/协议/认证、requested/actual model、严格 JSON Schema、完整研究卡片与来源约束、response ID、usage、超时/限流/错误分类。actual model 与 requested model 不同不得静默通过；GUI 显示两者，无法解释的替换直接阻断。失败配置可保存为未启用，但 worker 不得使用。

#### 备份、诊断和延期边界

备份包含 MySQL 一致性导出、非敏感配置清单、版本信息和 DPAPI 密文副本。Redis 不是长期事实来源。跨电脑或 Windows 用户恢复数据库和非敏感配置后必须重新输入 Secret。

诊断包包含版本、健康、端口、容器状态、最近脱敏错误类别和日志片段；导出前执行 canary Secret 扫描，命中即拒绝导出。

第一版网页只供同一台 Windows 电脑访问。Sites、电脑关机后持续运行、云端 API/worker/MySQL/Redis、云端 KMS、远程 HTTPS/安全访问、云端备份和云厂商选择延期到第二阶段；当前不创建 `.openai/hosting.json`，不发布 Sites，不选择 Azure/AWS/GCP。

> 下列路径和符号均为 design 阶段预判，“猜测”不代表已实现。

### AC-1：真实 X API 获取及审计
- **涉及模块/文件（猜测）**：`server/ingestion/`、`server/infrastructure/x/`、`drizzle/schema.ts`
- **关键函数/类（猜测）**：`XContentSourceAdapter.listUserContent`、`PollSourceService.execute`
- **数据流**：X API → 规范化 DTO → ingestion transaction → 内容与 run 审计
- **验证点**：真实凭据获取至少一条内容；缺少凭据时明确标记未真实验证

### AC-2：回复、引用和历史上下文
- **涉及模块/文件（猜测）**：`server/context/`、`server/content/`
- **关键函数/类（猜测）**：`ContextBuilder.build`、`ContentRepository.upsertRelations`
- **数据流**：内容引用 ID → expansions/lookup → 关系图 → 本地历史候选
- **验证点**：主帖、回复、引用 fixture；缺失节点显式展示原因

### AC-3：端到端幂等
- **涉及模块/文件（猜测）**：`server/ingestion/`、`server/research/`、`server/notifications/`、数据库迁移
- **关键函数/类（猜测）**：`ContentRepository.upsert`、`AnalysisKeyFactory`、`NotificationPolicy`
- **数据流**：外部 ID/内容版本 → 唯一键 → 各阶段稳定 job/dedupe key
- **验证点**：重复轮询、重试、重启后内容/卡片/通知数量不增加

### AC-4：编辑、删除和不可访问
- **涉及模块/文件（猜测）**：`server/ingestion/content-lifecycle.service.ts`、`server/operations/`
- **关键函数/类（猜测）**：`ContentLifecycleService.reconcile`
- **数据流**：近期 lookup → 状态比较 → 版本/隐藏/清理 → 审计
- **验证点**：四态转换、正文隐藏、最小 tombstone、政策复核门禁

### AC-5：结构化中文研究卡片
- **涉及模块/文件（猜测）**：`server/research/`、`shared/contracts/research-card.ts`
- **关键函数/类（猜测）**：`ResearchPipeline.analyze`、`ResearchCardDraftSchema`
- **数据流**：可信边界化上下文 → AI adapter → schema 校验 → 版本化卡片
- **验证点**：必填字段和四类信息层次均可判定，不混淆来源

### AC-6：信息质量人工抽查
- **涉及模块/文件（猜测）**：`server/research/prompt-policy.ts`、`client/src/pages/IntelligenceDetailPage.tsx`
- **关键函数/类（猜测）**：`PromptPolicyBuilder`、`ResearchCardSections`
- **数据流**：来源证据 → 分层输出 → 详情页人工核查
- **验证点**：翻译忠实、未读外链声明、无无证据 A 股名单、变化不足明确说明

### AC-7：可解释重要性
- **涉及模块/文件（猜测）**：`server/importance/`
- **关键函数/类（猜测）**：`ImportanceScorer.score`
- **数据流**：带证据特征 + 权重快照 → 确定性总分 → notify/suppress
- **验证点**：高低价值 fixture、阈值注入、模型不能覆盖决策

### AC-8：通知恢复与去重
- **涉及模块/文件（猜测）**：`server/notifications/`、`server/infrastructure/notifications/`
- **关键函数/类（猜测）**：`NotificationWorker.process`、`NotificationRepository.reserve`
- **数据流**：评分决策 → delivery 唯一键 → 飞书适配器 → 状态/重试
- **验证点**：失败、超时、重试不丢失且不重复

### AC-9：可选且安全签名的真实飞书提醒
- **涉及模块/文件（猜测）**：`server/infrastructure/notifications/feishu.adapter.ts`
- **关键函数/类（猜测）**：`FeishuNotificationAdapter.send`
- **数据流**：脱敏消息 → 服务端 Webhook → provider result → 私有详情链接
- **验证点**：默认禁用时零 delivery/零失败积压；显式启用但配置不全时 `blocked/configuration`；完整配置时以安全签名真实发送一条

### AC-10：私有访问和检索
- **涉及模块/文件（猜测）**：`server/auth/`、`server/content/`、`client/src/pages/`
- **关键函数/类（猜测）**：`SessionGuard`、`IntelligenceQueryService`、`TimelinePage`
- **数据流**：会话 Cookie → Guard → 白名单筛选查询 → 列表/详情
- **验证点**：未认证拒绝，认证用户可浏览、搜索和组合筛选

### AC-11：用户反馈
- **涉及模块/文件（猜测）**：`server/feedback/`、`client/src/components/FeedbackControls.tsx`
- **关键函数/类（猜测）**：`FeedbackService.create`
- **数据流**：固定枚举 + card/actor → 追加式反馈记录 → 页面回显
- **验证点**：六种反馈可追溯且不修改原始内容

### AC-12：运行状态
- **涉及模块/文件（猜测）**：`server/operations/`、`client/src/pages/StatusPage.tsx`
- **关键函数/类（猜测）**：`OperationsQueryService.getSnapshot`
- **数据流**：run/attempt/delivery 聚合 → 私有状态 API → 状态页
- **验证点**：最近成功、失败原因、待配置项和恢复入口均可见

### AC-13：故障恢复
- **涉及模块/文件（猜测）**：`server/operations/reconciliation.service.ts`、`server/infrastructure/queue/`
- **关键函数/类（猜测）**：`ReconciliationService.requeueRecoverable`
- **数据流**：过期 lease/失败状态 → 分类 → 重排或终态/死信
- **验证点**：六类故障和进程重启均不静默丢失

### AC-14：Prompt Injection 防护
- **涉及模块/文件（猜测）**：`server/research/untrusted-input.ts`、`server/research/prompt-policy.ts`
- **关键函数/类（猜测）**：`UntrustedEnvelopeBuilder`、`ResearchOutputValidator`
- **数据流**：不可信文本 → data envelope → 无工具模型 → 严格 schema
- **验证点**：恶意 fixture 不能改变系统指令、读取 Secret 或伪造结论

### AC-15：Secret 隔离
- **涉及模块/文件（猜测）**：`server/infrastructure/config/`、`scripts/audit-secrets.mjs`、日志测试
- **关键函数/类（猜测）**：`SecretConfig`、`redactLogFields`
- **数据流**：服务端环境变量 → 适配器；对外 DTO/日志只含脱敏元数据
- **验证点**：源码、bundle、API、日志、错误快照和 Git 扫描无 Secret

### AC-16：只读研究边界
- **涉及模块/文件（猜测）**：模块依赖测试、API 路由清单、研究输出 schema
- **关键函数/类（猜测）**：`ReadonlyBoundaryPolicy`
- **数据流**：研究内容只进入归档/分析/通知，不产生账户或交易动作
- **验证点**：不存在券商、持仓、行情、交易、Cookie 抓取或 Hook 接口

### AC-17：版本和成本控制
- **涉及模块/文件（猜测）**：`server/operations/usage/`、X/AI adapters
- **关键函数/类（猜测）**：`UsageRecorder`、`BudgetGuard`
- **数据流**：调用前预算检查 → provider 调用 → usage/cost/version 审计
- **验证点**：达到预算停止新调用并显示原因，不静默降质

### AC-18：验收证据分层
- **涉及模块/文件（猜测）**：`test-checklist.md`、测试报告与人工验收记录
- **关键函数/类（猜测）**：`VerificationEvidence` 文档契约
- **数据流**：每条 TC 结果 → 自动化/Mock/真实 API/待人工分类 → 验收汇总
- **验证点**：Docker、部署、认证和外部凭据未验证项不得标记通过

### AC-19：同一真实内容端到端闭环
- **涉及模块/文件（猜测）**：全部业务模块、真实 X/AI/飞书适配器、`client/src/`、验收报告
- **关键函数/类（猜测）**：`PollSourceService`、`ContextBuilder`、`ResearchPipeline`、`ImportanceScorer`、`NotificationWorker`、私有详情/反馈/状态 API
- **数据流**：同一真实 X external ID → content/version/run → context → 真实模型 card/request ID → score → delivery/provider ID → 飞书绝对链接 → 同一私有详情；普通样本止于归档
- **验证点**：所有内部/外部 ID 连续可追溯；人工完成登录、筛选、详情分层、反馈和状态查看；真实普通样本不通知；任一凭据缺失则保持未验收

## 原声对照表

| 验收项 | design 覆盖点 | 备注 |
|---|---|---|
| AC-1 | 获取、幂等与补偿；基础设施适配器 | 官方 X API，真实凭据单独验收 |
| AC-2 | 上下文构造 | 不猜测缺失内容 |
| AC-3 | 数据设计；获取、幂等与补偿 | 数据库唯一键 + 稳定作业键 |
| AC-4 | 数据状态机；内容生命周期 | 生产前政策复核 |
| AC-5 | AI 研究卡片与安全边界 | 严格结构化分层 |
| AC-6 | OpenAI Responses API；AI 结构化契约；前端详情页 | 需要 `gpt-5.6-terra` 真实内容人工抽查 |
| AC-7 | 重要性评分 | 服务端确定性决策 |
| AC-8 | 通知设计；运行状态与恢复 | delivery 唯一键和可见失败 |
| AC-9 | 通知设计 | 飞书是唯一可选实现渠道，启用即强制安全签名 |
| AC-10 | 私有认证与 API；前端设计 | 网页为主要入口，两个同权限家庭账号、无注册 |
| AC-11 | 数据设计；API；前端设计 | 追加式反馈记录 |
| AC-12 | 运行状态、日志和恢复 | 私有状态 API |
| AC-13 | 获取补偿；运行状态和恢复 | lease + reconciliation + 终态 |
| AC-14 | 防 Prompt Injection | 无工具模型 + data envelope |
| AC-15 | Secret、合规和投资边界 | 服务端配置与全链路脱敏 |
| AC-16 | Secret、合规和投资边界 | 明确排除交易与抓取越界 |
| AC-17 | AI 成本与版本；外部用量表 | 硬预算和版本审计 |
| AC-18 | 测试与验收策略 | 四类证据严格区分 |
| AC-19 | 真实 API 与人工验收；部署与迁移顺序 | 同一业务事件贯穿核心网页闭环，飞书按配置追加验证 |
| AC-20 | Electron 组件；首次设置与日常管理 | GUI-only 首启与自包含 Windows 产物 |
| AC-21 | 环境检查和服务生命周期 | Docker 缺失时仍可中文引导 |
| AC-22 | 配置库和 DPAPI vault；Electron 信任边界 | 窄 IPC 与 Secret 零回显 |
| AC-23 | 环境检查和服务生命周期 | Serenity 专属 Compose 与 utilityProcess |
| AC-24 | AI registry 和 probe | 双协议、requested/actual model 与严格门禁 |
| AC-25 | 首次设置和日常管理 | X/飞书默认关闭且零真实副作用 |
| AC-26 | 备份、诊断和延期边界 | DPAPI 恢复边界与 canary 拒绝导出 |

## 自审结论

- 26 条 AC 均有模块、数据流和验证路径；Sites、云端、远程访问、关机后运行、多个 X 账号、外部网页抓取、A 股公司级映射或多通知渠道均未扩大进本 change。
- 所有外部调用均位于适配器边界；真实 X、AI、飞书、Docker 和部署验证均未被设计文档误写为已通过。
- repair lane 已覆盖规范回写、最小修复、范围扩展和环境问题四类路径。
- 当前无阻止进入代码检索和 test-checklist 的设计级硬阻塞；生产启用仍受外部凭据、预算、政策与部署环境人工确认约束。
