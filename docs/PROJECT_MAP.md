# 项目地图

## 目录职责

| 路径 | 职责 | 当前状态 |
|---|---|---|
| `client/` | React 私有网站 | 初始化页 |
| `server/` | NestJS API 和后台任务入口 | 健康检查 |
| `server/infrastructure/` | 数据库、队列和外部系统边界 | 仅配置读取 |
| `shared/` | 前后端共享类型和常量 | 系统名称 |
| `drizzle/` | MySQL schema 与迁移 | 无业务表 |
| `openspec/` | SDD 规格和 change | 待初始化 |
| `docs/` | 状态、地图、设计和执行计划 | 已建立 |

## 变更指引

- 新 API：`server/<capability>/`
- 外部服务适配器：`server/infrastructure/<provider>/`
- 页面和筛选交互：`client/src/`
- 前后端共享契约：`shared/`
- 数据模型：由已批准 change 更新 `drizzle/schema.ts`
- 规范：由 `harness-spec` 更新 `openspec/`

## 禁止扩展

当前初始化不创建 X、AI、通知、认证或 A 股公司映射模块。相关目录和接口必须在 `build-serenity-intelligence-monitor` 的 design 获批后创建。
