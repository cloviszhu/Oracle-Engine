## ADDED Requirements

### Requirement: 上下文只能由实际获取的材料构造
系统 MUST 将回复对象、被引用内容和实际归档的必要历史观点关联到当前内容，并 MUST 对缺失、不可访问或语义不确定的上下文显式标记。

#### Scenario: 回复和引用上下文完整
- **WHEN** X expansions 或后续 lookup 返回回复对象与被引用内容
- **THEN** 系统建立带方向与来源 ID 的回复和引用关系
- **AND** 研究输入中的每段上下文都能追溯到已归档内容

#### Scenario: 上下文无法获取
- **WHEN** 回复对象、引用内容或历史证据缺失、不可访问或不足
- **THEN** 系统记录明确 missing reason 或“无法判断变化”
- **AND** 不得由 AI 猜测补全正文或历史结论

#### Scenario: 新系统冷启动缺少历史观点
- **WHEN** 本地尚未积累足够 Serenity 历史卡片且未获得可合法导入的历史数据授权
- **THEN** 系统明确显示“历史样本不足，无法判断观点变化”并从上线日起积累
- **AND** 不得复制无明确 License 的参考仓库数据或用模型伪造历史

### Requirement: 研究卡片必须以结构化字段区分信息层次
系统 MUST 生成中文研究卡片，并 MUST 分别保存原文、忠实翻译、Serenity 明确判断、他人内容、AI 解释、未验证推断、观点变化、实体、证据、不确定性、置信度和提醒结论。

#### Scenario: 结构化输出完整
- **WHEN** 模型返回符合契约且来源引用有效的分析结果
- **THEN** 系统持久化通过 schema 的版本化研究卡片
- **AND** 每条事实性结论关联来源内容 ID 或明确标记为 AI 解释/未验证推断

#### Scenario: 模型输出缺字段或伪造来源
- **WHEN** 模型响应缺少必填字段、引用不存在的来源或在上下文不足时给出高置信度
- **THEN** 系统拒绝该响应并记录校验失败
- **AND** 不创建评分或通知任务

### Requirement: 翻译和解释必须保持证据边界
系统 MUST 忠实保留原文的条件、可能性和不确定性；AI MUST NOT 声称读取未实际获取的外链，也 MUST NOT 生成未经证据验证的 A 股受益公司名单。

#### Scenario: 原文包含推测性措辞
- **WHEN** Serenity 内容使用可能、如果或尚未确认等限定表达
- **THEN** 中文翻译保留对应不确定性
- **AND** 不得把推测改写为事实

#### Scenario: 内容包含未读取外链或产业相关性
- **WHEN** 帖子包含系统未获取的外链或仅有行业级 A 股相关线索
- **THEN** 卡片标记外链未读取并把具体公司实体设为需要进一步验证
- **AND** 不得生成无证据的受益公司名单

### Requirement: AI 输入必须抵御 Prompt Injection
系统 MUST 把帖子、引用、网页文字和历史档案作为带来源 ID 的不可信数据封装，且模型适配器 MUST NOT 提供网络、文件、环境变量或工具访问能力。

#### Scenario: 正常不可信文本进入分析
- **WHEN** 外部文本被送入研究模型
- **THEN** 系统指令与 data envelope 保持结构隔离
- **AND** 输出必须通过 schema、来源、枚举和长度校验

#### Scenario: 外部文本包含恶意指令
- **WHEN** fixture 要求忽略系统指令、读取 Secret、调用工具或把自身写成事实
- **THEN** 恶意文本不能改变系统策略或触发越权行为
- **AND** 越权或伪造来源的模型响应被拒绝并留下失败审计

#### Scenario: 真实模型对抗样本验收
- **WHEN** 已选定真实模型并提供合法凭据后执行有限的 Prompt Injection 对抗样本
- **THEN** 验收报告分别记录无工具/无 Secret 通道的自动化证据和语义输出的人工结论
- **AND** Mock 结果不得被标记为真实模型语义抗注入验证

### Requirement: 模型调用必须版本化并受硬预算约束
系统 MUST 在第一版通过 `ResearchModelAdapter` 的 OpenAI 实现使用 Responses API 调用 `gpt-5.6-terra` 严格结构化输出，并 MUST 记录 provider、模型、prompt 版本、token usage、成本、provider request ID 与调用状态；系统 MUST 以内容版本、上下文哈希、prompt 版本和模型版本形成分析幂等键。业务层 MUST NOT 依赖 OpenAI SDK 类型，provider 与 model MUST 可由服务端配置替换。

#### Scenario: OpenAI 第一版生成研究卡片
- **WHEN** `AI_PROVIDER=openai`、`OPENAI_MODEL=gpt-5.6-terra` 和合法服务端凭据已配置
- **THEN** 适配器通过 Responses API 请求严格 `ResearchCardDraft` 结构化输出并通过本地 schema/来源校验
- **AND** 请求不提供网络、文件、代码执行或其他工具，响应保存统一 usage、request ID 与模型版本而不泄露 API Key

#### Scenario: OpenAI 配置缺失
- **WHEN** OpenAI API Key 或已确认模型配置缺失
- **THEN** 原始内容继续归档并可从私有网页搜索和查看，分析进入 `blocked/configuration`
- **AND** 系统不得伪造卡片、切换未批准模型或阻塞既有归档浏览

#### Scenario: 第一版配置了错误 provider 或 model
- **WHEN** 生产配置不是 `AI_PROVIDER=openai` 与 `OPENAI_MODEL=gpt-5.6-terra` 的批准组合，或能力检查表明目标项目无权访问/无法返回严格结构化输出
- **THEN** 配置校验或分析阶段以明确 `blocked/configuration|capability` 失败
- **AND** 系统不得静默切换 provider/model，原始归档和已有网页内容保持可用

### Requirement: 发送给 AI 的家庭数据必须最小化
系统 MUST 仅向研究模型发送生成卡片所需的已归档正文、来源 ID、上下文关系、时间和历史观点候选；系统 MUST NOT 发送家庭账号、会话、反馈备注、访问日志、通知配置、X raw payload 或任何 Secret。

#### Scenario: 构造 OpenAI data envelope
- **WHEN** 系统为一条内容构造研究请求
- **THEN** envelope 只包含字段白名单内的研究材料并保留来源 ID
- **AND** actor、Cookie、反馈、Webhook、签名密钥、Authorization 和 raw payload 字段不存在

#### Scenario: 相同输入重复分析
- **WHEN** 相同分析幂等键被再次提交
- **THEN** 系统复用既有成功结果或拒绝重复付费调用
- **AND** 不重复生成卡片版本

#### Scenario: 达到 AI 预算或速率上限
- **WHEN** 预估调用会超过配置的硬预算或当前速率上限
- **THEN** 系统不发起新的 provider 调用并显示阻断原因
- **AND** 不得静默切换低质量模型或伪造结果
