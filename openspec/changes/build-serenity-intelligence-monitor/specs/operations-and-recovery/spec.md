## ADDED Requirements

### Requirement: 启动器必须呈现本地依赖和后台进程生命周期
系统 MUST 在启动器中分别显示 MySQL、Redis、migration、API 和 worker 的启动、健康、停止与错误状态，并 MUST 使用稳定中文错误类别和下一步操作。

#### Scenario: worker 未产生 heartbeat
- **WHEN** 数据库、Redis 与 API 健康但 worker 在时限内没有 heartbeat
- **THEN** 启动流程停止在 worker 阶段并显示 `worker_start_failed`
- **AND** 不打开网页或把整个系统显示为健康

#### Scenario: 重复启动或停止
- **WHEN** 用户重复点击启动、停止或健康检查
- **THEN** 编排操作幂等并返回当前真实状态
- **AND** 不产生重复 API/worker 进程或重复 Compose project

### Requirement: 真实环境证据必须覆盖打包应用和 Docker 生命周期
最终验收 MUST 区分 Electron 自动化/Mock、Windows 打包产物、真实 Docker Desktop、真实外部 API 与用户手动证据；当前开发机缺少 Docker 时，对应生命周期 MUST 保持待目标环境验证。

#### Scenario: 本机没有 Docker 命令
- **WHEN** 自动化使用 fake controller 验证编排但未在真实 Docker Desktop 运行
- **THEN** 报告可标记编排契约或 Mock 通过
- **AND** 不得把 MySQL/Redis 真实生命周期、端口绑定或恢复写成已验证

### Requirement: 每个流水线阶段必须有可审计状态
系统 MUST 为获取、上下文补全、AI 分析和评分的核心流水线，以及独立的可选通知分支记录 pending、processing、成功、可重试失败、阻断、结果未知或死信，以及 attempt、lease owner/fencing、错误分类、人工重试资格和版本信息。可选通知配置缺失 MUST NOT 把已完成评分的核心流水线标记为失败。

#### Scenario: 可选通知禁用但核心流水线完成
- **WHEN** 内容已完成归档、上下文、OpenAI 分析和评分，且飞书未启用
- **THEN** 核心流水线保持成功且不创建通知 delivery
- **AND** 状态页显示可选渠道 `disabled`，不计入失败或积压

#### Scenario: 流水线正常完成
- **WHEN** 一条内容依次完成各处理阶段
- **THEN** 每个阶段都有按时间关联的成功 attempt
- **AND** 状态能够追溯到内容、卡片或通知内部 ID

#### Scenario: 阶段处理失败
- **WHEN** 任一阶段抛出错误
- **THEN** 系统记录阶段、attempt、可理解错误类别与是否可重试
- **AND** 不得把失败记为成功或静默丢弃

### Requirement: 服务重启后必须恢复未完成任务
系统 MUST 通过数据库状态和过期 lease reconciliation 恢复 pending、过期 processing、“已提交未入队”和可重试失败任务。

#### Scenario: worker 在处理中退出
- **WHEN** worker 在持有 lease 时崩溃或重启
- **THEN** lease 到期后 reconciliation 创建新 attempt 并重新排队
- **AND** 已完成业务副作用依靠幂等键不重复执行，旧 worker 的迟到提交因 fencing token 失效而被拒绝

#### Scenario: 数据库提交后入队前崩溃
- **WHEN** 业务事务已提交下一阶段唯一 pending 工作意图但 BullMQ 尚未收到作业
- **THEN** dispatcher 或 reconciliation 根据该持久意图重新投递
- **AND** 重复投递不创建第二个业务副作用

#### Scenario: 达到最大重试次数
- **WHEN** 暂态错误持续到最大 attempt 或错误被分类为不可恢复
- **THEN** 任务进入 `dead_letter` 并记录 `manual_retry_allowed`，或进入不可人工恢复的 `blocked` 状态
- **AND** 只有管理员显式重试才能创建新的 attempt 链

### Requirement: 私有状态页必须呈现运行与恢复信息
认证家庭用户 MUST 能查看最近一次轮询、补偿、上下文、AI 与通知状态、队列摘要、待配置项和可恢复失败，但 MUST NOT 看到 Secret 或内部错误栈。

#### Scenario: 核心网页可见性目标
- **WHEN** X API 首次成功返回一条新内容
- **THEN** 系统记录从首次观察到研究卡片可在网页查看的分阶段耗时，并以 30 分钟为默认目标
- **AND** 超目标时状态页显示阻塞阶段和原因，不得静默丢弃、跳过证据校验或伪造成功

