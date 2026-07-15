## MODIFIED Requirements

### Requirement: 家庭生产配置不得依赖开发者环境文件
家庭生产路径 MUST 由 Electron main 提供已校验的运行配置快照，普通用户 MUST NOT 手工编辑 `.env`、生成密码摘要或执行多条命令；`.env.example` MAY 仅用于开发与测试。

#### Scenario: 打包应用启动 API 和 worker
- **WHEN** 启动器已解密 vault 并启动受控 `utilityProcess`
- **THEN** API 与 worker 通过私有进程 IPC 接收一次性运行配置快照
- **AND** Secret 不进入命令行参数、普通环境文件或 Docker inspect

#### Scenario: 开发者运行本地测试
- **WHEN** 开发者使用仓库脚本启动或测试服务
- **THEN** 开发/测试路径可以读取 `.env.example` 对应变量
- **AND** 文档不得把该路径描述为家庭用户的正常交付方式

### Requirement: 初始化页面
React 应用 MUST 在业务 change 实施前展示工程初始化状态；`build-serenity-intelligence-monitor` 实施后，根页面 MUST 成为受保护的私有研究工作区入口，不得继续把业务能力描述为尚未实现。

#### Scenario: 业务 change 尚未实施
- **WHEN** 浏览器加载仅含工程骨架的 React 应用
- **THEN** 页面展示“Serenity 海外产业信息监控”
- **AND** 页面展示“工程初始化完成”
- **AND** 页面说明业务功能将在 OpenSpec change 中定义和实现

#### Scenario: 业务 change 已实施
- **WHEN** 浏览器加载已完成本 change 的 React 应用
- **THEN** 未认证用户进入登录入口
- **AND** 已认证用户进入私有研究工作区
- **AND** 页面不得再声称 Serenity 业务尚未实现

### Requirement: Secret 仓库扫描
项目 MUST 保留可重复执行的仓库 Secret 扫描并排除依赖、Git 元数据和普通构建噪声；本 change 还 MUST 提供独立的构建产物与运行证据 Secret 扫描，使仓库扫描和 bundle/API/日志/错误页/快照扫描的边界可分别证明。

#### Scenario: 仓库不含已知 Secret 形式
- **WHEN** 执行 `pnpm audit:secrets`
- **THEN** 命令扫描源码与版本控制交付范围并输出 `secret-audit-ok`
- **AND** 命令以退出码 0 结束

#### Scenario: 构建产物和运行证据不含 Secret
- **WHEN** 执行本 change 定义的产物 Secret 扫描
- **THEN** 前端 bundle、API 响应、日志、错误页和测试快照中的 canary 搜索为零命中
- **AND** 扫描不把合法本站 HttpOnly 会话 Cookie 的存在误判为第三方/金融 Cookie 泄露

#### Scenario: 扫描范围出现已知 Secret 形式
- **WHEN** 任一对应扫描范围出现 Bearer Token、飞书机器人 Webhook、第三方/金融 Cookie、管理员凭据、可复用会话 Token 或带值 API Secret
- **THEN** 命令列出脱敏命中位置并以非零退出码结束
