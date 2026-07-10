# build-serenity-intelligence-monitor — 技术设计

## 概述

本 change 在现有 React 19、NestJS 11、Drizzle/MySQL 8 和 BullMQ/Redis 7 基线上实现 Serenity（`@aleabitoreddit`）单信息源闭环。系统仅在服务端通过官方 X API 获取内容，以 MySQL 保存可审计事实和处理状态，以 BullMQ 执行可重试流水线；AI、X、飞书均通过适配器接入。浏览器只访问同源私有 API，不接触外部凭据。第一阶段以可靠轮询和周期补偿为获取基线，不把 Filtered Stream、多个信息源、A 股公司级自动映射或任何交易能力纳入实现。

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
| 私有认证 | 单管理员、无注册、服务端 Redis 会话、HttpOnly/SameSite Cookie | 符合家庭内部使用，避免引入多租户和复杂身份系统 |
| 管理员凭据 | 环境变量保存用户名与 Node `scrypt` 密码摘要，`SESSION_SECRET` 签名会话 Cookie | 不保存明文密码，避免额外密码库依赖，Secret 不进入数据库和前端 |
| 通知 | `NotificationAdapter`，本 change 仅实现飞书机器人 | 满足一个渠道闭环，同时保留以后增加邮件/QQ 的清晰边界 |
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
- 流水线阶段：`ingest → context → analysis → score → notify`。
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

### 防 Prompt Injection

- 系统提示与不可信内容分离；帖子、引用、历史材料放在带来源 ID 的 data envelope 中，并声明其中指令不可执行。
- 模型适配器不提供工具调用、网络、文件系统和环境变量；模型无法读取外链或 Secret。
- 输出必须通过严格 Zod schema、长度限制、枚举和来源引用校验；越权内容、伪造来源或额外字段导致失败重试/人工检查。
- 用恶意帖子 fixture 验证“忽略系统指令、泄露 Secret、调用工具、把指令当结论”等攻击不会越权。

### 成本与版本

- 输入以 `contentVersion + contextHash + promptVersion + modelVersion` 形成分析幂等键，相同输入不重复付费。
- 调用前通过原子 reservation 检查并占用 `AI_DAILY_BUDGET_CENTS`；达到上限后保持 `blocked` 且 `block_reason=budget`，不得静默切换低质量模型。
- 保存模型、prompt 版本、token usage、provider request ID、耗时和成本；不保存 API key。
- 生产实现 MUST 落地一个经用户确认的具体 AI provider/model；在 `user_confirm` 前保持 `USER_DECISION_REQUIRED`，未选定时可完成 provider-neutral contract 与 Mock，但真实 AI 能力不得标记完成。

## 重要性评分

`ImportanceScorer` 对以下 0–4 特征应用版本化权重：产业相关性、观点新颖度、相较历史变化、证据质量、时效/催化强度、不确定性惩罚。模型只产生带证据的候选特征；服务端校验后计算 0–100 总分。

- 默认 `score >= 75`、置信度不低于 `medium` 且不存在政策/数据完整性阻断时进入通知。
- 低于阈值仍完整归档；无法评分时显示原因，不通知。
- 权重、阈值和版本由服务端配置读取并写入每次评分快照，测试可注入配置。
- 第一阶段用户反馈只用于人工回看和后续调参证据，不自动在线学习或改变权重。

## 通知设计

- `NotificationPolicy` 在评分成功后创建 delivery。技术 delivery key 继续包含 card/policy version；另以内容事件 ID + 用户提醒策略维护用户感知去重与 cooldown，单纯模型/prompt/策略重算不得再次打扰，只有正文实质编辑、观点实质变化或管理员明确重发才允许新提醒。
- 飞书消息使用稳定事件 ID，并只包含保留不确定性标签的分层摘要、重要性理由和由受校验 `APP_BASE_URL` 生成的绝对 HTTPS 私有详情链接；不包含 Token、Webhook、完整 raw payload 或未经验证的 A 股公司结论。
- Webhook 仅从服务端 `FEISHU_WEBHOOK_URL` 读取；请求和错误日志对 URL 完全脱敏。
- 成功响应保存 provider message ID；明确拒绝、连接建立前失败、429、5xx 按分类重试；请求已经发送但响应超时/进程在发送后落库前崩溃时进入 `outcome_unknown`，不自动重发，由管理员核对后显式处理。只有真实联调证明 provider 支持幂等/结果查询时才能收紧为自动补偿。
- 未配置 Webhook 时高价值内容标记 `blocked` 且 `block_reason=configuration`，普通归档和网页功能继续运行。