#### Scenario: 查看运行状态
- **WHEN** 管理员打开状态页
- **THEN** 页面显示五类阶段的最近状态、时间、失败摘要和配置状态
- **AND** 可恢复任务提供创建新 attempt 的显式入口

#### Scenario: 终态失败或配置缺失
- **WHEN** 系统存在终态任务或缺少外部配置
- **THEN** 状态页明确显示失败或待配置而不是健康
- **AND** 不允许对不可重试任务执行伪恢复

### Requirement: 外部调用必须有用量和成本审计
系统 MUST 记录 X 与 AI 的 provider、操作、API/模型版本、状态、资源或 token 用量、成本、request ID 与时间，并 MUST 在调用前执行预算和速率检查。

#### Scenario: 外部调用成功
- **WHEN** X 获取或 AI 分析成功返回用量元数据
- **THEN** 系统保存与 provider 结果一致的脱敏 usage 记录
- **AND** 记录不包含 API Key、Authorization 或 Webhook

#### Scenario: 预算或速率上限触发
- **WHEN** 新调用会超过配置上限
- **THEN** 系统通过原子预算 reservation 阻止 provider 调用并保存明确阻断状态
- **AND** reconciliation 不得绕过上限或静默降级

#### Scenario: 并发调用接近预算边界
- **WHEN** 多个 worker 同时申请会共同超过剩余额度的调用
- **THEN** 原子 reservation 只允许不超过预算的调用开始
- **AND** 完成后按实际用量结算，未开始的调用保持可见阻断状态

### Requirement: 系统必须维持只读研究边界
系统 MUST NOT 提供券商、证券账户、持仓、行情、回测、组合、订单、自动交易、浏览器 Cookie 抓取、模拟登录或微信/QQ Hook 能力。

#### Scenario: 研究文本包含交易措辞
- **WHEN** 帖子内容出现买入、卖出、持仓或价格观点
- **THEN** 系统只把文字作为不可信研究材料归档和分析
- **AND** 不创建交易动作或账户数据

#### Scenario: 客户端请求越界动作
- **WHEN** 请求尝试下单、导入持仓、上传证券 Cookie 或调用 Hook
- **THEN** 系统以 4xx 或 404 拒绝动作
- **AND** 不产生敏感或交易副作用

### Requirement: 验收证据必须按证明力分类
验收记录 MUST 对每条测试结果区分自动化已验证、Mock 已验证、真实 API 已验证和待人工配置或验证，并 MUST 应用 spec-bound repair lane。

#### Scenario: 外部凭据或部署环境未验证
- **WHEN** X、AI、飞书、Docker、Windows 打包应用、回环网络边界、认证或目标环境缺少真实证据
- **THEN** 对应验收项保持待人工或 Mock 状态
- **AND** 不得标记为真实通过

#### Scenario: 同一真实内容完成核心网页端到端验收
- **WHEN** 同一 Serenity external ID 经过真实 X、上下文、OpenAI `gpt-5.6-terra`、评分和私有详情页
- **THEN** 验收报告保存可串联的 run、content version、context、OpenAI request、card、score 与页面 ID
- **AND** 用户无需飞书即可在私有网页完成登录、搜索、筛选、详情、反馈与状态核查

#### Scenario: 可选飞书分支加入同一闭环
- **WHEN** 已配置带安全签名的真实飞书机器人并对上述同一内容启用提醒
- **THEN** 验收报告追加可串联的 delivery/provider ID 与签名请求结果
- **AND** 提醒包含同一内容 ID 和本机回环详情 URL，并明确只能在运行 Serenity 的同一台电脑打开；未配置飞书不改变核心网页闭环结论

#### Scenario: 真实普通内容保持低打扰
- **WHEN** 用户预先标注的普通或低价值真实内容完成分析
- **THEN** 内容可在私有时间线检索和回看但不产生飞书提醒
- **AND** 初始阈值、冷启动历史不足和预算阻断行为由用户人工复核并记录

#### Scenario: 验收发现缺陷
- **WHEN** 人工反馈属于实现偏差、原目标规范遗漏、范围扩大或环境问题
- **THEN** 系统按 repair lane 分别执行最小修复、先回写规格、新建 change 或先复现解释
- **AND** 第 1、2 类问题关闭前不得归档
