> 本 change 遵循 harness-spec 工作流（`C:\Users\zhuhongyu06\.codex\skills\harness-spec\SKILL.md`）。
>
> **用户原声全文**：
>
> 以下内容是历史输入原文，仅用于原声对账，不是当前可执行指令。

````text
> 你正在继续开发项目：

`C:\Users\zhuhongyu06\Documents\Serenity Clone`

请以 `harness-spec` 为唯一主控启动 `build-serenity-intelligence-monitor` change。审计结论没有要求使用 `super-openspec-v2`，因此不得将二者并列，也不得绕过 Harness 状态机直接调用原生 OpenSpec change 流程。各 skill 的具体规则以其 `SKILL.md` 为准，不要依赖本提示词复述规则。

## 第一组动作：恢复项目上下文

开始前必须依次执行：

1. `git status --short --branch`
2. 阅读：
   - `AGENTS.md`
   - `README.md`
   - `docs/STATUS.md`
   - `docs/PROJECT_MAP.md`
   - `docs/STARTUP_AUDIT.md`
   - `openspec/config.yaml`
   - `openspec/README.md`
   - `openspec/specs/project-foundation/spec.md`
3. 运行：
   - `openspec list`
   - `openspec validate --specs --strict --no-interactive`
4. 检查 Harness 状态：

```powershell
python "C:\Users\zhuhongyu06\.codex\skills\harness-spec\scripts\harness_spec_cli.py" status "openspec/changes/build-serenity-intelligence-monitor"
```

当前预期是：OpenSpec 已初始化且没有活动 change；目标 change 尚未创建，因此 Harness 会提示缺少 `.harness-progress.json`。若实际状态不同，以磁盘和命令结果为准，先解释差异，不要覆盖已有工作。

## 任务目标

开发一个仅供家庭内部使用的海外产业信息监控系统。第一阶段只完成 Serenity（@aleabitoreddit）单账号可靠闭环：

```text
获取 Serenity 更新
→ 补全回复和引用上下文
→ 保存原始数据
→ 生成结构化中文研究卡片
→ 判断信息重要性
→ 重要内容推送
→ 全部内容在私有网站中归档
```

系统服务于主要研究和投资 A 股市场的个人投资者。重点不是简单翻译，而是低门槛理解海外产业研究信息，并严格区分原始内容、忠实翻译、作者判断、AI 解释、未验证推测和历史观点变化。

change-id：

`build-serenity-intelligence-monitor`

场景：

`A — 新需求`

推荐 Harness 驾驶模式：

`L2`

## 用户原话

以下需求必须完整保留到 proposal 的用户原声区域，不得改写、省略或扩大范围：

