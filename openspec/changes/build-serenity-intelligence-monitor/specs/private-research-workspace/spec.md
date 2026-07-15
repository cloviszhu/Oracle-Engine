## ADDED Requirements

### Requirement: 私有站点必须使用两个同权限家庭账号的服务端会话
系统 MUST 为父亲与提出需求的用户分别支持一个预配置家庭账号，两个账号权限相同且反馈 actor 独立；系统 MUST 禁止公开注册和角色管理，并 MUST 使用服务端会话保护除健康检查和登录外的全部 API 与页面数据。

#### Scenario: 管理员登录成功
- **WHEN** 任一预配置家庭用户提交自己的正确用户名和密码
- **THEN** 系统使用恒定时间密码校验并建立有期限的 Redis 会话
- **AND** 会话绑定该 actor，Cookie 设置 HttpOnly、SameSite=Strict 且生产环境设置 Secure

#### Scenario: 两名家庭用户分别提交反馈
- **WHEN** 父亲与提出需求的用户分别登录并对同一卡片提交反馈
- **THEN** 两条反馈分别关联实际登录 actor 且互不覆盖
- **AND** 系统不引入不同角色、公开用户或租户边界

#### Scenario: 未认证或伪造会话访问
- **WHEN** 请求缺少有效会话、Cookie 签名无效或会话已过期
- **THEN** 私有 API 返回 401 且页面导航到登录入口
- **AND** 响应不泄露账号、Secret 或内部错误栈

#### Scenario: 会话过期、注销或 Secret 轮换
- **WHEN** Redis 会话 TTL 到期、用户注销、会话记录被删除或 `SESSION_SECRET` 轮换
- **THEN** 旧 Cookie 立即或在既定轮换边界内失效并返回 401
- **AND** Redis 只保存不可直接复用的会话 token 哈希

#### Scenario: 连续登录失败触发限速
- **WHEN** 同一来源或管理员标识在窗口内超过允许的失败次数
- **THEN** 登录接口返回稳定限速响应且不泄露账号是否存在
- **AND** 限速窗口结束后正确凭据可以恢复登录

#### Scenario: 写请求缺少 CSRF 保护
- **WHEN** 反馈或重试请求的 CSRF token 或 Origin 校验失败
- **THEN** 系统以明确 4xx 拒绝请求
- **AND** 不产生任何数据副作用

### Requirement: 私有网页必须是无需通知渠道的主要使用入口
认证用户 MUST 无需使用或配置飞书即可查看最新情报、历史时间线和单条详情，并 MUST 能按关键词、Ticker、主题、重要性、内容类型和日期范围进行受限分页筛选。飞书配置状态 MUST NOT 阻断登录、归档、分析结果、搜索或查看。

#### Scenario: 未配置飞书时使用完整网页工作区
- **WHEN** 飞书 Webhook 和签名密钥均未配置且认证用户打开私有站点
- **THEN** 用户能够正常登录、浏览已归档内容、查看 OpenAI 研究卡片并执行搜索筛选
- **AND** 页面只把通知显示为待配置，不得把核心工作区标为不可用

#### Scenario: 组合筛选历史内容
- **WHEN** 认证用户提交多个有效筛选条件
- **THEN** 系统返回同时满足条件的稳定分页结果
- **AND** 排序、页大小和查询字段只允许白名单值

#### Scenario: 查询参数非法或过大
- **WHEN** 页大小超过上限、排序字段非法或文本包含通配符/注入载荷
- **THEN** 系统拒绝或安全规范化请求
- **AND** 不执行未转义 SQL 或返回越权数据

### Requirement: 详情页必须展示研究分层和上下文
认证用户 MUST 能在单条详情中核对来源 URL、原文、翻译、Serenity 判断、他人内容、AI 解释、未验证推断、证据、不确定性、观点变化、评分、通知状态和上下文关系。

#### Scenario: 查看完整研究卡片
- **WHEN** 认证用户打开已分析内容详情
- **THEN** 页面以独立分区显示全部信息层次和来源引用
- **AND** 缺失或不可访问上下文显示明确原因而非猜测正文

#### Scenario: 内容已删除或不可访问
- **WHEN** 认证用户打开已进入 tombstone 状态的详情
- **THEN** 页面隐藏政策限制的正文并显示状态与允许的最小审计信息
- **AND** 不返回已清除的 raw payload

### Requirement: 用户反馈必须追加且可追溯
认证用户 MUST 能提交“重要、已知、不相关、继续跟踪、翻译有误、分析有误”反馈，反馈 MUST 关联 actor、卡片版本和时间且不得修改原始内容。

#### Scenario: 提交合法反馈
- **WHEN** 认证用户对现有研究卡片提交允许的反馈类型
- **THEN** 系统追加一条可追溯反馈并在页面回显
- **AND** 内容、卡片与既有反馈保持不变

#### Scenario: 非法反馈或越权字段
- **WHEN** 请求包含未知类型、超长备注、伪造 actor 或不存在卡片
- **THEN** 系统返回明确 4xx 且不创建半成品反馈
- **AND** 客户端字段不能覆盖服务端 actor 或卡片关联

### Requirement: 前端不得接触外部服务 Secret
浏览器端 MUST 只调用同源私有 API，并 MUST NOT 包含 X Token、AI Key、Webhook、第三方/金融 Cookie、管理员凭据、可复用会话 Token 或证券账户信息。系统 MAY 通过认证响应设置符合安全属性的本站 HttpOnly 会话 Cookie，并 MAY 展示公开 X 来源标识和内部 actor ID。

#### Scenario: 构建前端产物
- **WHEN** 执行生产构建和 Secret 扫描
- **THEN** 前端 bundle、source map、错误页和测试快照不包含任何服务端 Secret
- **AND** 外部 API 只由服务端适配器调用

### Requirement: 私有站点深链接必须可直接打开
系统 MUST 对非 API 的客户端路由提供 SPA fallback，同时 MUST 保持 API 与静态资源的真实 404 语义。

#### Scenario: 从飞书打开详情绝对链接
- **WHEN** 已认证或完成登录后的用户直接访问 `/intelligence/:id`、`/timeline` 或 `/status`
- **THEN** NestJS 返回 React 应用并恢复目标路由
- **AND** 页面加载对应私有数据而不是返回服务器 404

#### Scenario: 访问不存在的 API
- **WHEN** 客户端请求不存在的 `/api/**` 路径
- **THEN** 系统返回 API 404
- **AND** 不得用 `index.html` 覆盖该错误
