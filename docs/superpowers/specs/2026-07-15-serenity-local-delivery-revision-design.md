# Serenity 家庭本地版交付修订设计

日期：2026-07-15  
关联 change：`build-serenity-intelligence-monitor`  
状态：设计已获口头确认，等待书面规格复核

## 1. 修订目标

当前实现具备研究流水线和私有网页，但仍要求开发者编辑 `.env`、生成密码摘要并执行多条命令。该方式不能作为家庭用户的最终交付路径。

本修订在保留 React、NestJS、MySQL、Redis、BullMQ 和 Docker 主体架构的前提下，增加自包含 Windows 启动器、GUI 首次设置向导和安全配置能力。家庭管理员通过图形界面完成配置和服务管理；父亲与家庭用户继续把私有网页作为主要入口。

Harness 保持在 `user_accept`。修订完成前不得完成该步骤，也不得归档 change。

## 2. 范围裁决

### 2.1 当前目标必要的易用性修复

- 提供无需预装 Node 的 Electron Windows `.exe`。
- 在数据库尚未启动时提供独立设置向导。
- 检查 Docker Desktop、Compose、虚拟化、端口、磁盘空间和目录权限，并给出可操作的中文说明。
- 通过 GUI 设置两个家庭账号、外部服务和运行预算。
- 启动、停止和检查 MySQL、Redis、API 与 worker。
- 提供打开私有网页、修改设置、备份和查看脱敏诊断信息的入口。
- 正常使用不要求打开终端或手工编辑 `.env`。
- 使用 Windows 用户级加密保存 Secret；保存后不向 renderer 或网页返回原值。

### 2.2 当前 change 内的需求变更

- AI 从固定 `openai/gpt-5.6-terra` 改为可配置的 OpenAI-compatible 协议适配器和 capability probe。
- `gpt-5.6-terra` 保留为推荐预设，不再作为生产启动的唯一合法模型。
- X 从核心启动必填改为默认关闭、可稍后配置；关闭时系统必须明确显示“尚未真实同步”。
- 家庭账号和外部服务配置从手工环境变量迁移到本地 GUI 配置快照。
- 正常家庭运行方式改为由启动器管理本地依赖和后台进程。

### 2.3 延期到第二阶段

以下需求必须保留在当前 OpenSpec 工件的“后续 change”章节，但本轮不得创建、实现或部署：

- 通过 Sites 部署 Serenity 主网页。
- 电脑关机后继续同步、分析和访问。
- 云端 API、worker、MySQL 和 Redis。
- 云端 KMS 信封加密。
- 远程 HTTPS、安全访问、云端备份和云厂商选择。

第二阶段不得反向削弱本地版的适配器边界。当前实现不增加 `.openai/hosting.json`，不调用 Sites 发布接口，也不选择 Azure、AWS 或 Google Cloud。

## 3. 架构

### 3.1 组件

| 组件 | 职责 | 依赖 |
| --- | --- | --- |
| Electron main | bootstrap、配置库、环境检查、服务编排、备份、诊断 | Windows、可选 Docker Desktop |
| Electron preload | 暴露按操作划分的窄 IPC | Electron main |
| Electron renderer | 设置向导和启动器管理界面 | preload API |
| MySQL 容器 | 业务事实、审计和状态 | Docker Desktop |
| Redis 容器 | BullMQ 和服务端会话 | Docker Desktop |
| API 后台进程 | NestJS API 和私有网页 | MySQL、Redis、运行配置快照 |
| worker 后台进程 | 获取、分析、评分和可选通知 | MySQL、Redis、运行配置快照 |
| 系统浏览器 | 家庭用户的主要使用入口 | 本机 API |

### 3.2 正常家庭运行方式

启动器包内包含编译后的 API、worker 和前端产物。它使用 Electron `utilityProcess` 启动受控 Node 后台进程，因此目标电脑不需要安装 Node。

