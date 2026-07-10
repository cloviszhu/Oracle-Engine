# project-foundation 规格说明

## Purpose

定义当前已实现的工程基础能力，使后续业务 change 可以在可安装、可测试、可构建且不泄露 Secret 的基线上开发。

## Requirements

### Requirement: 服务健康检查

NestJS 服务 MUST 通过 `HealthController.getHealth()` 提供稳定的服务状态响应。

#### Scenario: 查询服务健康状态

- **WHEN** 客户端请求 `GET /api/health`
- **THEN** 系统返回 `status` 为 `ok` 的响应
- **AND** `service` 固定为 `serenity-intelligence-monitor`

### Requirement: 初始化页面

React 应用 MUST 明确展示当前项目只完成工程初始化，避免把未实现的业务能力呈现为可用。

#### Scenario: 打开私有网站根页面

- **WHEN** 浏览器加载 React 应用
- **THEN** 页面展示“Serenity 海外产业信息监控”
- **AND** 页面展示“工程初始化完成”
- **AND** 页面说明业务功能将在 OpenSpec change 中定义和实现

### Requirement: 基础设施配置失败可见

数据库和队列配置 MUST 拒绝缺失或空白的服务端连接地址，禁止静默使用生产兜底值。

#### Scenario: 数据库连接地址缺失

- **WHEN** `readDatabaseUrl()` 在 `DATABASE_URL` 缺失或为空时执行
- **THEN** 函数抛出 `DATABASE_URL is required` 错误

#### Scenario: Redis 连接地址缺失

- **WHEN** `readRedisUrl()` 在 `REDIS_URL` 缺失或为空时执行
- **THEN** 函数抛出 `REDIS_URL is required` 错误

### Requirement: Secret 仓库扫描

项目 MUST 提供可重复执行的 Secret 扫描命令，并排除依赖、构建产物、Git 元数据和本地 worktree。

#### Scenario: 仓库不含已知 Secret 形式

- **WHEN** 执行 `pnpm audit:secrets`
- **THEN** 命令输出 `secret-audit-ok`
- **AND** 命令以退出码 0 结束

#### Scenario: 文件包含已知 Secret 形式

- **WHEN** 扫描范围内出现 Bearer Token、飞书机器人 Webhook 或带值的 API Secret
- **THEN** 命令列出命中文件并以非零退出码结束

### Requirement: 生产构建和静态交付

项目 MUST 使用同一构建命令生成浏览器资源和 NestJS 服务端产物，`AppModule` 通过 `ServeStaticModule` 提供浏览器资源。

#### Scenario: 执行生产构建

- **WHEN** 执行 `pnpm build`
- **THEN** Vite 将浏览器资源写入 `dist/public`
- **AND** NestJS 编译将服务端入口写入 `dist/server`

#### Scenario: 启动生产服务

- **WHEN** 执行 `pnpm start`
- **THEN** Node.js 运行 `dist/server/main.js`
- **AND** `AppModule` 从 `dist/public` 提供静态资源

### Requirement: 数据模型初始化边界

初始化基线 MUST 保持 `drizzle/schema.ts` 不包含业务表，直到已批准的业务 change 定义数据模型。

#### Scenario: 检查初始化 schema

- **WHEN** 读取 `drizzle/schema.ts`
- **THEN** `schema` 为空对象
- **AND** 文件说明业务表由 `build-serenity-intelligence-monitor` change 定义
