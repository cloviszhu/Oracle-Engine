# Serenity Project Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把空目录初始化为可安装、可测试、可构建并可进入 Harness Spec/OpenSpec 的最小全栈 TypeScript 项目。

**Architecture:** 使用单仓库、单 `package.json` 管理 React/Vite 前端和 NestJS 后端。后端在生产模式提供 Vite 构建产物，并为后续 X API、AI、队列和通知适配器保留清晰目录边界；本计划不实现这些业务能力。

**Tech Stack:** Node.js 20+、pnpm 10.4.1、TypeScript 5.9、NestJS 11、React 19、Vite 7、Vitest 2、Drizzle ORM、MySQL 8、BullMQ、Redis、OpenSpec 1.3.1。

## Global Constraints

- 不复制 `UVoice` 或 `uxAiLobster` 的业务代码、`.env`、数据库数据、构建产物或 `node_modules`。
- 不实现 X API、AI 分析、重要性评分、飞书推送、认证或投资相关功能。
- Secret 只允许出现在服务端环境变量中；Git 只保存空值或安全示例。
- OpenSpec 工件使用简体中文，机器标识符保留英文。
- 下一业务 change 固定为 `build-serenity-intelligence-monitor`，由新会话通过 `harness-spec` 场景 A 创建。
- 每个任务独立提交；提交中不得混入无关文件。

---

### Task 1: 工具链和项目配置

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `nest-cli.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `eslint.config.mjs`
- Create: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Consumes: Node.js 20+ 和 pnpm 10.4.1。
- Produces: `pnpm dev`、`pnpm build`、`pnpm check`、`pnpm test`、`pnpm lint`、`pnpm audit:secrets`。

- [ ] **Step 1: 创建 package.json**

定义单包工作区，脚本使用 `concurrently` 启动 Vite 与 NestJS；生产构建先生成 `dist/public`，再生成 `dist/server/main.js`。依赖版本以两个参考项目已验证版本为基线。

- [ ] **Step 2: 创建 TypeScript、NestJS、Vite、Vitest 和 ESLint 配置**

客户端配置使用 `moduleResolution: Bundler` 和 `jsx: react-jsx`；服务端配置使用装饰器元数据和 `outDir: dist/server`。Vitest 扫描 `client/**/*.test.tsx` 与 `server/**/*.test.ts`。

- [ ] **Step 3: 创建安全的忽略规则和环境变量样例**

`.gitignore` 必须覆盖 `.env`、`node_modules`、`dist`、覆盖率、日志和本地数据库文件。`.env.example` 只声明 `PORT`、`DATABASE_URL`、`REDIS_URL`、`SESSION_SECRET`、`X_API_BEARER_TOKEN`、`AI_API_KEY`、`FEISHU_WEBHOOK_URL`，其中 Secret 使用空值。

- [ ] **Step 4: 验证 JSON 和配置可解析**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package-json-ok')"`

Expected: 输出 `package-json-ok`。

- [ ] **Step 5: 提交工具链配置**

```bash
git add package.json tsconfig.json tsconfig.server.json nest-cli.json vite.config.ts vitest.config.ts eslint.config.mjs .gitignore .env.example
git commit -m "chore: initialize TypeScript toolchain"
```

### Task 2: 后端应用和健康检查

**Files:**
- Create: `server/main.ts`
- Create: `server/app.module.ts`
- Create: `server/health/health.controller.ts`
- Create: `server/health/health.controller.test.ts`

**Interfaces:**
- Consumes: `dist/public` 静态目录和环境变量 `PORT`。
- Produces: `GET /api/health -> { status: "ok", service: "serenity-intelligence-monitor" }`。

- [ ] **Step 1: 编写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the stable service health payload', () => {
    expect(new HealthController().getHealth()).toEqual({
      status: 'ok',
      service: 'serenity-intelligence-monitor',
    });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run server/health/health.controller.test.ts`

Expected: FAIL，因为 `health.controller.ts` 尚不存在。

- [ ] **Step 3: 实现最小健康检查和 NestJS 启动入口**

`HealthController` 使用 `@Controller('api/health')` 和 `@Get()`；`AppModule` 注册 `ServeStaticModule` 和该 Controller；`main.ts` 从 `PORT` 读取端口并默认监听 `3000`。

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm exec vitest run server/health/health.controller.test.ts`

Expected: 1 test passed。

- [ ] **Step 5: 提交后端骨架**

```bash
git add server
git commit -m "feat: add backend health shell"
```

### Task 3: 前端占位页

**Files:**
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/App.test.tsx`
- Create: `client/src/styles.css`
- Create: `client/src/vite-env.d.ts`
- Create: `shared/system.ts`

**Interfaces:**
- Consumes: `SYSTEM_NAME` 常量。
- Produces: 仅说明项目已完成工程初始化的静态页面，不展示虚构业务数据。

- [ ] **Step 1: 编写失败测试**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  it('labels the site as an initialized research system', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Serenity 海外产业信息监控');
    expect(html).toContain('工程初始化完成');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run client/src/App.test.tsx`