> 我准备启动一次任务：
>
> ## 任务描述
>
> 开发一个仅供家庭内部使用的海外产业信息监控系统。
>
> 系统第一阶段聚焦X平台账号 **Serenity（@aleabitoreddit）**，持续获取该账号发布的帖子、回复和引用内容，结合必要上下文，通过AI生成中文研究摘要，并将重要更新推送给用户，同时在私有网页中完成归档、检索和回看。
>
> 目标用户是一位主要研究和投资A股市场的个人投资者。系统的核心价值不是简单翻译推文，而是帮助用户及时、低门槛地理解海外产业研究信息，并明确区分：
>
> * 原始内容；
> * 中文忠实翻译；
> * Serenity本人的判断；
> * AI生成的解释；
> * 尚未验证的推测；
> * 相较历史观点出现的变化。
>
> 本次任务属于该系统的第一阶段，重点是完成一个可靠的单信息源闭环：
>
> ```text
> 获取Serenity更新
> → 补全回复和引用上下文
> → 保存原始数据
> → 生成结构化中文研究卡片
> → 判断信息重要性
> → 重要内容推送
> → 全部内容在私有网站中归档
> ```
>
> 后续可能扩展到更多海外研究者、公司公告、财报、产业数据和A股产业链映射，但不属于本次任务的必要范围。
>
> ## 参考资料
>
> ### 目标信息源
>
> * Serenity的X账号：
>   https://x.com/aleabitoreddit
>
> ### X官方开发资料
>
> * X API文档：
>   https://docs.x.com/x-api
>
> * Filtered Stream：
>   https://docs.x.com/x-api/posts/filtered-stream/introduction
>
> * 获取用户帖子：
>   https://docs.x.com/x-api/users/get-posts
>
> * X API计费说明：
>   https://docs.x.com/x-api/getting-started/pricing
>
> * X内容展示和开发者政策：
>   https://docs.x.com/developer-terms
>
> ### 可供研究的数据项目
>
> * Serenity历史帖子档案：
>   https://github.com/yan-labs/serenity-aleabitoreddit
>
> 该项目只作为以下方面的参考：
>
> * Serenity内容特征；
> * 历史数据结构；
> * 帖子分类方法；
> * Ticker及主题提取思路；
> * 观点演化分析方法。
>
> 在使用其中的代码或数据前，必须检查其License和允许的使用范围。不得默认将其作为生产环境实时数据源。
>
> ### 消息推送参考
>
> 首选评估飞书自定义机器人：
>
> * 飞书开放平台文档：
>   https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
>
> 系统设计应保留以后增加QQ或邮件推送适配器的可能性，但本次不要求同时实现多个推送平台。
>
> ## 要求
>
> ### 一、核心功能要求
>
> 1. 使用合规且相对稳定的方式获取Serenity的新内容。
>
> 2. 不能只获取独立主帖，还必须考虑：
>
>    * 回复；
>    * 引用帖子；
>    * 回复对象；
>    * 被引用内容；
>    * 必要的历史相关观点。
>
> 3. 所有获取到的内容都应进入系统归档，但不能把每一条内容都立即推送。
>
> 4. 系统应生成结构化中文研究卡片，至少能够表达：
>
>    * 原始内容；
>    * 忠实中文翻译；
>    * 内容类型；
>    * Serenity的核心判断；
>    * 相较历史观点发生了什么变化；
>    * 涉及的公司、Ticker和产业主题；
>    * 有哪些明确证据；
>    * 有哪些不确定性；
>    * AI分析置信度；
>    * 是否值得即时提醒。
>
> 5. 必须明确区分以下信息层次：
>
>    * Serenity明确说出的内容；
>    * 被回复者或被引用者的内容；
>    * AI根据上下文形成的解释；
>    * 尚未验证的推断。
>
> 6. 重要性判断应尽量结构化、可解释、可调整，不能完全依赖模型随意决定。
>
> 7. 高价值更新应能够通过消息平台推送。
>
> 8. 所有内容及研究卡片应能够通过私有网页查看。
>
> 9. 网页至少应支持：
>
>    * 查看最新情报；
>    * 查看历史时间线；
>    * 查看单条内容及其上下文；
>    * 按关键词、Ticker、主题、重要性或内容类型筛选；
>    * 查看系统运行状态；
>    * 记录用户反馈。
>
> 10. 系统应支持后续扩展新的信息源和通知渠道，但不要为尚未确定的后续需求过度设计。
>
> ### 二、信息质量要求
>
> 1. 翻译必须忠于原文，不得把猜测翻译成事实。
>
> 2. AI不得声称自己读取了没有实际获取的网页、财报或外部链接。
>
> 3. AI不得擅自生成未经证据验证的A股受益公司名单。
>
> 4. 本阶段可以判断某条内容与A股某个行业或产业方向可能相关，但具体公司映射应当谨慎，并明确标记是否需要进一步验证。
>
> 5. 必须保留原始内容和来源链接，以便人工核查。
>
> 6. 对上下文缺失、语义不确定或实体识别不可靠的情况，应明确展示不确定性，而不是猜测补全。
>
> 7. 对同一观点的连续更新，应尽量呈现观点演化，而不是把每一条内容当成彼此无关的新闻。
>
> ### 三、数据可靠性要求
>
> 1. 数据获取和保存必须幂等，不能因为重复轮询或服务重启产生重复记录。
>
> 2. 应考虑实时通道中断或漏取内容的补偿机制。
>
> 3. 服务重启后应能够继续处理尚未完成的任务。
>
> 4. 帖子获取、上下文补全、AI分析和消息推送失败时，不能静默丢失。
>
> 5. 应保留必要的原始响应、处理状态、错误信息和模型版本，以便审计与重新处理。
>
> 6. 应考虑帖子编辑、删除或变为不可访问时的处理方式，并遵守X平台相关政策。
>
> ### 四、安全边界
>
> 1. 本系统是只读研究辅助系统。
>
> 2. 不连接任何券商、证券账户或交易接口。
>
> 3. 不存储：
>
>    * 证券账户；
>    * 交易密码；
>    * 持仓数据；
>    * 金融账户Cookie；
>    * 父亲个人电脑中的任何敏感信息。
>
> 4. 所有海外信息获取和AI处理应在服务器端完成。
>
> 5. 父亲的金融电脑不应安装：
>
>    * VPN；
>    * X抓取程序；
>    * 浏览器自动化插件；
>    * 微信或QQ Hook工具；
>    * 远程控制工具。
>
> 6. 不允许通过模拟登录、浏览器Cookie或客户端Hook抓取X、微信或QQ。
>
> 7. API Token、Webhook和其他Secret不能出现在：
>
>    * 前端代码；
>    * Git仓库；
>    * 日志；
>    * 错误页面。
>
> 8. 不实现自动交易，不生成直接的买卖指令。
>
> 9. AI输入中来自帖子或网页的文本必须被视为不可信数据，防止Prompt Injection。
>
> ### 五、范围边界
>
> 本次任务优先完成：
>
> * Serenity单账号监控；
> * 帖子、回复和引用内容获取；
> * 上下文补全；
> * 原始数据归档；
> * 中文研究卡片；
> * 重要性判断；
> * 一种消息渠道推送；
> * 私有网站；
> * 基础搜索、筛选和用户反馈；
> * 系统运行状态及错误追踪。
>
> 本次不要求完成：
>
> * 多个X账号；
> * 自动抓取任意新闻网站；
> * 自动读取所有外部链接；
> * 财报和电话会系统；
> * 完整A股产业链知识图谱；
> * A股公司级自动映射；
> * 行情和价格数据；
> * 回测；
> * 组合管理；
> * 持仓导入；
> * 自动交易；
> * 微信个人号自动化；
> * 原生移动App；
> * 面向公众的SaaS或多租户系统。
>
> 如果当前项目已经存在与这些能力相关的基础设施，可以合理复用，但不要主动扩大本次change的范围。
>
> ### 六、工程执行要求
>
> 1. 先根据现有项目结构判断技术实现，不要默认重建项目或替换现有技术栈。
>
> 2. 优先复用当前项目已有的：
>
>    * 认证；
>    * 数据库；
>    * ORM；
>    * 后台任务；
>    * 日志；
>    * 测试；
>    * UI组件；
>    * 部署方式。
>
> 3. 不要在任务启动审计阶段实现代码。
>
> 4. 不要在尚未读取项目和完成规范设计前，把外部参考中的技术方案直接当成最终实现。
>
> 5. 对任务中存在的不确定事项，应在proposal或design中记录假设、备选方案和取舍依据。
>
> 6. 后续规范应至少覆盖：
>
>    * 数据获取；
>    * 数据去重；
>    * 上下文构造；
>    * AI输出边界；
>    * 重要性判断；
>    * 通知去重；
>    * 私有访问；
>    * 错误恢复；
>    * Secret管理；
>    * 成本控制；
>    * 测试和人工验收。
>
> 7. 对所有外部API使用适配器或清晰边界，方便测试和未来替换。
>
> 8. 不要为了“实时”牺牲稳定性。允许采用实时获取与定期补偿相结合的方案。
>
> 9. 若真实API密钥暂时不可用，可以在规范阶段设计Mock和测试策略，但最终验收必须明确区分：
>
>    * 已通过自动化测试验证的行为；
>    * 已通过真实外部API验证的行为；
>    * 尚需人工配置或验证的外部依赖。
>
> ### 七、验收方向
>
> 最终至少应能够人工验证以下闭环：
>
> 1. 系统成功获取一条Serenity的新内容。
>
> 2. 回复和引用内容能够关联到必要上下文。
>
> 3. 重复获取同一内容不会产生重复记录或重复提醒。
>
> 4. 系统生成的中文研究卡片能够清楚区分原文、翻译、作者判断和AI解释。
>
> 5. 高价值内容可以产生消息提醒。
>
> 6. 普通或低价值内容不会造成高频打扰，但仍能在网页中找到。
>
> 7. 用户可以登录私有网页，搜索、筛选并查看历史内容。
>
> 8. 用户可以对研究卡片提交“重要、已知、不相关、继续跟踪、翻译有误、分析有误”等反馈。
>
> 9. 系统能够展示最近一次数据获取、后台任务、AI分析和通知发送状态。
>
> 10. 模拟数据源中断、模型调用失败或消息发送失败后，任务不会静默丢失。
>
> 11. 前端、日志和代码仓库中不存在API密钥或Webhook泄露。
>
> 12. 系统不接触证券账户和交易功能。
>
> 请先只做任务启动审计，不要实现代码。
>
> 请结合当前项目执行：
>
> 1. 识别任务类型：新需求 / 需求变更 / Bug修复 / 重构 / 文档交付。
> 2. 读取必要项目文档和相关代码，给出当前状态摘要。
> 3. 检查本地环境和关键命令是否可用，包括依赖安装、测试命令、构建命令、OpenSpec CLI、git状态。
> 4. 判断应采用的主控工作流。默认优先`harness-spec`。不允许`harness-spec`和`super-openspec-v2`同时作为主控。只能选择一个主控，另一个最多作为参考思想。如果选择`harness-spec`，不要再绕开harness状态机直接调用原生openspec流程。
> 5. 列出本任务最小必要skill、可选增强skill、缺失skill、降级风险。
> 6. 输出是否可以进入SDD/OpenSpec阶段；如果可以，给出建议change-id和下一步动作。
>
> ## 验收缺陷修复策略预设
>
> 请为本任务预设验收后修复策略。
>
> 人工验收发现bug或目标未达成时，默认不要重新跑完整需求流程，也不要无约束vibe coding。
>
> 应优先走“当前change内的spec-bound repair lane”：
>
> * 先读取当前proposal、design、tasks、test-checklist和相关代码；
> * 将人工反馈分类为：
>
>   1. 实现未满足既有规范；
>   2. 规范遗漏但属于原目标必要行为；
>   3. 新增需求或范围扩大；
>   4. 环境、数据或操作问题；
> * 第1类可进入最小修复；
> * 第2类必须先补规范或验收清单；
> * 第3类必须新开change或回到完整SDD流程；
> * 第4类先复现和解释，不直接改业务代码。
>
> 请在任务启动审计中说明，本任务后续适合如何使用repair lane。
>
> 输出必须包含：
>
> * 已读取文件；
> * 已执行命令；
> * 当前项目状态摘要；
> * 发现的阻塞；
> * 推荐工作流；
> * skill使用计划；
> * 是否可以进入SDD/OpenSpec；
> * 建议change-id；
> * 下一步动作；
> * 本任务repair lane使用建议。

