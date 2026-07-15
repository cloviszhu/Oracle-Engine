> 本 change 遵循 harness-spec 工作流（`C:\Users\zhuhongyu06\.codex\skills\harness-spec\SKILL.md`）。
> 约束：tasks 后统一顾问团审查；用户原声完整保留；AI 自测；禁止兜底。
>
> ## 验收清单（必须包含）
> 每条 AC 标注类型：`[AI自测]` / `[回写后测]`（UE 场景） / `[用户手动]`
> - `[AI自测]` 的 AC 必须有对应自动化测试用例（在 test-checklist.md 中）
> - 没有测试用例 → 必须创建专项测试
> - AI 草拟后合批确认，不明确且会影响范围、验收或风险的点必须问清楚
> - proposal 阶段类型标注为初判；写 test-checklist 时可建议调整
>
> ⚠️ proposal 确认后直接进入 design/test-checklist/tasks，零暂停；顾问团在 tasks 后统一进行。

# 构建 Serenity 产业情报监控

Change ID：`build-serenity-intelligence-monitor`

## 背景与动机

当前仓库只具备可安装、可测试、可构建的 React/NestJS 工程基础，尚未实现任何 Serenity 监控业务。此 change 要为家庭内部的 A 股产业研究建立第一阶段单信息源闭环：合规获取 Serenity（@aleabitoreddit）的帖子、回复与引用上下文，保留原始证据，通过 OpenAI `gpt-5.6-terra` 生成边界清晰的中文研究卡片，并以私有网页作为主要使用入口。飞书只承担可选的重要消息提醒，未配置时不得影响网页归档、AI 分析、搜索和查看。

本次属于场景 A（新需求），采用 Harness L2 驾驶模式。proposal 确认前不实现业务代码；外部 API、AI 模型、通知、认证、存储与部署必须位于清晰适配器边界后。

## 用户原始需求

<!-- HARNESS:USER_VOICE_START -->
你正在继续开发项目：

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

## 后续确认与修订原话

确认

卡住了？

按审查建议修订后继续评审。私有网页作为主要使用入口，爸爸不需要使用飞书；飞书仅作为可选的重要消息提醒渠道，第一版可以先把提醒发给我。未配置飞书时，网页归档、AI 分析、搜索和查看功能仍应正常运行。若接入飞书，请启用安全签名。AI 第一版使用 OpenAI gpt-5.6-terra，并继续通过适配器和配置隔离，确保以后可以更换模型或供应商。请按此方案推进。
<!-- HARNESS:USER_VOICE_END -->

## 需求分析

### 需求本质

- 建立从“内容获取 → 上下文补全 → 原始归档 → AI 研究卡片 → 结构化重要性判断 → 单渠道提醒 → 私有网页回看”的可靠闭环。
- 研究卡片必须明确区分原文、忠实翻译、Serenity 本人判断、他人内容、AI 解释、未验证推断与历史观点变化。
- 数据处理必须幂等、可审计、可恢复；获取、上下文、分析和通知失败不得静默丢失。
- 系统是只读研究辅助工具，不触碰券商、证券账户、持仓、交易接口或自动买卖指令。
- 来自 X、网页和历史档案的文本全部按不可信输入处理，不能让其指令覆盖系统规则。

### 本 change 范围

- Serenity 单账号的主帖、回复和引用内容获取，以及必要上下文关联。
- 原始响应、来源链接、处理状态、错误、模型版本及重处理所需证据的归档。
- 结构化中文研究卡片、可解释的重要性判断和通知去重。
- 私有网站中的登录、最新情报、历史时间线、详情、搜索、筛选、运行状态和用户反馈；它是第一阶段唯一必需的使用入口，并支持父亲与提出需求的用户各自使用一个预配置家庭账号（同一权限、无公开注册）。
- 可选的飞书自定义机器人高价值提醒，第一版发送给提出需求的用户，父亲无需使用飞书；启用时必须使用安全签名。
- 实时或准实时获取与定期补偿相结合的可靠性设计。
- 外部 API、AI、通知、认证和存储的适配器边界。
- 验收后的 spec-bound repair lane：第 1 类问题做最小修复；第 2 类先补规范与测试清单；第 3 类另开 change；第 4 类先复现和解释。

