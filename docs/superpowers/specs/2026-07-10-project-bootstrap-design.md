# Serenity 海外产业信息监控系统：项目初始化设计

## 目标

在不实现 Serenity 业务功能的前提下，把空工作区初始化为可运行、可测试、可构建、可进入 Harness Spec/OpenSpec 流程的全栈 TypeScript 项目。

## 参考项目结论

初始化参考以下两个本地项目，但不复制其业务代码、密钥或运行数据：

- `UVoice`：复用 NestJS 模块化后端、Drizzle、MySQL、BullMQ/Redis、健康检查、环境变量边界和 pnpm 约定。
- `uxAiLobster`：复用 React/Vite 前后端分层、Vitest、类型检查、构建脚本、状态文档和项目地图约定。

两个参考仓库都有未提交或本地专属状态；初始化只读取结构和配置，不修改参考仓库。

## 方案比较

### 方案一：复制 UVoice 项目

优点是 NestJS、队列和数据库基础设施较贴近监控系统。缺点是前端与后端目录耦合较深，README 仍是模板，测试脚本不足，并且包含与当前业务无关的认证和访谈代码。

### 方案二：复制 uxAiLobster 项目

优点是前后端边界、测试、构建和文档体系完整。缺点是项目规模大、依赖多，现有领域模型和自定义 harness 会把大量无关复杂度带入新项目。

### 方案三：轻量混合基线（采用）

只提取两个项目中已经验证的工程模式，建立最小全栈骨架。该方案保留清晰边界，又不复制任何参考项目业务实现。

## 初始化范围

### 技术基线

- Node.js 20+，项目固定使用 `pnpm@10.4.1`。
- TypeScript 5.x。
- 后端：NestJS 11，提供应用启动和健康检查。
- 前端：React 19 + Vite，提供最小私有站点占位页。
- 数据访问：Drizzle ORM + MySQL 8。
- 后台任务：BullMQ + Redis，仅建立依赖与适配器目录，不实现抓取任务。
- 验证：Vitest、TypeScript 类型检查、ESLint 和生产构建。

### 目录边界

```text
client/                 React/Vite 前端
server/                 NestJS 后端与健康检查
shared/                 前后端共享类型
drizzle/                数据库 schema 占位与配置
docs/                   状态、项目地图和设计文档
openspec/               OpenSpec 配置、主规格和 changes 目录
```

### 工程文件

初始化包括：

- `package.json`、锁文件、TypeScript/Vite/Vitest/ESLint 配置；
- `.gitignore`、`.env.example`，不创建含真实凭据的 `.env`；
- `Dockerfile` 和 `docker-compose.yml`，用于应用、MySQL 和 Redis；
- `AGENTS.md`、`README.md`、`docs/STATUS.md`、`docs/PROJECT_MAP.md`；
- 最小后端健康检查、最小前端入口及对应测试；
- OpenSpec 初始化目录和项目上下文，但不创建业务 change；
- Git 基线提交。

## 明确不做

- 不实现 X API、上下文补全、AI 分析、重要性评分、飞书推送或用户反馈。
- 不决定最终认证、AI 供应商、部署平台或外部 API 预算。
- 不复制两个参考项目的业务代码、`.env`、数据库数据、构建产物或 `node_modules`。
- 不创建 `build-serenity-intelligence-monitor` change；该 change 由下一会话通过 `harness-spec` 创建。

## 安全边界

- 所有 Secret 只通过服务端环境变量读取。
- 示例配置只使用占位符，不记录真实 Token、Webhook 或 Cookie。
- 初始代码不连接券商、交易系统、金融电脑或个人账号。
- 外部文本在后续设计中一律按不可信输入处理。

## 验证标准

初始化通过必须同时满足：

1. Git 仓库存在，工作树状态可解释。
2. `pnpm install --frozen-lockfile` 成功。
3. 类型检查、单元测试、Lint 和生产构建成功。
4. OpenSpec CLI 能识别项目，`openspec/changes/archive` 存在。
5. Harness CLI 可对建议 change 路径执行初始化前检查；不得存在伪造的进行中 change。
6. `.env`、Token 和 Webhook 未进入 Git。
7. 项目文档明确下一步由 `harness-spec` 场景 A 创建 `build-serenity-intelligence-monitor`。

## 后续流程

初始化和复审通过后，新会话先读取 `AGENTS.md`、`README.md`、`docs/STATUS.md`、`docs/PROJECT_MAP.md` 和 OpenSpec 配置，再运行 `git status`、检查 OpenSpec/Harness 状态。随后以 `harness-spec` 为唯一主控，创建并推进 `build-serenity-intelligence-monitor`。