## 已完成审计结论

启动审计已经通过，不要重新做一轮泛化审计，也不要重建项目。

当前事实：

- 当前分支：`main`
- 当前 HEAD：`753eeb4`
- Git 工作树：干净
- 临时初始化 worktree 已清理
- 技术基线：
  - React 19 + Vite 7
  - NestJS 11
  - TypeScript 5.9
  - Drizzle ORM + MySQL 8
  - BullMQ + Redis 7
  - Vitest + ESLint
- `pnpm install --frozen-lockfile` 已通过
- `pnpm check` 已通过
- `pnpm test` 已通过：3 个测试文件、6 个测试
- `pnpm lint` 已通过
- `pnpm build` 已通过
- 运行时冒烟已通过：
  - `GET /api/health` 返回 `status=ok`
  - 根页面返回 HTTP 200
- `pnpm audit:secrets` 已通过
- OpenSpec 已初始化
- `project-foundation` 严格校验通过
- 当前没有活动 OpenSpec change
- 全局 `spec-review-debate` 已安装到：
  `C:\Users\zhuhongyu06\.codex\skills\spec-review-debate`
- 该 skill 已通过结构校验、正向自测、缺失工件拒绝测试和安装哈希校验
- 没有阻止进入 proposal/design 的硬阻塞

仍未验证但不阻塞 SDD：

- 当前机器没有 Docker/docker-compose
- X Developer 账号、credits 和 Bearer Token 未配置
- AI 模型供应商、预算和密钥未确定
- 飞书 Webhook 未配置
- 私有部署和认证方案未确定
- 未完成任何真实外部 API 联调

以上项目必须在设计和验收中明确区分：

- 自动化测试已验证；
- Mock 已验证；
- 真实外部 API 已验证；
- 尚需人工配置或验证。

## 参考资料

本地工程参考：

- `C:\Users\zhuhongyu06\Desktop\U声开发\uvoice`
- `C:\Users\zhuhongyu06\Desktop\开物\uxAiLobster`

外部资料：

- https://x.com/aleabitoreddit
- https://docs.x.com/x-api
- https://docs.x.com/x-api/posts/filtered-stream/introduction
- https://docs.x.com/x-api/users/get-posts
- https://docs.x.com/x-api/getting-started/pricing
- https://docs.x.com/developer-terms
- https://github.com/yan-labs/serenity-aleabitoreddit
- https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot

参考仓库未发现明确 License，因此不得复制其代码或数据；只允许高层方法参考，除非后续取得明确授权。

## Skill 优先级

主控：

1. `harness-spec`

Harness 对应步骤按其 `SKILL.md` 调用：

- `openspec-new-change`
- `openspec-apply-change`
- `openspec-sync-specs`
- `openspec-archive-change`
- `spec-review-debate`

按需增强：

- `systematic-debugging`
- `test-driven-development`
- `verification-before-completion`
- `requesting-code-review`
- `openai-docs`：仅在设计最终选择 OpenAI API 时使用

不得将 `super-openspec-v2` 设为并列主控。不得因为项目内存在 `openspec-propose` 等 skill 而绕过 Harness routing。

## 下一步动作

完成上下文和状态检查后：

1. 如果没有进行中的 Harness change，使用 `harness-spec` 初始化：

```powershell
python "C:\Users\zhuhongyu06\.codex\skills\harness-spec\scripts\harness_spec_cli.py" init "openspec/changes/build-serenity-intelligence-monitor" --scenario A --name "build-serenity-intelligence-monitor" --driving-mode l2
```

2. 立即调用 Harness `next` 获取当前步骤指令。
3. 按状态机生成 proposal，并将本提示词中的“用户原话”完整写入用户原声区域。
4. proposal 必须集中记录尚未决定的事项、备选方案和取舍依据，尤其包括：
   - X 获取方式及实时/补偿组合；
   - X 内容编辑、删除和不可访问处理；
   - 私有认证；
   - AI 供应商和成本；
   - 飞书机器人；
   - 部署环境；
   - Mock、真实 API 和人工验收边界。