### 明确不在本 change 范围

- 多个 X 账号、任意新闻网站抓取、自动读取所有外部链接、财报或电话会系统。
- 完整 A 股产业链知识图谱、公司级自动映射、行情、价格、回测、组合、持仓或交易。
- 微信个人号自动化、QQ/微信 Hook、浏览器 Cookie/模拟登录抓取、原生移动 App。
- 面向公众的 SaaS、多租户或超出单信息源闭环的提前抽象。
- 在 License 未明确前复制参考仓库的代码或数据。

### 默认假设与约束

- 优先复用 React 19 + Vite 7、NestJS 11、Drizzle/MySQL、BullMQ/Redis、Vitest 与现有部署骨架，不重建项目或替换技术栈。
- 第一阶段只实现一个可选生产通知渠道；其他渠道只保留明确、最小的适配器扩展点。`FEISHU_ENABLED=false` 为默认值：禁用时不创建 delivery、不入队、不重试、不计入失败积压，只保留“符合提醒条件”的评分事实；只有显式启用后配置不完整才进入待配置状态。网页归档、OpenAI 分析、搜索和查看始终不依赖飞书。
- AI 第一版固定使用 OpenAI `gpt-5.6-terra`，经服务端适配器调用 Responses API 并使用严格结构化输出；provider、model 和凭据均由配置注入，业务层不得依赖 OpenAI SDK 类型。
- X Developer 账号、credits、Bearer Token、OpenAI API Key、飞书 Webhook/签名密钥、私有部署和认证尚未配置，不阻塞 SDD，但会限制相应真实联调和最终验收；飞书缺失不限制核心网页闭环验收。
- Mock、自动化测试、真实外部 API 联调和人工配置/验收必须分别记录，禁止互相冒充。
- 参考仓库当前未发现明确 License，只能参考高层方法，不作为生产实时数据源，也不复制代码或数据。
- Docker 当前不可用，容器构建与 Compose 联调暂不视为已验证。

### 全景扫描结论

- 仓库没有 `plan/`、`Source/` 或 `Plugins/` 目录，也没有未纳入 Harness 的业务草案；实际源码边界是 `client/`、`server/`、`shared/` 与 `drizzle/`。
- `docs/superpowers/` 中只有已完成的项目初始化设计与执行计划，二者明确把 Serenity 业务留给本 change；本 change 基于该工程基线继续，不重建项目。
- `openspec/specs/` 只有 `project-foundation`，覆盖当前初始化页、健康检查、配置失败可见、Secret 扫描、构建交付和空数据模型边界；它不覆盖 X 获取、AI 分析、通知、认证、归档或检索。
- `openspec/COVERAGE.md` 对当前 10 个工程骨架元素报告 100% 覆盖，同时明确业务能力尚无代码；因此不存在可复用的同义业务 capability，也不应把新需求并入 `project-foundation`。
- `openspec/changes/` 除归档目录外只有当前 `build-serenity-intelligence-monitor`，没有冲突、重叠或待续做的旧 change。
- 当前前端只是初始化占位页；后端只有静态资源托管和 `GET /api/health`；Drizzle schema 为空；MySQL/Redis 仅有配置读取和 Compose 基线，尚未建立连接、队列或业务表。
- `.env.example` 与 Compose 仅有初始化占位变量，其中 `AI_API_KEY` 必须在实施时统一迁移为 `OPENAI_API_KEY`，并补齐 `AI_PROVIDER`、`OPENAI_MODEL`、`FEISHU_ENABLED`、`FEISHU_SIGNING_SECRET`、两个家庭账号摘要与 `APP_BASE_URL`；不得长期保留两套同义变量。
- Capability 决策：复用 `project-foundation` 作为不变的工程前提；本 change 新增五个业务 capability，不写 `MODIFIED project-foundation`，避免把业务要求混入基础规格。
- 扫描未发现会阻止 proposal 确认的冲突。

## 验收清单