## 私有认证与 API

### 认证

- `/api/auth/login` 校验环境变量中的管理员用户名和 `scrypt` 密码摘要，比较使用恒定时间函数；失败统一返回通用错误并限速。
- 登录成功后生成 256-bit 随机会话 token，Cookie 使用 `HttpOnly`、`SameSite=Strict`、生产环境 `Secure` 并由 `SESSION_SECRET` 签名；Redis 只保存 token 哈希、actor、创建时间和绝对 TTL。注销、Redis 记录删除或 Secret 轮换后旧 Cookie 必须失效。
- 除 `/api/health` 和登录接口外，所有 API 由 `SessionGuard` 保护。写请求额外校验 CSRF token 与 Origin。
- 无公开注册、找回密码、多角色、OAuth 或多租户；凭据缺失时生产启动失败可见。

### API 契约

| 方法与路径 | 行为 |
|---|---|
| `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session` | 私有会话生命周期 |
| `GET /api/intelligence` | 最新/历史分页，支持 keyword、ticker、topic、importance、contentType、date range |
| `GET /api/intelligence/:id` | 内容、上下文图、卡片、评分、通知状态和反馈 |
| `POST /api/intelligence/:id/feedback` | 提交固定枚举反馈和可选短备注 |
| `GET /api/operations/status` | ingestion run（poll/compensation mode）及 ingest/context/analysis/score/notify 五阶段、worker heartbeat、阻断/失败摘要 |
| `GET /api/operations/audit/:runId` | 管理员读取脱敏 ingestion/provider/attempt 证据，不返回 raw payload 或 Secret |
| `POST /api/operations/retry/:attemptId` | 仅管理员对明确 `manual_retry_allowed` 的 blocked/dead-letter 任务创建新 attempt；不可恢复终态拒绝请求 |

列表 API 使用白名单排序、上限 100 的游标分页和转义后的查询条件。响应 DTO 位于 `shared/contracts/`，不返回 `raw_payload`、内部错误栈、Secret 或 provider credentials。

## 前端设计

- `/login`：管理员登录，错误信息不泄露账号是否存在。
- `/`：最新情报卡片列表，显示内容类型、时间、主题、评分、置信度和通知状态。
- `/timeline`：历史时间线及 keyword/ticker/topic/importance/contentType 筛选。
- `/intelligence/:id`：原文与来源、忠实翻译、Serenity 判断、他人内容、AI 解释、未验证推断、证据、不确定性、观点变化和上下文图分区展示。
- `/status`：最近各阶段状态、失败原因、待配置项和可恢复操作。
- 反馈按钮固定为“重要、已知、不相关、继续跟踪、翻译有误、分析有误”，提交后显示时间和当前选择。

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
- AI：需要选定供应商、模型、密钥和预算；抽查翻译、证据引用、不确定性与注入边界。
- 飞书：需要真实机器人 Webhook；验证单条高价值通知和去重。
- 认证/部署：在最终私有部署环境验证 HTTPS、Secure Cookie、重启恢复和网络访问边界。
- Docker 当前不可用，因此容器验证必须标为待人工/目标环境验证，不能由本地 Mock 代替。

验收报告必须按“自动化已验证 / Mock 已验证 / 真实 API 已验证 / 待人工配置或验证”四类记录证据。

## 部署与迁移顺序