MySQL 和 Redis 继续由 Docker Compose 管理。Compose 只发布绑定到回环地址的随机或已验证可用端口，不向局域网和公网开放。启动器不关闭整个 Docker Desktop，只停止 Serenity 自己的 Compose project。

API 和 worker 不从磁盘 `.env` 读取 Secret。Electron main 解密配置后，通过私有进程 IPC 传递一次性运行配置快照。Secret 不进入命令行参数、Docker inspect、普通环境文件或日志。

第一版网页只供同一台 Windows 电脑访问。跨设备或公网访问属于第二阶段远程部署范围。

### 3.3 生命周期

启动顺序固定为：

1. 检查本地目录和端口。
2. 检查并等待 Docker engine。
3. 启动 Serenity MySQL 和 Redis。
4. 等待两项健康检查。
5. 自动执行幂等 migration。
6. 启动 API。
7. 等待 API 健康检查。
8. 启动 worker 并等待 heartbeat。
9. 打开私有网页。

停止顺序固定为：

1. 停止接收新的 worker 任务。
2. 等待当前任务进入可恢复边界并停止 worker。
3. 停止 API。
4. 停止 Serenity MySQL 和 Redis 容器。

关闭启动器窗口时，程序缩入托盘并继续管理服务。用户明确选择“停止 Serenity 并退出”时才执行完整停止流程。

## 4. 首次设置向导

### 4.1 环境检查

向导检查 Windows 版本、Docker Desktop、Docker engine、Compose、虚拟化状态、目录权限、磁盘空间和所需端口。

缺少 Docker 时，启动器仍能运行并显示：缺少的组件、该组件的用途、官方安装入口、安装后的复查按钮。第一版不静默安装 Docker，也不要求用户打开终端。

### 4.2 家庭账号

管理员设置两个不同的用户名和密码。renderer 只在当前输入控件内保存明文。Electron main 使用随机盐和现有 `scrypt` 契约生成摘要，然后立即丢弃明文引用；系统不声称 JavaScript 运行时能可靠覆写不可变字符串的内存。

两个账号权限相同，无公开注册、角色系统或找回密码流程。修改任一密码后，系统撤销该账号的现有会话。

### 4.3 AI 设置

GUI 提供以下字段：

- provider preset；
- 协议类型；
- base URL；
- API Key；
- model；
- reasoning；
- 输入价格；
- 输出价格；
- 单次预算；
- 每日预算。

第一版支持两个明确协议：OpenAI Responses-compatible 和 OpenAI Chat Completions-compatible。OpenAI 官方预设默认填写 Responses API、官方 base URL 和 `gpt-5.6-terra`，但用户可以修改。

自定义 base URL 不得包含用户名、密码、query 或 fragment。非回环地址必须使用 HTTPS。

### 4.4 X 设置

X 默认关闭。用户可以保持未配置并完成向导。此时系统不得创建真实同步任务，网页和启动器必须显示“X 未配置，尚未进行真实同步”。

启用 X 需要 Token、政策确认开关和连接测试。系统只使用官方服务端 API，不增加 Cookie、模拟登录或客户端抓取路径。

### 4.5 飞书设置

飞书默认跳过。启用时 Webhook 和签名密钥必须成对填写。测试请求必须生成平台安全签名，并区分确认失败、结果未知和成功。

飞书未配置时，不创建 delivery、队列任务或失败积压；归档、AI 分析、搜索和查看继续运行。

### 4.6 完成检查

完成页逐项显示数据库、Redis、AI、X 和飞书的“成功、跳过、失败”。X 和飞书可以跳过；AI 可以保存为未启用，但启用前必须通过 capability probe。

完成后显示“一键启动并打开 Serenity”。失败项必须提供脱敏、可操作的中文说明。

## 5. Secret 安全

### 5.1 存储

Electron main 使用异步 `safeStorage`。Windows 上由 DPAPI 保护密钥。配置库位于 `%LOCALAPPDATA%\Serenity`，目录 ACL 限制为当前 Windows 用户。