<!-- HARNESS:AC_LIST_START -->
- [ ] **AC-1** `[用户手动]`：配置真实 X Developer 凭据后，系统能通过合规的官方接口获取至少一条 Serenity 新内容，并保留来源 URL、平台 ID、作者、原文、发布时间、获取时间和原始响应审计信息；若凭据或 credits 未提供，验收报告必须明确标为“尚未真实 API 验证”，不得用 Mock 冒充。
- [ ] **AC-2** `[AI自测]`：对主帖、回复和引用帖 fixture，系统能关联回复对象、被引用内容和必要历史观点；上下文缺失、不可访问或语义不确定时显式标记，不猜测补全。
- [ ] **AC-3** `[AI自测]`：重复轮询、补偿拉取、任务重试或服务重启不会产生重复内容、重复研究卡片或重复通知；幂等键、游标和通知去重均有可重复测试。
- [ ] **AC-4** `[AI自测]`：内容编辑、删除或变为不可访问时，系统按明确状态机更新记录，保留政策允许的审计元数据与处理历史，并能安全重处理；策略不得违反 X 内容展示和开发者政策。
- [ ] **AC-5** `[AI自测]`：中文研究卡片至少包含原文、忠实翻译、内容类型、Serenity 核心判断、历史观点变化、公司/Ticker/主题、明确证据、不确定性、AI 置信度和即时提醒结论，并以结构化字段区分 Serenity 原话、他人内容、AI 解释和未验证推断。
- [ ] **AC-6** `[用户手动]`：使用 OpenAI `gpt-5.6-terra` 的真实 Responses API 调用抽查研究卡片时，输出通过严格结构化契约；翻译未把猜测写成事实，AI 未声称读取未实际获取的外链，未擅自生成未经证据验证的 A 股受益公司名单，观点变化证据不足时明确说明无法判断。
- [ ] **AC-7** `[AI自测]`：重要性由可配置的结构化规则和可解释分项共同决定；高价值 fixture 进入通知队列，普通/低价值 fixture 仅归档，阈值变化可测试且不由模型任意覆盖。
- [ ] **AC-8** `[AI自测]`：通知具有稳定去重键、发送状态、失败原因和可重试机制；明确区分确认失败与发送结果未知，模拟发送失败、超时与重试后不静默丢失，也不会对结果未知的发送进行盲目自动重发。
- [ ] **AC-9** `[用户手动]`：飞书是可选的重要消息提醒渠道。显式启用并配置真实飞书机器人时必须使用安全签名，高价值内容能向提出需求的用户控制的私有飞书群发送一条不泄露 Secret、可追溯到私有详情页的提醒；默认禁用时不创建发送任务或失败积压，网页归档、OpenAI 分析、搜索和查看仍正常运行；显式启用但缺少 Webhook 或签名密钥时才显示通知待配置。
- [ ] **AC-10** `[回写后测]`：私有网页是主要使用入口；未认证访问被拒绝，父亲与提出需求的用户可分别使用预配置、同权限的家庭账号，无需使用飞书即可查看最新情报、历史时间线和单条详情及上下文，并按关键词、Ticker、主题、重要性和内容类型搜索或筛选；反馈能追溯到实际登录账号。
- [ ] **AC-11** `[回写后测]`：用户可对研究卡片提交“重要、已知、不相关、继续跟踪、翻译有误、分析有误”等反馈，反馈可追溯到用户、卡片和时间且不会篡改原始内容。
- [ ] **AC-12** `[回写后测]`：运行状态页区分 ingestion run 的轮询/补偿模式，并展示 ingest、上下文补全、AI 分析、重要性评分、可选通知和 worker heartbeat；失败/阻断/结果未知任务包含可理解原因与符合资格的恢复入口。健康环境下，从首次成功观察到一条 X 内容到其研究卡片可在网页查看的默认目标为 30 分钟，实际耗时和超目标原因必须可见。
- [ ] **AC-13** `[AI自测]`：模拟数据源中断、限流、上下文补全失败、模型失败、通知失败和进程重启后，任务状态可恢复或进入明确的终态/死信处理，不存在静默成功或静默丢失。
- [ ] **AC-14** `[用户手动]`：来自帖子、引用、网页和历史档案的文本被作为不可信数据封装；自动化测试证明模型无工具/Secret 通道和输出校验边界，真实 OpenAI `gpt-5.6-terra` 固定对抗样本的人工抽查证明恶意文本未成为事实结论；Mock 不得冒充真实模型语义验证。
- [ ] **AC-15** `[AI自测]`：前端产物、普通 API 正文、日志、错误页、测试快照和 Git 扫描均不泄露 Token、Webhook、第三方/金融 Cookie、管理员凭据、可复用会话 Token 或证券账户信息；允许认证接口设置符合 HttpOnly、SameSite 与 Secure 策略的本站会话 Cookie，允许保存公开 X 来源标识和内部 actor ID；Secret 只从服务端配置读取，缺失时失败可见。
- [ ] **AC-16** `[AI自测]`：系统不存在券商、证券账户、持仓导入、行情交易、自动买卖指令、浏览器 Cookie/模拟登录抓取或微信/QQ Hook 接口；相关越界输入被拒绝或仅作为不可信研究文本处理。
- [ ] **AC-17** `[AI自测]`：AI 与 X 调用记录供应商/模型或 API 版本、调用状态和可审计的成本计量；预算或速率上限触发时停止新增外部调用并显示原因，不以静默降质兜底。
- [ ] **AC-18** `[用户手动]`：最终验收报告逐项区分自动化测试、Mock、真实 X/OpenAI API、可选的真实飞书 API 和待人工配置/验证；Docker、部署、认证或所需外部凭据未实际验证的部分不得标记为通过，未启用飞书不得导致核心网页闭环判定失败。
- [ ] **AC-19** `[用户手动]`：使用同一条真实 Serenity 内容贯穿 X 获取、回复/引用上下文、OpenAI `gpt-5.6-terra`、研究卡片、重要性评分和同一私有详情页，所有阶段 ID 可追溯；若已配置带安全签名的飞书，再验证其提醒指向同一详情页。父亲不打开 X、不阅读英文原文，仅凭中文卡片即可准确回答“发生了什么、谁说的、证据是什么、哪里不确定”。另用一条真实普通/低价值内容验证其可检索但不发送提醒，并人工走通登录、筛选、反馈与状态查看。缺少核心真实外部凭据或目标环境时本项保持未验收，但飞书未配置不阻塞核心闭环。
<!-- HARNESS:AC_LIST_END -->