5. proposal 确认前不实现 Serenity 业务代码。
6. 后续严格经过 design、test-checklist、tasks、顾问审查和 `spec-review-debate` 门禁。
7. 将 repair lane 写入 proposal、design 和 test-checklist；当前 change 的第 1、2 类验收问题未解决前不得归档。
8. 每完成 Harness 步骤，按 `harness-spec/SKILL.md` 执行状态推进和 Git checkpoint，不要在产物写完后断流。
>
> 后续确认与修订原话：
>
> 确认
>
> 卡住了？
>
> 按审查建议修订后继续评审。私有网页作为主要使用入口，爸爸不需要使用飞书；飞书仅作为可选的重要消息提醒渠道，第一版可以先把提醒发给我。未配置飞书时，网页归档、AI 分析、搜索和查看功能仍应正常运行。若接入飞书，请启用安全签名。AI 第一版使用 OpenAI gpt-5.6-terra，并继续通过适配器和配置隔离，确保以后可以更换模型或供应商。请按此方案推进。
>
````

> **验收清单全文**：

````text
> - [ ] **AC-1** `[用户手动]`：配置真实 X Developer 凭据后，系统能通过合规的官方接口获取至少一条 Serenity 新内容，并保留来源 URL、平台 ID、作者、原文、发布时间、获取时间和原始响应审计信息；若凭据或 credits 未提供，验收报告必须明确标为“尚未真实 API 验证”，不得用 Mock 冒充。
> - [ ] **AC-2** `[AI自测]`：对主帖、回复和引用帖 fixture，系统能关联回复对象、被引用内容和必要历史观点；上下文缺失、不可访问或语义不确定时显式标记，不猜测补全。
> - [ ] **AC-3** `[AI自测]`：重复轮询、补偿拉取、任务重试或服务重启不会产生重复内容、重复研究卡片或重复通知；幂等键、游标和通知去重均有可重复测试。
> - [ ] **AC-4** `[AI自测]`：内容编辑、删除或变为不可访问时，系统按明确状态机更新记录，保留政策允许的审计元数据与处理历史，并能安全重处理；策略不得违反 X 内容展示和开发者政策。
> - [ ] **AC-5** `[AI自测]`：中文研究卡片至少包含原文、忠实翻译、内容类型、Serenity 核心判断、历史观点变化、公司/Ticker/主题、明确证据、不确定性、AI 置信度和即时提醒结论，并以结构化字段区分 Serenity 原话、他人内容、AI 解释和未验证推断。
> - [ ] **AC-6** `[用户手动]`：使用 OpenAI `gpt-5.6-terra` 的真实 Responses API 调用抽查研究卡片时，输出通过严格结构化契约；翻译未把猜测写成事实，AI 未声称读取未实际获取的外链，未擅自生成未经证据验证的 A 股受益公司名单，观点变化证据不足时明确说明无法判断。
> - [ ] **AC-7** `[AI自测]`：重要性由可配置的结构化规则和可解释分项共同决定；高价值 fixture 进入通知队列，普通/低价值 fixture 仅归档，阈值变化可测试且不由模型任意覆盖。
> - [ ] **AC-8** `[AI自测]`：通知具有稳定去重键、发送状态、失败原因和可重试机制；明确区分确认失败与发送结果未知，模拟发送失败、超时与重试后不静默丢失，也不会对结果未知的发送进行盲目自动重发。
> - [ ] **AC-9** `[用户手动]`：飞书是可选的重要消息提醒渠道。显式启用并配置真实飞书机器人时必须使用安全签名，高价值内容能向提出需求的用户控制的私有飞书群发送一条不泄露 Secret、可追溯到私有详情页的提醒；默认禁用时不创建发送任务或失败积压，网页归档、OpenAI 分析、搜索和查看仍正常运行；显式启用但缺少 Webhook 或签名密钥时才显示通知待配置。
> - [ ] **AC-10** `[回写后测]`：私有网页是主要使用入口；未认证访问被拒绝，父亲与提出需求的用户可分别使用预配置、同权限的家庭账号，无需使用飞书即可查看最新情报、历史时间线和单条详情及上下文，并按关键词、Ticker、主题、重要性和内容类型搜索或筛选；反馈能追溯到实际登录账号。
> - [ ] **AC-11** `[回写后测]`：用户可对研究卡片提交“重要、已知、不相关、继续跟踪、翻译有误、分析有误”等反馈，反馈可追溯到用户、卡片和时间且不会篡改原始内容。
> - [ ] **AC-12** `[回写后测]`：运行状态页区分 ingestion run 的轮询/补偿模式，并展示 ingest、上下文补全、AI 分析、重要性评分、可选通知和 worker heartbeat；失败/阻断/结果未知任务包含可理解原因与符合资格的恢复入口。健康环境下，从首次成功观察到一条 X 内容到其研究卡片可在网页查看的默认目标为 30 分钟，实际耗时和超目标原因必须可见。
> - [ ] **AC-13** `[AI自测]`：模拟数据源中断、限流、上下文补全失败、模型失败、通知失败和进程重启后，任务状态可恢复或进入明确的终态/死信处理，不存在静默成功或静默丢失。
> - [ ] **AC-14** `[用户手动]`：来自帖子、引用、网页和历史档案的文本被作为不可信数据封装；自动化测试证明模型无工具/Secret 通道和输出校验边界，真实 OpenAI `gpt-5.6-terra` 固定对抗样本的人工抽查证明恶意文本未成为事实结论；Mock 不得冒充真实模型语义验证。
> - [ ] **AC-15** `[AI自测]`：前端产物、普通 API 正文、日志、错误页、测试快照和 Git 扫描均不泄露 Token、Webhook、第三方/金融 Cookie、管理员凭据、可复用会话 Token 或证券账户信息；允许认证接口设置符合 HttpOnly、SameSite 与 Secure 策略的本站会话 Cookie，允许保存公开 X 来源标识和内部 actor ID；Secret 只从服务端配置读取，缺失时失败可见。
> - [ ] **AC-16** `[AI自测]`：系统不存在券商、证券账户、持仓导入、行情交易、自动买卖指令、浏览器 Cookie/模拟登录抓取或微信/QQ Hook 接口；相关越界输入被拒绝或仅作为不可信研究文本处理。
> - [ ] **AC-17** `[AI自测]`：AI 与 X 调用记录供应商/模型或 API 版本、调用状态和可审计的成本计量；预算或速率上限触发时停止新增外部调用并显示原因，不以静默降质兜底。
> - [ ] **AC-18** `[用户手动]`：最终验收报告逐项区分自动化测试、Mock、真实 X/OpenAI API、可选的真实飞书 API 和待人工配置/验证；Docker、部署、认证或所需外部凭据未实际验证的部分不得标记为通过，未启用飞书不得导致核心网页闭环判定失败。
> - [ ] **AC-19** `[用户手动]`：使用同一条真实 Serenity 内容贯穿 X 获取、回复/引用上下文、OpenAI `gpt-5.6-terra`、研究卡片、重要性评分和同一私有详情页，所有阶段 ID 可追溯；若已配置带安全签名的飞书，再验证其提醒指向同一详情页。父亲不打开 X、不阅读英文原文，仅凭中文卡片即可准确回答“发生了什么、谁说的、证据是什么、哪里不确定”。另用一条真实普通/低价值内容验证其可检索但不发送提醒，并人工走通登录、筛选、反馈与状态查看。缺少核心真实外部凭据或目标环境时本项保持未验收，但飞书未配置不阻塞核心闭环。

