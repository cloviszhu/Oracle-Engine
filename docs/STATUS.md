# 项目状态

更新时间：2026-07-17

## 当前阶段

`build-serenity-intelligence-monitor` 仍位于 Harness `user_accept` 修订车道。用户已批准 Group 9～14 方案；Group 9～13 已按组提交，Group 14 的可离线实现已在当前工作树完成。不得将本状态解释为最终用户验收或归档完成。

## 已实现

- Electron main/preload/renderer、窄 IPC、严格 CSP、托盘与 Windows portable 打包
- GUI 首次设置和日常管理；普通用户无需 Node、终端或家庭生产 `.env`
- `%LOCALAPPDATA%\Serenity` 非敏感配置与 `safeStorage`/DPAPI vault 分离，ACL 失败时禁止保存
- 两个家庭账号随机盐 scrypt 摘要、改密会话撤销边界、一次性私有运行快照
- 中文环境检查、固定 `serenity-local` Compose、回环 MySQL/Redis、幂等服务顺序和 `utilityProcess` 管理契约
- OpenAI 官方 preset 与自定义 HTTPS preset；Responses/Chat Completions 双协议严格结构化 adapter、capability probe 和完整审计字段
- X/飞书默认关闭；未配置时固定显示“X 未真实同步”“飞书 disabled”，不创建真实请求或通知工作
- MySQL 一致性备份、非敏感配置、版本与 DPAPI 密文副本；Redis 明确不作为可移植事实
- 诊断导出仅包含版本、健康、端口、容器和脱敏日志；Secret canary 命中时拒绝导出

## 已验证

- Group 9～14 相关单元、组件、边界和失败关闭测试通过
- `pnpm check`、`pnpm lint`、`pnpm build:desktop`、`pnpm audit:secrets` 通过
- `release/Serenity-0.1.0-x64.exe` 可生成并通过本机启动冒烟
- OpenSpec strict validate 通过；追溯检查覆盖 26 个 AC、52 个 TC 和 50 个任务，结果 `passed=true`
- 独立代码复核最终结论 `Ready: Yes`，未留 Critical 或 Important 问题
- 2026-07-16 的短暂 Docker Desktop 预检确认真实端口探测会在现有 `mysqld` 占用 `33060` 时自动选择 `33061`；Docker 引擎从未成功启动，该记录不属于容器验收证据

## 待真实验证

- 公司电脑因软件政策不再作为 Docker 验收机，Docker Desktop 按用户要求卸载；真实 MySQL/Redis、migration、API、worker heartbeat、停止/恢复闭环改在允许安装 Docker 的 Windows 机器执行
- 未使用真实 X、AI 或飞书凭据；Mock 证据不代表真实 API
- DPAPI/ACL 已实现并由注入测试验证，仍需在目标 Windows 用户下执行真实保存与跨用户恢复测试
- 备份恢复仍需在目标 Docker 环境完成数据库恢复演练
- 两个家庭账号现场操作与爸爸中文理解验收

## 下一步

当前 feature branch 可作为未完成验收的阶段性快照推送到远端，但不得合并、发布或归档。之后在允许安装 Docker Desktop 的 Windows 目标机执行 `docs/verification/windows-docker-target.md`；补齐真实生命周期证据后重新运行 Harness `test_verify`，再返回 `user_accept`。
