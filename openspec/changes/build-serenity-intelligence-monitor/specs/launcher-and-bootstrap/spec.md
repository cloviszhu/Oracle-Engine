## ADDED Requirements

### Requirement: 家庭本地版必须提供自包含 Windows 启动器
系统 MUST 提供无需预装 Node 的 Electron Windows `.exe`，并 MUST 在数据库和后台服务未启动时独立显示 GUI 首次设置向导；普通家庭使用 MUST NOT 要求终端或手工编辑 `.env`。

#### Scenario: 全新 Windows 用户首次启动
- **WHEN** 用户在全新 user-data 目录运行打包应用且数据库尚未启动
- **THEN** 启动器显示中文首次设置向导并允许完成环境检查与配置
- **AND** 目标电脑无需安装 Node，用户无需执行命令或编辑 `.env`

#### Scenario: 关闭启动器窗口
- **WHEN** Serenity 服务正在运行且用户关闭主窗口
- **THEN** 启动器缩入系统托盘并继续管理服务
- **AND** 只有用户明确选择“停止 Serenity 并退出”才执行完整停止流程

### Requirement: 启动器必须提供可操作的中文环境检查
系统 MUST 检查 Windows 版本、Docker Desktop、Docker engine、Compose、虚拟化、所需端口、磁盘空间和目录权限，并 MUST 为失败项提供用途说明、官方安装入口和复查动作。

#### Scenario: Docker Desktop 缺失
- **WHEN** 环境检查未发现 Docker Desktop 或 Compose
- **THEN** GUI 保持可用并显示缺失组件、用途、官方安装入口和“重新检查”
- **AND** 启动器不得静默安装、要求终端或把依赖状态显示为健康

#### Scenario: 端口或目录不可用
- **WHEN** 回环端口被占用、空间不足或配置目录不可写
- **THEN** 启动器返回稳定中文错误类别和下一步操作
- **AND** 未解决前不得启动依赖该资源的后续服务

### Requirement: Secret 必须由 Electron main 的 DPAPI vault 管理
系统 MUST 使用 Electron `safeStorage`/Windows DPAPI 在 `%LOCALAPPDATA%\Serenity` 保存 Secret，MUST 将非敏感元数据与加密 vault 分离，并 MUST 通过当前用户 ACL 保护目录。系统 MUST NOT 把 Secret 写入 renderer 持久化、URL、日志、错误详情、Git、命令行参数、普通环境文件或 Docker inspect。

#### Scenario: 保存外部服务 Secret
- **WHEN** renderer 通过窄 IPC 提交 API Key、X Token、飞书凭据或数据库密码
- **THEN** Electron main 加密保存并只返回 `configured=true` 与允许的脱敏元数据
- **AND** renderer 清空输入，后续读取不返回原值

#### Scenario: DPAPI 或 ACL 设置失败
- **WHEN** `safeStorage` 不可用、加密失败或配置目录 ACL 无法限制为当前用户
- **THEN** 保存失败并显示脱敏中文说明
- **AND** 系统不得回退为明文文件或普通环境变量

#### Scenario: 同权限恶意程序威胁
- **WHEN** 用户查看安全说明或备份恢复边界
- **THEN** 文档明确 DPAPI 只能隔离其他 Windows 用户
- **AND** 不宣称能够抵御同一 Windows 用户权限下的恶意程序

### Requirement: preload 必须只暴露窄 IPC
生产窗口 MUST 启用 `contextIsolation`、sandbox 和严格 CSP，MUST 关闭 Node integration；preload MUST 仅按具体操作暴露类型化方法，MUST NOT 暴露通用 `ipcRenderer`、文件系统、shell 或进程执行能力。

#### Scenario: renderer 查询配置状态
- **WHEN** renderer 调用设置状态、健康、备份或诊断接口
- **THEN** 返回值只包含状态、时间、稳定错误类别和脱敏标识
- **AND** 不包含 Secret、完整配置快照、原始 provider body 或内部错误栈

### Requirement: 启动器必须只管理 Serenity 自己的本地服务
系统 MUST 使用固定 Serenity Compose project 管理 MySQL/Redis，并 MUST 使用 Electron `utilityProcess` 管理打包内 API/worker；Compose 端口 MUST 仅绑定 `127.0.0.1`。系统 MUST NOT 停止 Docker Desktop、其他 Compose project 或其他容器。

#### Scenario: 一键启动并打开网页
- **WHEN** 环境与配置通过门禁且用户选择启动
- **THEN** 系统依次完成目录/端口检查、Docker、MySQL/Redis 健康、幂等 migration、API 健康、worker heartbeat 和打开本机网页
- **AND** 任一步失败时停止后续步骤并保留可恢复的脱敏状态

#### Scenario: 停止 Serenity
- **WHEN** 用户明确选择停止
- **THEN** 系统依次停止新 worker 任务、等待可恢复边界、停止 worker、API 和 Serenity 容器
- **AND** Docker Desktop、其他 project 和其他容器继续运行

### Requirement: 启动器必须支持备份和脱敏诊断
系统 MUST 创建 MySQL 一致性备份、非敏感配置清单、版本信息和 DPAPI 密文副本，并 MUST 导出不含 Secret 的诊断包。Redis MUST NOT 被当作长期事实来源。

#### Scenario: 跨电脑或 Windows 用户恢复
- **WHEN** 用户在不同电脑或 Windows 用户下恢复数据库与配置
- **THEN** 系统恢复数据库和非敏感配置并要求重新输入全部 Secret
- **AND** 不把旧 DPAPI 密文描述为可移植凭据

#### Scenario: 诊断包命中 Secret canary
- **WHEN** 导出前扫描在日志、错误或快照中发现 canary
- **THEN** 系统拒绝生成诊断包并报告脱敏失败
- **AND** 命中内容不进入导出文件或 UI 详情