````
>
> ⚠️ tasks 完成后审查链路（强制顺序，场景 A 的首个正式顾问团审查点）：
> 1. 顾问团审查（所有场景）→ 暴露盲区 → 落盘 `.council-review.log`
> 2. spec-review-debate（所有场景）→ 多轮辩论收敛
> 3. 用户确认 → 进入实现
> 跳过 spec-review-debate 需用户**明确**授权（"退出 harness" / "跳过 debate 我自负"）。
>
> ⚠️ 实现前置门禁（三步校验）：
> 1. 存在性：read `.council-review.log` + `.review-debate.log`，缺失 = 禁止动工
> 2. 状态：`.review-debate.log` 必须 `CONVERGED` / `USER_OVERRIDE`
> 3. 版本一致性（COORD-6）：比对 log 中 commit 与当前 HEAD
>
> 规则：每完成一项立即把 `[ ]` 改成 `[x]`；禁止积攒到最后统一勾选。
> 如果只完成一部分，保持 `[ ]` 并在汇报中说明原因。
> 每组完成时必须执行 [原声对账]，原声优先级最高。
> 每组完成时必须执行 [Git提交]，提交信息格式为 `harness(build-serenity-intelligence-monitor): implement group N`。

# build-serenity-intelligence-monitor — 任务分解

## Group 1: 数据模型、运行时边界与共享契约

[验收映射] AC-3, AC-4, AC-8, AC-11, AC-13, AC-15, AC-17

### Task 1.1: 建立业务配置、容量和运行时边界契约

- [ ] [完成] Task 1.1
  - 实现细节: 以 Zod 定义数据库、Redis、两个同权限家庭账号（actor/用户名/`scrypt` 摘要）、会话、`APP_BASE_URL`、X、`AI_PROVIDER=openai`、`OPENAI_MODEL=gpt-5.6-terra`、`OPENAI_API_KEY`、OpenAI 预算、`CORE_VISIBILITY_SLO_MINUTES=30`、`FEISHU_ENABLED=false`、可选 `FEISHU_WEBHOOK_URL` 与必配配对的 `FEISHU_SIGNING_SECRET`、生产同步/政策确认、阈值、轮询/补偿/lease/最大 attempt、外部 deadline、worker 并发和上下文/输入输出/raw payload 上限；第一版生产配置只接受 `openai/gpt-5.6-terra`，错误 provider/model 直接阻断启动/分析，不静默替换；区分核心生产必填、可选通知配置与测试注入，不回显实际值，不保留旧 `AI_API_KEY` 同义入口。
  - **覆盖测试用例**: TC-15.1, TC-15.2, TC-17.2
### Task 1.2: 定义 Drizzle 业务 schema、版本历史、状态机和迁移

- [ ] [完成] Task 1.2
  - 实现细节: 按 design 创建 source/sync、run、content identity、不可变 content version、lifecycle event、relation、processing intent/attempt、card/entity、score、notification、feedback、usage 与 budget reservation；定义完整状态/阻断原因/人工重试资格、fencing、UTC、字符串 ID 与 BigInt 比较、字段类型/size ceiling 和唯一键，生成可审查 additive migration。
  - **覆盖测试用例**: TC-3.1, TC-3.2, TC-4.1, TC-4.2, TC-8.1, TC-11.1, TC-13.1, TC-17.1
### Task 1.3: 建立共享构建、迁移、数据库/队列和 worker 运行闭环

- [ ] [完成] Task 1.3
  - 实现细节: 将服务端构建明确为 `rootDir: "."`、`outDir: "dist"`，include `server/shared/drizzle`，保持 `dist/server/main.js` 并生成 `dist/server/worker.js`，依靠现有 `deleteOutDir=false` 保留 Vite 产物；实现显式 `db:migrate`、Drizzle/Redis/BullMQ、durable pending intent、dispatcher、lease/fencing、reconciliation、worker heartbeat/优雅退出以及 `dev:worker`/`start:worker`/Compose 入口。生产不得用 `db:push` 代替 migration。
  - **覆盖测试用例**: TC-3.1, TC-3.2, TC-8.2, TC-13.1, TC-13.2
### Task 1.4: 建立基础共享 DTO、错误分类、状态契约和集中日志脱敏

- [ ] [完成] Task 1.4
  - 实现细节: Group 1 只在 `shared/contracts/` 定义 ID、分页、错误、pipeline/delivery 状态和 envelope；研究卡片契约由 Group 3 单点拥有。实现稳定错误码与 retryability、敏感字段过滤和 correlation ID，确保业务 DTO 不返回 raw payload、内部栈或凭据。
  - **覆盖测试用例**: TC-11.2, TC-15.1, TC-15.2, TC-17.1

### Task 1.5: 建立分层测试环境与可重复清理

- [ ] [完成] Task 1.5
  - 实现细节: 明确 Node 单元/Mock、Vitest jsdom + Testing Library、Nest testing + Supertest、真实 MySQL/Redis 跨进程测试四层；增加测试专用 URL、migration/seed/队列清理命令。当前无 Docker 时真实存储层保持待 CI/Compose/目标环境验证，不以 repository Mock 冒充。
  - **覆盖测试用例**: TC-3.1, TC-3.2, TC-10.1, TC-10.2, TC-13.1, TC-13.2, TC-18.1

