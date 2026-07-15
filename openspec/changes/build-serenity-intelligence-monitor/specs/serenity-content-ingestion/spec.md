## ADDED Requirements

### Requirement: X 必须默认关闭并允许无凭据完成设置
X 生产同步 MUST 默认为关闭；用户 MUST 能在不配置 X 凭据时完成向导。未配置或关闭时系统 MUST NOT 发起真实 X 请求或创建同步任务，并 MUST 显示“X 未配置，尚未进行真实同步”。

#### Scenario: 首次设置跳过 X
- **WHEN** 用户未填写 Token 或保持 X 关闭并完成向导
- **THEN** 系统保存 `configured=false`/`enabled=false` 状态且零真实请求
- **AND** 启动器和私有网页明确显示尚未进行真实同步，不用 fixture 冒充真实数据

#### Scenario: 用户启用 X
- **WHEN** 用户填写 Token、确认政策并选择连接测试
- **THEN** 系统只通过官方服务端 API 测试认证与必要能力
- **AND** 测试通过前不得创建周期同步任务

### Requirement: 仅通过官方服务端接口获取 Serenity 内容
系统 MUST 仅在服务端通过合规的官方 X API 获取 `@aleabitoreddit` 的帖子、回复和引用内容，且不得使用浏览器 Cookie、模拟登录、客户端 Hook 或父亲金融电脑上的抓取程序。

#### Scenario: 使用真实凭据获取内容
- **WHEN** 管理员配置有效 X Developer 凭据、credits 并启用生产同步
- **THEN** 系统通过官方用户帖子接口获取 Serenity 内容并保存来源 URL、平台 ID、作者、原文、发布时间与获取时间
- **AND** Token 不出现在浏览器、队列负载、日志或错误响应中

#### Scenario: 缺少真实 X 配置
- **WHEN** X Token、credits 或生产启用确认缺失
- **THEN** 系统将数据源标记为待配置或阻断
- **AND** 验收证据不得把 Mock 标记为真实 API 验证

### Requirement: 内容归档和游标推进必须幂等
系统 MUST 以 provider 与平台内容 ID 的唯一组合归档内容，并且 MUST 在完整分页成功后才推进同步游标。

#### Scenario: 重复轮询同一内容
- **WHEN** 周期轮询、重叠补偿、任务重试或服务重启再次返回同一平台内容 ID 与版本
- **THEN** 系统只保留一条内容记录
- **AND** 不重复创建同版本研究卡片或通知

#### Scenario: 分页中途失败
- **WHEN** 多页拉取在任一后续页面失败
- **THEN** 系统不把游标推进到未完整持久化的位置
- **AND** 重试后能够安全重读已成功页面且不产生重复记录

### Requirement: 系统必须执行可靠补偿和近期复核
系统 MUST 使用周期轮询、重叠补偿和近期内容复核弥补中断或漏取，不得把实时通道作为可靠闭环的唯一来源。

#### Scenario: 暂态数据源中断
- **WHEN** X API 返回网络错误、429 或 5xx
- **THEN** 系统记录可重试失败并按带 jitter 的退避策略重试
- **AND** 恢复后从安全游标继续处理

#### Scenario: 达到不可恢复条件
- **WHEN** X API 返回认证、权限或预算阻断错误
- **THEN** 系统进入明确的阻断状态并停止新增调用
- **AND** 状态页展示不含 Secret 的原因

### Requirement: 内容生命周期必须可审计并符合平台政策
系统 MUST 识别内容编辑、删除和不可访问状态，并 MUST 按人工确认的 X 政策处理正文、原始载荷和最小 tombstone。

#### Scenario: 内容被编辑
- **WHEN** 相同平台 ID 的规范化载荷哈希发生变化
- **THEN** 系统追加不可变内容版本与生命周期事件，不覆盖旧版本审计
- **AND** 只为新版本触发一次下游重处理

#### Scenario: 内容被删除或不可访问
- **WHEN** provider 给出明确删除证据或连续复核达到人工确认的不可访问门槛
- **THEN** 系统隐藏或清除政策限制的正文与原始载荷
- **AND** 仅保留政策允许的最小标识、状态时间和处理审计

#### Scenario: 批量响应暂态缺项
- **WHEN** lookup 批次部分响应、限流、权限变化或网络故障使内容暂时缺失
- **THEN** 系统进入非破坏性的待确认状态并停止下游使用旧正文
- **AND** 不得立即清除已归档版本或把暂态失败标成删除

### Requirement: 原始响应审计不得泄露凭据
系统 MUST 保存业务审计所需且政策允许的原始响应字段、provider request ID 和处理元数据，但 MUST 排除 Authorization header、Token、Cookie 与 Webhook。

#### Scenario: 成功归档 provider 响应
- **WHEN** X API 返回可用内容
- **THEN** 系统保存可追溯的脱敏响应审计与用量记录
- **AND** 记录能够关联到 ingestion run 和内部内容 ID

#### Scenario: 错误响应包含敏感字段
- **WHEN** provider 错误对象或请求上下文含敏感配置
- **THEN** 系统只持久化稳定错误类别和脱敏元数据
- **AND** 日志与状态 API 不回显敏感值
