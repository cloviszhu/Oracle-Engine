# Windows + Docker 目标环境验证清单

状态：待执行（当前开发机无 Docker CLI，禁止用 fake controller 冒充）

## 前置条件

- Windows 10/11 当前用户，已安装并启动 Docker Desktop 与 Compose
- 使用全新 `%LOCALAPPDATA%\Serenity` 测试目录
- 仅使用测试账号和经授权的外部凭据；不得记录任何 Secret

## 必测路径

1. 启动 `Serenity-0.1.0-x64.exe`，确认无需 Node、终端和 `.env`。
2. 完成环境检查；确认 Docker、虚拟化、端口、磁盘和目录权限均有稳定中文结果。
3. 配置两个不同家庭账号；验证同密码摘要不同、读取设置不回显密码或摘要。
4. 分别验证 AI 跳过、官方 preset probe、自定义 Responses-compatible 和 Chat Completions-compatible probe；确认失败不 fallback。
5. 验证 X/飞书跳过时零真实请求、零任务、零 delivery；如启用，只使用授权测试目标并保存真实 request ID 证据。
6. 启动 Serenity，依次确认 MySQL/Redis 健康、migration 幂等、API 健康、worker heartbeat 和 `127.0.0.1` 私有网页。
7. 重复启动/停止；确认窗口关闭仅缩入托盘，“停止并退出”才停止 Serenity 自有进程和 `serenity-local` 容器，其他容器不受影响。
8. 创建备份并在隔离测试目录恢复 MySQL 与非敏感设置；确认 Redis 不作为恢复来源，跨用户恢复要求重输 Secret。
9. 导出诊断，执行 canary 扫描；确认无 Token、Webhook、密码摘要、provider body、Cookie 或错误栈。
10. 完成两个家庭账号现场操作和爸爸中文理解验收。

## 证据分类

- 自动化/Mock：只能证明契约和失败关闭。
- Windows 打包冒烟：只能证明产物可启动。
- 真实 Docker：必须记录本清单第 6～8 项的日期、版本与脱敏结果。
- 真实外部 API：必须记录授权范围、request ID 与脱敏 usage，不记录凭据。
- 人工验收：由实际家庭用户确认，不能由自动化替代。