- [ ] [自测] 按顺序运行 `pnpm db:generate`、`pnpm check`、`pnpm test`、`pnpm lint`、`pnpm audit:secrets`；每条命令退出码均为 0，migration 存在且不含默认 Secret，构建后 API/worker 入口可解析
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认本组只建立当前单源闭环所需数据与基础设施，无业务范围扩张
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 1`

## Group 2: Serenity 官方获取、归档与内容生命周期

[验收映射] AC-1, AC-3, AC-4, AC-13, AC-15, AC-17

### Task 2.1: 实现 X 官方 API 适配器与脱敏契约测试

- [ ] [完成] Task 2.1
  - 实现细节: 实现账号解析、用户内容分页和批量 lookup，读取 `since_id`、pagination token、replies、referenced tweets、conversation 与 edit history 字段；对 429、5xx、认证、权限和预算错误分类，禁止模拟登录或 Cookie 抓取。
  - **覆盖测试用例**: TC-1.1, TC-1.2, TC-13.1, TC-13.2, TC-15.1, TC-17.1, TC-17.2
### Task 2.2: 实现 Serenity 身份 bootstrap、轮询、游标和补偿

- [ ] [完成] Task 2.2
  - 实现细节: 幂等解析并绑定稳定 X user ID 与当前 handle；固定单账号 scheduler/job ID；逐页 upsert 内容和关系，按 source 单写 lease/CAS 和 BigInt 水位比较只在全页成功后单调推进游标；实现重叠补偿、持久工作意图投递与用量记录。
  - **覆盖测试用例**: TC-3.1, TC-3.2, TC-13.1, TC-17.1
### Task 2.3: 实现内容版本、删除确认和政策门禁

- [ ] [完成] Task 2.3
  - 实现细节: 以 payload hash/edit ID 幂等追加不可变版本并只重处理新版本；暂态缺项进入 verification pending，只有明确/连续确认才按字段级删除矩阵清理内容版本、派生卡片/索引/通知证据中的受限正文；保留最小 tombstone。生产同步要求记录确认人、时间、政策版本与允许字段。
  - **覆盖测试用例**: TC-4.1, TC-4.2, TC-15.1
### Task 2.4: 增加 X 获取、幂等和生命周期 fixture 测试

- [ ] [完成] Task 2.4
  - 实现细节: 覆盖两页中断、重复轮询、补偿、重启、429、认证阻断、编辑重复、删除/不可访问清理和原始响应脱敏；Mock 证据不得标成真实 API。
  - **覆盖测试用例**: TC-1.2, TC-3.1, TC-3.2, TC-4.1, TC-4.2, TC-13.1, TC-13.2

- [ ] [自测] 按顺序运行 `pnpm test -- server/ingestion server/infrastructure/x`、`pnpm check`、`pnpm lint`、`pnpm audit:secrets`；退出码均为 0，重复/并发游标不回退，暂态 lookup 不清理正文，Mock 不被标为真实 API
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认只使用官方服务端接口并覆盖帖子、回复、引用、补偿和生命周期
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 2`

## Group 3: 上下文图、结构化 AI 研究卡片与证据边界

[验收映射] AC-2, AC-5, AC-6, AC-14, AC-15, AC-17

### Task 3.1: 实现回复、引用和冷启动历史观点上下文

- [ ] [完成] Task 3.1
  - 实现细节: 优先使用 expansions，再 lookup 缺失引用；以有界图防循环/成本失控；只从已归档 Serenity 卡片中按 ticker/topic 找历史候选。冷启动默认从上线日起积累，未获授权不导入参考仓库；历史不足、缺失或不可访问时保留原因和完整性信号。
  - **覆盖测试用例**: TC-2.1, TC-2.2, TC-6.2
### Task 3.2: 定义研究输入与卡片结构化契约

- [ ] [完成] Task 3.2
  - 实现细节: 以 Zod 区分原文、忠实翻译、Serenity statements、other-party statements、AI interpretations、unverified inferences、观点变化、entities、evidence、uncertainties、confidence 和 importance features；校验 source ID 与置信度。研究输入使用字段白名单，只含必要正文/来源/关系/时间/历史候选，明确排除家庭账号/会话/反馈/访问日志/通知配置/X raw payload/Secret。
  - **覆盖测试用例**: TC-5.1, TC-5.2, TC-6.1, TC-6.2
### Task 3.3: 实现无工具 OpenAI `gpt-5.6-terra` 生产适配器

- [ ] [完成] Task 3.3
  - 实现细节: 业务层定义 provider-neutral `ResearchModelAdapter`，基础设施层以 OpenAI Responses API 调用 `gpt-5.6-terra` 严格结构化输出；外部文字进入带来源的 untrusted data envelope，请求不提供任何 tools，OpenAI SDK 类型不穿透适配器。实现启动能力检查、schema/来源/越权校验、分析幂等键、prompt/请求模型/响应实际模型版本、request ID、usage/cost 审计和原子预算 reservation；模型/provider 由配置注入以便以后替换。缺少/不可用 OpenAI 配置时原文归档和网页功能继续，分析显式阻断且不伪造或静默换模。
  - **覆盖测试用例**: TC-14.1, TC-14.2, TC-15.1, TC-15.2, TC-17.1, TC-17.2
### Task 3.4: 增加上下文、信息质量、非法输出和恶意输入测试

- [ ] [完成] Task 3.4
  - 实现细节: 使用完整/缺失上下文、推测措辞、未读外链、无证据 A 股公司、伪造来源、高置信度越界和 Secret canary fixtures；真实质量抽查项保持待人工。
  - **覆盖测试用例**: TC-2.1, TC-2.2, TC-5.1, TC-5.2, TC-6.1, TC-6.2, TC-14.1, TC-14.2

- [ ] [自测] 运行 `pnpm test -- server/context server/research server/infrastructure/ai`，确认模型 Mock 调用次数、输入 envelope 和卡片 schema 快照可判定
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认翻译、作者判断、AI 解释、未验证推断和历史变化严格分层
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 3`

## Group 4: 可解释重要性与提醒候选事实

[验收映射] AC-7, AC-17

### Task 4.1: 实现版本化重要性评分器和提醒候选事实

- [ ] [完成] Task 4.1
  - 实现细节: 对产业相关性、新颖度、观点变化、证据质量、时效/催化和不确定性执行服务端确定性加权；保存权重/阈值快照、总分和解释；默认高分且置信度合格时保存“符合提醒条件”候选事实，低分仅归档，本组不调用通知渠道。
  - **覆盖测试用例**: TC-7.1, TC-7.2
- [ ] [自测] 运行 `pnpm test -- server/importance`，核对高低价值、阈值边界、模型相反建议和提醒候选事实均可判定，且本组尚不调用任何通知渠道
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认评分可解释且网页核心实现不等待可选飞书
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 4`

## Group 5: 家庭账号认证、私有 API、反馈和运行状态

[验收映射] AC-10, AC-11, AC-12, AC-13, AC-15, AC-16

### Task 5.1: 实现两个同权限家庭账号和 Redis 服务端会话

- [ ] [完成] Task 5.1
  - 实现细节: 从服务端配置加载父亲与提出需求用户的 actor/用户名/Node `scrypt` 摘要列表；两个账号权限相同。实现恒定时间比较、按账号/IP 登录限速、随机会话 token、签名 HttpOnly/SameSite Cookie、生产 Secure/HTTPS 门禁、CSRF/Origin 校验；Redis 只存 token 哈希、actor 与绝对 TTL，覆盖注销、过期、记录删除、单账号密码摘要轮换和 Session Secret 轮换失效；无注册、多角色或 OAuth。
  - **覆盖测试用例**: TC-10.1, TC-10.2, TC-15.1, TC-15.2