## 关联 Spec

### 已有主 Spec

- `project-foundation`：继续作为工程基础规格；本 change 将把“初始化占位页”改为业务 change 实施后的私有登录/工作区入口，并把仓库 Secret 扫描与构建产物 Secret 扫描区分为两个阶段。

### 拟新增 Capabilities

- `serenity-content-ingestion`：合规获取、幂等归档、补偿拉取以及编辑/删除/不可访问状态处理。
- `research-context-and-card`：回复/引用/历史观点上下文构造，以及边界清晰的中文研究卡片。
- `importance-and-notification`：结构化重要性判断、可解释评分、通知选择与通知去重。
- `private-research-workspace`：私有访问、归档检索、时间线、详情、筛选与用户反馈。
- `operations-and-recovery`：处理状态、错误追踪、重试恢复、成本可见性与运行状态。

最终 capability 边界将在 design/specs 阶段结合现有代码与审查结果收敛；不因初始拆分主动扩大范围。

## 影响范围

- 前端：`client/src/` 私有研究工作区、检索筛选、详情、状态与反馈界面。
- 后端：`server/` 业务模块、任务编排和 API；`server/infrastructure/` 下的 X、AI、通知、认证与存储适配器。
- 共享契约：`shared/` 中的内容、研究卡片、筛选、状态与反馈类型。
- 数据：由批准后的 spec/design 定义 `drizzle/schema.ts` 和迁移；proposal 阶段不猜测业务表。
- 外部系统：X API、选定的 AI 供应商、飞书自定义机器人、私有部署与认证环境。
- 安全与合规：X 开发者条款和内容展示政策、Secret 管理、Prompt Injection 防护、只读研究边界。
- 成本：X API credits、AI token/模型调用、任务补偿频率、存储保留与通知量。

## 开放问题

以下问题不阻塞 proposal 草稿，但会影响范围、验收、成本或风险，应在 proposal_confirm 合批确认，或在 design 中记录默认方案、备选方案与取舍依据：