配置拆为两部分：

- 非敏感元数据：schema version、配置状态、更新时间和功能开关；
- 加密 vault：API Key、X Token、飞书 Webhook、飞书签名密钥、会话 Secret、数据库密码和其他可复用凭据。

密码摘要不是可回显配置。启动器只返回账号是否已设置。

### 5.2 renderer 边界

生产窗口必须启用 `contextIsolation`、sandbox 和严格 CSP，关闭 Node integration。preload 为每项动作暴露独立方法，不暴露通用 `ipcRenderer`、文件系统、shell 或进程执行接口。

Secret 输入使用密码控件，不进入 `localStorage`、`sessionStorage`、IndexedDB、URL、路由状态、剪贴板、错误对象或持久化表单缓存。提交完成后 renderer 清空字段。

保存、读取和诊断 API 只返回 `configured`、更新时间和允许的脱敏标识，不返回 Secret 原值。

### 5.3 日志和错误

日志允许记录错误分类、服务名、HTTP 状态码、本地 request ID 和 provider request ID。日志禁止记录 Authorization、请求头、请求体、外部响应正文、配置快照和完整 URL query。

外部错误先映射为稳定类别，再显示中文说明。原始 provider body 不进入网页、启动器错误详情或持久日志。

### 5.4 威胁边界

DPAPI 可以隔离其他 Windows 用户，但不能阻止已在同一 Windows 用户权限下运行的恶意程序。文档必须明确该边界，不能把用户级加密描述为防御同权限恶意软件。

## 6. AI 适配器和 capability probe

### 6.1 统一接口

业务层只依赖 `ResearchModelAdapter`。适配器注册表按 `providerPreset + protocol` 创建具体实现。业务流水线不得读取供应商 SDK 类型、供应商响应字段或固定模型名。

本轮实现：

- OpenAI Responses-compatible adapter；
- OpenAI Chat Completions-compatible adapter；
- OpenAI 官方 preset；
- 自定义 OpenAI-compatible preset。

本轮不实现原生 Anthropic 或 Gemini 协议。注册表必须允许后续增加相应 adapter，而不修改研究流水线。

### 6.2 probe 门禁

启用 AI 配置前，probe 使用所选协议执行以下检查：

1. base URL 与认证有效。
2. 请求模型能被实际调用。
3. provider 返回的实际模型可审计。
4. 模型接受严格 JSON Schema。
5. 输出通过完整研究卡片 schema、来源引用和必要字段校验。
6. 响应提供本地审计所需的 response ID 和 usage；缺失时明确报告不兼容字段。
7. 错误、限流和超时可以映射为稳定类别。

若 actual model 与 requested model 不同，probe 不得静默通过。GUI 显示两者并要求用户确认已知 alias 映射；无法解释的替换直接阻断。

probe 失败时，用户可以保存该配置为“未启用”，但 worker 不得使用它。系统不得自动换模型、改协议或降低研究卡片契约。

### 6.3 审计和费用

每次分析保存：

- provider preset；
- protocol；
- base URL host；
- requested model；
- actual model；
- local request ID；
- provider request ID；
- 输入、输出和总 token usage；
- 输入、输出价格及价格版本；
- 计算费用；
- prompt version；
- schema version；
- capability probe version 和最近通过时间。

价格由用户配置。系统不把模型名称当作价格来源，也不猜测第三方 endpoint 的费用。

### 6.4 兼容性承诺

“OpenAI-compatible”只表示实现了选定协议的必要子集。不同供应商的认证、端点、结构化输出、限流、usage、request ID 和费用语义不同，因此系统不能承诺任意模型零适配。只有通过 probe 和完整研究卡片契约的配置才能启用。

## 7. 备份和诊断

启动器创建一致性 MySQL 备份、非敏感配置清单、版本信息和 DPAPI 密文副本。Redis 不是长期事实来源，默认不把活动会话和队列快照作为可移植恢复依据；恢复后由数据库状态重建可续办任务。