### Task 5.2: 实现情报列表、时间线、详情和组合筛选 API

- [ ] [完成] Task 5.2
  - 实现细节: 提供受 Guard 保护的列表/详情接口；支持 keyword/ticker/topic/importance/contentType/date range、白名单排序和有界 cursor 分页，使用 `(published_at, internal_id)` 等稳定复合顺序；详情返回上下文完整性、卡片、评分、通知状态但不返回 raw payload。
  - **覆盖测试用例**: TC-10.1, TC-10.2, TC-15.1, TC-16.1, TC-16.2
### Task 5.3: 实现追加式反馈 API

- [ ] [完成] Task 5.3
  - 实现细节: 固定六种反馈枚举，可选短备注；服务端绑定 actor/card/version/time；拒绝未知类型、超长备注、伪造 actor、不存在卡片和无 CSRF 请求。
  - **覆盖测试用例**: TC-11.1, TC-11.2
### Task 5.4: 实现状态、脱敏审计与显式恢复 API

- [ ] [完成] Task 5.4
  - 实现细节: 将 poll/compensation 作为 ingestion mode，分别聚合 ingest/context/analysis/score 核心流水线与可选 notify 分支、队列、worker heartbeat、渠道 disabled/待配置、预算阻断、outcome_unknown 和 dead-letter；记录 X 首次观察到卡片网页可见的分阶段耗时及 30 分钟默认目标，飞书禁用不污染核心成功状态或失败积压。提供脱敏 run/attempt/provider 审计视图。仅对 `manual_retry_allowed` 的 blocked/dead-letter 创建新 attempt，不可恢复状态拒绝，保留旧历史且不回显配置值。
  - **覆盖测试用例**: TC-12.1, TC-12.2, TC-13.2, TC-15.2