Expected: FAIL，因为 `App.tsx` 尚不存在。

- [ ] **Step 3: 实现最小页面和入口**

页面只包含系统名称、初始化状态以及“业务功能将在 OpenSpec change 中定义”的说明。样式使用本地 CSS，不引入组件库。

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm exec vitest run client/src/App.test.tsx`

Expected: 1 test passed。

- [ ] **Step 5: 提交前端骨架**

```bash
git add client shared
git commit -m "feat: add frontend initialization shell"
```

### Task 4: 数据、队列、容器和项目文档边界

**Files:**
- Create: `drizzle/schema.ts`
- Create: `drizzle.config.ts`
- Create: `server/infrastructure/database/database.config.ts`
- Create: `server/infrastructure/queue/queue.config.ts`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `docs/STATUS.md`
- Create: `docs/PROJECT_MAP.md`

**Interfaces:**
- Consumes: `DATABASE_URL` 和 `REDIS_URL`。
- Produces: 只读配置解析函数、MySQL/Redis 本地容器和新会话文档入口。

- [ ] **Step 1: 编写配置失败测试**

创建 `server/infrastructure/config.test.ts`，断言数据库和队列配置在环境变量缺失时抛出明确错误，在变量存在时返回 URL；测试必须恢复进程环境。

- [ ] **Step 2: 运行配置测试并确认失败**

Run: `pnpm exec vitest run server/infrastructure/config.test.ts`

Expected: FAIL，因为配置模块尚不存在。

- [ ] **Step 3: 实现配置边界和空 Drizzle schema**

两个配置模块只读取服务端环境变量并返回字符串，不建立真实连接。`drizzle/schema.ts` 明确说明业务表由后续 change 定义，不创建猜测的数据模型。

- [ ] **Step 4: 创建容器和文档**

Docker Compose 使用 MySQL 8.4 和 Redis 7，并通过环境变量为应用传递连接地址。README 和状态文档明确当前只有工程骨架、没有业务能力。

- [ ] **Step 5: 运行配置测试并确认通过**

Run: `pnpm exec vitest run server/infrastructure/config.test.ts`

Expected: 配置测试全部通过。

- [ ] **Step 6: 提交基础设施边界**

```bash
git add drizzle drizzle.config.ts server/infrastructure Dockerfile docker-compose.yml README.md AGENTS.md docs/STATUS.md docs/PROJECT_MAP.md
git commit -m "chore: add infrastructure and project boundaries"
```

### Task 5: OpenSpec 初始化和完整复审

**Files:**
- Create: `openspec/config.yaml`（由 OpenSpec CLI 生成或补全）
- Create: `openspec/specs/project-foundation/spec.md`
- Create: `openspec/README.md`
- Create: `openspec/changes/archive/.gitkeep`
- Modify: `docs/STATUS.md`

**Interfaces:**
- Consumes: 已通过测试和构建的工程骨架。
- Produces: 可由 `harness-spec` 创建 `openspec/changes/build-serenity-intelligence-monitor` 的项目状态。

- [ ] **Step 1: 安装并锁定依赖**

Run: `pnpm install`

Expected: 生成 `pnpm-lock.yaml`，安装退出码为 0。

- [ ] **Step 2: 初始化 OpenSpec**

Run: `openspec init . --tools codex`

Expected: 创建 `openspec/` 和 Codex 集成文件，不创建业务 change。

- [ ] **Step 3: 按 openspec-init 规则补全基础规格**

`config.yaml` 首行使用 `schema: spec-driven`。`project-foundation/spec.md` 只覆盖健康检查、构建验证、Secret 边界和 Harness 入口，不描述未实现业务。

- [ ] **Step 4: 运行完整验证**

Run in order:

```bash
pnpm check
pnpm test
pnpm lint
pnpm build
pnpm audit:secrets
openspec list
openspec validate --specs
git diff --check
```

Expected: 所有命令退出码为 0；测试至少包含后端、前端和配置三组；OpenSpec 没有活动 change。

- [ ] **Step 5: 更新状态并提交初始化基线**

`docs/STATUS.md` 记录真实命令结果、未验证的外部依赖和下一步 change-id。

```bash
git add pnpm-lock.yaml openspec .codex docs/STATUS.md
git commit -m "chore: initialize OpenSpec project baseline"
```

- [ ] **Step 6: 复跑启动审计**

Run: `git status --short --branch`、`openspec list`、Harness CLI `status openspec/changes/build-serenity-intelligence-monitor`。

Expected: Git 工作树干净；OpenSpec 已初始化且没有活动 change；Harness 对尚未创建的 change 返回明确的未初始化状态，而不是项目目录错误。