1. X 获取方式：以周期轮询 + 游标/时间窗补偿为稳定基线，还是加入 Filtered Stream；真实套餐、credits、速率限制与内容展示政策以实际账号验证为准。
2. 内容生命周期：编辑、删除、不可访问内容保存哪些审计字段、是否继续展示正文、保留期限及政策约束。
3. 私有认证：已确定两个预配置家庭账号、同一权限、无注册/多角色；部署时仍需配置各自密码摘要、HTTPS 外网边界和凭据轮换操作。
4. AI 成本与运行参数：OpenAI `gpt-5.6-terra` 已确定；仍需在实施/部署时配置预算上限、reasoning effort、超限行为、模型版本记录和重试边界。
5. 飞书机器人：可选渠道与安全签名已确定；仍需在部署时配置接收目标、Webhook、签名密钥、限流、失败重试和消息去重。
6. 部署环境：服务器/云环境、MySQL/Redis 可用性、HTTPS、域名、备份、日志与监控；Docker 缺失时的验证替代方案。
7. 历史数据：参考仓库 License 未明确时，仅用官方 X API 获取的历史范围，还是等待授权后再考虑导入。
8. 观点演化：第一阶段的历史关联窗口、主题聚类粒度与“不足以判断变化”的展示规则。
9. 重要性阈值：默认权重、即时提醒阈值、低价值静默归档规则，以及用户反馈如何影响后续评分。
10. 验收边界：哪些项必须真实 X/AI/飞书联调，哪些可由自动化测试或 Mock 证明，哪些必须由用户完成配置和人工检查。
11. Repair lane：第 2 类规范遗漏需要回写哪些工件并重跑哪些审查；第 1、2 类未关闭前禁止归档。

### Proposal 确认时建议采用的默认值

- X 获取：以官方用户帖子接口的周期轮询、游标和重叠时间窗补偿作为可靠基线；仅在套餐、credits 和稳定性验证支持时加入 Filtered Stream，实时通道不能替代补偿。
- 内容生命周期：保存平台 ID、状态变化和处理审计；正文展示/保留服从 X 政策，删除或不可访问内容默认在私有站点隐藏正文并保留最小 tombstone 元数据，最终细节由 design 核对政策后确定。
- 私有认证：第一阶段为父亲和提出需求的用户各配置一个同权限家庭账号，无公开注册、无角色系统、服务端 Redis 会话和强 Session Secret；密码只以 `scrypt` 摘要配置。凭据轮换时撤销该 actor 全部会话，生产外网访问必须使用 HTTPS。
- AI：第一版落地 `OpenAIResearchModelAdapter`，通过 Responses API 调用 `gpt-5.6-terra` 的严格结构化输出且不启用工具；`AI_PROVIDER=openai`、`OPENAI_MODEL=gpt-5.6-terra` 与凭据/预算均由服务端配置注入。业务层只依赖 `ResearchModelAdapter`，以后可替换模型或供应商；预算超限时停止分析并显示待处理，不自动换低质量模型。
- 通知：私有网页是主要入口；飞书自定义机器人是唯一可选生产提醒渠道，第一版通过提出需求的用户控制的私有飞书群 Webhook 接收，父亲无需使用。默认 `FEISHU_ENABLED=false` 且不创建 delivery；启用飞书必须同时配置 Webhook 与安全签名密钥。QQ/邮件仅保留适配器边界，不在本 change 实现。
- 部署：单实例应用 + MySQL 8 + Redis 7 为第一阶段目标，不引入多租户或高可用集群；Docker/Compose 在有可用环境后补真实验证。
- 历史数据：参考仓库 License 未明确期间不复制或导入其代码和数据，只参考高层方法；历史关联首先使用官方 API 实际可得范围。
- 验收证据：自动化与 Mock 用于可重复行为验证；真实 X、OpenAI `gpt-5.6-terra` 和可选飞书联调分别记录。核心外部凭据未提供时允许实现继续但相关 AC 保持未验收；飞书未配置只让通知分支保持待配置，不阻塞网页、归档、AI、搜索和查看的验收。
- Repair lane：第 1 类在当前 change 内做最小修复并补回归测试；第 2 类先补 proposal/spec/design/test-checklist/tasks 并重跑受影响审查；第 3 类新开 change；第 4 类先复现环境/数据/操作问题。第 1、2 类未关闭前不得归档。