- [ ] [自测] 运行 `pnpm test -- server/auth server/content server/feedback server/operations`，并对未认证、非法筛选、CSRF、越界动作和 Secret canary 执行负向 API 测试
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认私有访问、检索、反馈和状态闭环不引入多租户或交易能力
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 5`

## Group 6: 私有研究工作区前端

[验收映射] AC-5, AC-6, AC-10, AC-11, AC-12, AC-15

### Task 6.1: 建立登录、会话恢复和受保护导航

- [ ] [完成] Task 6.1
  - 实现细节: 替换初始化占位页，增加 `/login`、认证状态加载、401 回登录、注销和同源 CSRF 请求封装；Nest 对非 API 路由实现 SPA fallback，直接刷新详情/时间线/状态页仍返回应用，`/api/**` 404 不被吞掉；页面不读取或展示任何外部 Secret。
  - **覆盖测试用例**: TC-10.1, TC-10.2, TC-15.1
### Task 6.2: 实现最新情报、时间线和筛选界面

- [ ] [完成] Task 6.2
  - 实现细节: 展示内容类型、时间、主题、分数、置信度和通知状态；支持 keyword/ticker/topic/importance/contentType/date range 与分页，明确 loading/empty/error 状态。
  - **覆盖测试用例**: TC-10.1, TC-10.2
### Task 6.3: 实现分层详情和上下文展示

- [ ] [完成] Task 6.3
  - 实现细节: 独立展示原文/来源、忠实翻译、Serenity 判断、他人内容、AI 解释、未验证推断、证据、不确定性、观点变化、评分、通知和上下文；tombstone 不展示已清除正文。
  - **覆盖测试用例**: TC-5.1, TC-6.1, TC-6.2, TC-10.1
### Task 6.4: 实现反馈控件和运行状态页

- [ ] [完成] Task 6.4
  - 实现细节: 六种反馈按钮与回显；状态页分开展示四个核心阶段与可选通知分支、最后成功、失败原因、待配置项、队列与可恢复入口，禁止显示配置值或内部栈。
  - **覆盖测试用例**: TC-11.1, TC-11.2, TC-12.1, TC-12.2

- [ ] [自测] 运行 `pnpm test -- client` 与 `pnpm build`；检查静态渲染、交互、未认证导航、组合筛选、分层详情、反馈、状态页和前端 bundle Secret 零命中
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认页面覆盖最新、历史、详情、筛选、状态和反馈且保持家庭内部使用
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 6`

## Group 7: 故障恢复、安全边界与端到端 Mock 闭环

[验收映射] AC-3, AC-8, AC-13, AC-14, AC-15, AC-16, AC-17

### Task 7.1: 强化 reconciliation、fencing、阻断与死信并发测试

- [ ] [完成] Task 7.1
  - 实现细节: 在 Group 1 核心恢复上覆盖 pending、过期 processing、durable intent、retryable/blocked/dead-letter/outcome_unknown；验证旧 worker 迟到提交被拒绝、并发预算 reservation 不越线、人工重试资格一致，显式恢复不覆盖历史。
  - **覆盖测试用例**: TC-3.2, TC-8.2, TC-13.1, TC-13.2
### Task 7.2: 建立从获取到网页归档的核心端到端 fixture 测试

- [ ] [完成] Task 7.2
  - 实现细节: 覆盖主帖/回复/引用、高低价值、重复输入、编辑、缺失上下文、模型失败、渠道 disabled 和进程重启；断言高低价值均可在网页归档/搜索，高价值保存提醒候选但在飞书禁用时零 delivery/零外发，且无静默丢失。
  - **覆盖测试用例**: TC-3.1, TC-7.1, TC-8.1, TC-13.1
### Task 7.3: 建立 Prompt Injection、Secret 和只读研究专项测试

- [ ] [完成] Task 7.3
  - 实现细节: 扩展 `audit:secrets` 覆盖 bundle、API、日志、错误页和快照；参数化恶意指令、Secret canary、下单/持仓/Cookie/Hook 越界输入，检查路由/依赖和零副作用。
  - **覆盖测试用例**: TC-14.1, TC-14.2, TC-15.1, TC-15.2, TC-16.1, TC-16.2
### Task 7.4: 建立用量、原子预算和限流专项测试

- [ ] [完成] Task 7.4
  - 实现细节: 校验 X/AI 版本、request ID、资源/token/cost 汇总、分析幂等；预算/速率耗尽后断言 provider 新调用为 0、状态阻断且不切换低质量模型。
  - **覆盖测试用例**: TC-17.1, TC-17.2

- [ ] [自测] 按顺序运行 `pnpm check`、`pnpm test`、`pnpm lint`、`pnpm build`、`pnpm audit:secrets`；退出码均为 0，故障注入重复执行结果一致，Secret canary 零命中
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，确认所有失败可见可恢复、外部文本不可信、无交易/Hook/客户端抓取边界突破
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 7`

## Group 8: 真实联调边界、人工验收资料与交付收敛

[验收映射] AC-1, AC-6, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-15, AC-17, AC-18, AC-19

### Task 8.1: 编写外部配置、启动、政策复核和真实联调操作说明

- [ ] [完成] Task 8.1
  - 实现细节: 固定说明文件路径；记录 migration、Serenity bootstrap、API/worker、两个家庭账号摘要生成/轮换、`APP_BASE_URL`、X Developer/credits/Token、OpenAI `gpt-5.6-terra`/Responses API/预算、`FEISHU_ENABLED` 与可选 Webhook/安全签名密钥的成对配置、生产同步开关，以及 X 政策确认人/时间/版本/允许字段；明确父亲只需网页、飞书第一版发送到提出需求用户控制的私有群；只写变量名与操作，不写实际 Secret。
  - **覆盖测试用例**: TC-1.1, TC-1.2, TC-6.1, TC-6.2, TC-9.1, TC-9.2
### Task 8.2: 建立四类验收证据和结果记录模板

- [ ] [完成] Task 8.2
  - 实现细节: 固定报告为 `docs/verification/build-serenity-intelligence-monitor.md`，脱敏附件放 `docs/verification/evidence/build-serenity-intelligence-monitor/`；为每条 TC 分开记录执行方式、唯一实际证明力类别、状态、证据位置、执行时间、provider/request ID、成本与环境；缺关键字段时机械禁止标为真实通过，Docker/HTTPS/部署/认证未验证时保持待测。
  - **覆盖测试用例**: TC-18.1, TC-18.2
### Task 8.3: 执行一致性、范围、路由与状态文档审计

- [ ] [完成] Task 8.3
  - 实现细节: 用绝对脚本路径校验 AC↔TC↔Task；用注册路由、模块依赖、数据表和适配器 allowlist 证明无交易/Hook 能力；检查无多 X 信息源/新闻/A 股公司映射/多通知渠道/行情/持仓，并核对 `.env.example` 只保留一套 OpenAI/飞书/家庭账号变量命名；更新 README、STATUS、PROJECT_MAP 和 `.env.example` 为实际状态，不把缺失的 `docs/project-pitfalls.md` 变成产品需求。
  - **覆盖测试用例**: TC-16.1, TC-16.2, TC-18.1, TC-18.2
### Task 8.4: 实现可选通知 reservation、用户感知去重和结果未知处理

- [ ] [完成] Task 8.4
  - 实现细节: 始终保存“符合提醒条件”评分事实；`FEISHU_ENABLED=false` 时不创建 delivery/intent、不入队、不重试、不计失败积压。启用时以内容事件维护用户感知去重/cooldown，以 channel/content/cardVersion/policyVersion 形成技术 delivery key；事务 reservation 后入队；记录 pending/sending/sent/retryable/outcome_unknown/blocked/dead-letter/suppressed 与 attempt，歧义超时不自动重发。
  - **覆盖测试用例**: TC-8.1, TC-8.2, TC-13.1, TC-13.2

### Task 8.5: 实现可选且强制安全签名的飞书适配器

- [ ] [完成] Task 8.5
  - 实现细节: 飞书第一版只向提出需求用户控制的私有飞书群发送重要提醒，不实现个人私聊/任意定向。显式启用时要求 Webhook 与签名密钥成对存在，并按平台协议生成带时间戳安全签名；发送保留来源/不确定性标签的分层摘要、重要性理由和由 `APP_BASE_URL` 生成的绝对 HTTPS 私有详情链接；完全脱敏 Webhook/签名，区分明确失败与结果未知。默认禁用时不创建任务；QQ/邮件不实现。
  - **覆盖测试用例**: TC-9.1, TC-9.2, TC-15.1, TC-17.1

### Task 8.6: 增加禁用、误配置、签名、重复和结果未知测试

- [ ] [完成] Task 8.6
  - 实现细节: 参数化渠道 disabled 零 delivery/零队列/零失败积压、显式启用但缺 Webhook/签名的 blocked/configuration、完整签名固定向量与时间戳窗口、签名拒绝 4xx、并发入队、发送超时和重试成功；断言任何通知状态不阻塞归档、OpenAI 分析、评分、搜索和查看，真实飞书发送保留人工证据位。
  - **覆盖测试用例**: TC-8.1, TC-8.2, TC-9.1, TC-9.2

### Task 8.7: 执行同一真实内容闭环和浏览器人工验收

- [ ] [完成] Task 8.7
  - 实现细节: 若用户提供核心凭据与目标环境，以同一真实内容追踪 X→context→OpenAI `gpt-5.6-terra`→score→绝对 HTTPS 私有详情，另用真实普通内容校准低打扰；技术验收者核对来源、provider 审计和阶段 ID，父亲再用自己的账号且不打开 X/英文，仅凭中文卡片回答发生了什么、谁说的、证据与不确定性；同时验证两个家庭账号、搜索/筛选、actor 可追溯反馈、状态和固定 Prompt Injection 样本。若已配置带安全签名的飞书，再把 delivery 加入同一链路；默认禁用时记录渠道 disabled，不阻塞核心网页闭环。缺少核心依赖时明确保留未验收，不用 Mock/截图样例/本地非容器运行替代。
  - **覆盖测试用例**: TC-1.1, TC-1.2, TC-6.1, TC-6.2, TC-9.1, TC-9.2, TC-10.1, TC-11.1, TC-12.1, TC-14.2, TC-18.1, TC-18.2, TC-19.1, TC-19.2

- [ ] [自测] 先运行 `pnpm test -- server/notifications server/infrastructure/notifications` 验证禁用/误配置/签名/超时，再按顺序运行 `openspec validate build-serenity-intelligence-monitor --strict --no-interactive`、`python "C:\Users\zhuhongyu06\.codex\skills\spec-review-debate\scripts\check_traceability.py" "openspec/changes/build-serenity-intelligence-monitor"`、`pnpm check`、`pnpm test`、`pnpm lint`、`pnpm build`、`pnpm audit:secrets`；全部退出码为 0，追溯报告 `passed=true`，未验证外部证据保持待测
- [ ] [原声对账] 重新读 proposal.md 中的用户原声，逐项确认完成单账号可靠闭环且所有外部未验证项被如实保留
- [ ] [Git提交] 本组完成后提交 `harness(build-serenity-intelligence-monitor): implement group 8`