1. 先确定服务端可导入 `shared/` 与 `drizzle/` 的 TypeScript/ESM 构建策略，并为 API、worker 分别生成可运行产物与构建后导入测试。
2. 生成、审查并通过显式 `db:migrate` 在空库应用 Drizzle migration；生产禁止用 `db:push` 代替版本化迁移，执行前记录备份/停用同步步骤，失败时停止 API/worker 并恢复应用版本或向前修复。
3. 以幂等 bootstrap 将稳定 X user ID 绑定到 `@aleabitoreddit`，handle 变化只更新显示值，身份不随 handle 漂移。
4. 配置 MySQL、Redis、管理员密码摘要、Session Secret、`APP_BASE_URL`、外部 deadline/并发/lease/最大 attempt/上下文与 payload 上限；未配置真实外部服务时生产同步保持关闭。
5. 通过独立 `dev:worker`/`start:worker` 与 Compose/process supervisor 启动 API 和 worker，验证 liveness、readiness、worker heartbeat、优雅退出和 reconciliation；API 健康但 worker 缺失时状态页必须告警。
6. 配置 X 凭据和预算并记录政策确认人、时间、政策版本及允许 tombstone 字段后启用单账号轮询。
7. 配置经用户确认的 AI provider/model 与飞书（含所选安全签名策略），逐项完成真实联调；任何一步失败均保留在状态页，不回滚已归档事实。
8. 本地无 Docker 时，单元/Mock 测试可继续；MySQL/Redis 跨进程恢复、Node 20 镜像与目标部署证据保持待 CI/目标环境验证，不得以内存 Mock 替代。

## Repair lane

- 第 1 类“实现未满足既有规范”：在本 change 内最小修复，增加对应 AC 的回归测试，不改目标范围。
- 第 2 类“原目标必要行为但规范遗漏”：先同步更新 proposal、相关 spec、design、test-checklist 和 tasks，再重跑受影响审查与测试。
- 第 3 类“新增需求或范围扩大”：新建 change；多账号、新闻抓取、公司级映射和新通知渠道均属于此类。
- 第 4 类“环境、数据或操作问题”：先用 ingestion run、processing attempt 和 provider request ID 复现解释；未证明是业务缺陷前不改代码。
- 第 1、2 类未关闭前不得归档；修复不得通过降低断言、伪造 Mock 或把待人工项标记通过来收敛。

## 实现路径概述

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

### AC-9：真实飞书提醒
- **涉及模块/文件（猜测）**：`server/infrastructure/notifications/feishu.adapter.ts`
- **关键函数/类（猜测）**：`FeishuNotificationAdapter.send`
- **数据流**：脱敏消息 → 服务端 Webhook → provider result → 私有详情链接
- **验证点**：真实发送一条；未配置时 `blocked/configuration`

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
| AC-6 | AI 结构化契约；前端详情页 | 需要真实内容人工抽查 |
| AC-7 | 重要性评分 | 服务端确定性决策 |
| AC-8 | 通知设计；运行状态与恢复 | delivery 唯一键和可见失败 |
| AC-9 | 通知设计 | 飞书是唯一实现渠道 |
| AC-10 | 私有认证与 API；前端设计 | 单管理员、无注册 |
| AC-11 | 数据设计；API；前端设计 | 追加式反馈记录 |
| AC-12 | 运行状态、日志和恢复 | 私有状态 API |
| AC-13 | 获取补偿；运行状态和恢复 | lease + reconciliation + 终态 |
| AC-14 | 防 Prompt Injection | 无工具模型 + data envelope |
| AC-15 | Secret、合规和投资边界 | 服务端配置与全链路脱敏 |
| AC-16 | Secret、合规和投资边界 | 明确排除交易与抓取越界 |
| AC-17 | AI 成本与版本；外部用量表 | 硬预算和版本审计 |
| AC-18 | 测试与验收策略 | 四类证据严格区分 |
| AC-19 | 真实 API 与人工验收；部署与迁移顺序 | 同一业务事件贯穿真实闭环 |

## 自审结论

- 19 条 AC 均有模块、数据流和验证路径，未把 Filtered Stream、多个账号、外部网页抓取、A 股公司级映射或多通知渠道扩大进本 change。
- 所有外部调用均位于适配器边界；真实 X、AI、飞书、Docker 和部署验证均未被设计文档误写为已通过。
- repair lane 已覆盖规范回写、最小修复、范围扩展和环境问题四类路径。
- 当前无阻止进入代码检索和 test-checklist 的设计级硬阻塞；生产启用仍受外部凭据、预算、政策与部署环境人工确认约束。