DPAPI 密文只能由原 Windows 用户解密。迁移到其他电脑或 Windows 用户时，恢复非敏感配置和数据库后必须重新输入 Secret。

诊断包包含版本、健康状态、端口、容器状态、最近脱敏错误类别和日志片段。生成诊断包前执行 canary Secret 扫描；发现命中时拒绝导出。

## 8. 错误处理

启动器对用户展示以下稳定类别：

- 环境缺失；
- 权限不足；
- 端口占用；
- Docker 未运行；
- 数据库或 Redis 不健康；
- migration 失败；
- API 或 worker 启动失败；
- 外部服务未配置；
- 认证失败；
- 模型不存在；
- 结构化输出不兼容；
- 限流；
- 预算阻断；
- provider 暂时不可用；
- 通知结果未知。

每类错误必须给出下一步操作。可重试错误提供重试按钮；配置错误跳转到对应设置页；不可自动恢复的错误不显示“健康”。

## 9. 验收设计

### 9.1 自动化测试

- 使用全新 Windows user-data 目录启动打包应用，仅通过 GUI 完成配置。
- 在 Docker 缺失时显示中文处理步骤，启动器保持可用。
- 验证 renderer storage、URL、IPC 返回、日志、错误页、bundle、快照和 Git 中 Secret canary 零命中。
- 验证保存后所有读取接口不返回原值。
- 验证两个家庭密码只形成带随机盐的 `scrypt` 摘要。
- 验证自定义 base URL 和模型名可保存、测试和重新编辑。
- 验证 Responses-compatible 与 Chat Completions-compatible mock endpoint。
- 验证满足研究卡片契约的模型通过 probe 并生成卡片。
- 验证缺 schema、必要字段、usage 或 response ID 的模型被明确阻断。
- 验证 `gpt-5.6-terra` 推荐 preset 的回归契约。
- 验证 X 未配置时零真实请求并显示未真实同步。
- 验证飞书未配置时网页核心功能正常；启用时签名固定向量正确。
- 验证启动、停止、健康检查、迁移、worker heartbeat 和打开网页。
- 验证备份、恢复和脱敏诊断包。

### 9.2 真实环境证据

Mock 不能证明 Docker Desktop、真实 AI、真实 X 或真实飞书。`test_verify` 必须分别记录：

- 自动化已验证；
- Mock 已验证；
- 真实 API 已验证；
- 待用户或目标环境验证。

当前开发机没有 Docker。实现完成后，真实 Docker 生命周期验收必须在安装 Docker Desktop 的 Windows 目标环境执行；未执行前不得把该项标记为通过。

### 9.3 完整验证命令

实现完成后至少运行 `pnpm check`、`pnpm test`、`pnpm lint`、`pnpm build` 和 `pnpm audit:secrets`，并增加 Electron 打包、启动器端到端测试和安装产物 Secret 扫描。

独立代码复核和 Harness `test_verify` 必须在返回 `user_accept` 前完成。完成后仍不得自动归档。

## 10. OpenSpec 修订顺序

书面设计确认后按以下顺序修改当前 change：

1. `proposal.md`：追加用户验收原话和三类范围裁决，替换固定模型与开发者配置假设。
2. `design.md`：纳入启动器、配置库、进程 IPC、生命周期和 AI registry/probe。
3. delta specs：增加 launcher/bootstrap capability，并修改 AI、X、Secret、网页和运维要求。
4. `test-checklist.md`：增加 GUI 首启、Secret、AI 兼容性和生命周期验收。
5. `tasks.md`：新增实施分组，不重做已经正确实现且未受影响的功能。
6. 重新执行严格校验、规格审查和 debate。
7. 用户确认修订任务后才进入实现。

Harness 在以上过程持续停留于 `user_accept`；不得调用 `complete user_accept`。
