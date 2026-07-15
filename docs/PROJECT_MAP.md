# 项目地图

## 目录职责

| 路径 | 职责 | 当前状态 |
|---|---|---|
| `client/` | React 私有网站 | 初始化页；当前 change 已设计登录、最新、时间线、详情、筛选、反馈和状态页，尚未实现 |
| `server/` | NestJS API 和后台任务入口 | 健康检查；当前 change 已设计业务 API/worker，尚未实现 |
| `server/infrastructure/` | 数据库、队列和外部系统边界 | 仅配置读取 |
| `shared/` | 前后端共享类型和常量 | 系统名称 |
| `drizzle/` | MySQL schema 与迁移 | 无业务表 |
| `openspec/` | SDD 规格和 change | `build-serenity-intelligence-monitor` 实施前复审中 |
| `docs/` | 状态、地图、设计和执行计划 | 已建立 |

## 变更指引

- 新 API：`server/<capability>/`
- 外部服务适配器：`server/infrastructure/<provider>/`
- 页面和筛选交互：`client/src/`
- 前后端共享契约：`shared/`
- 数据模型：由已批准 change 更新 `drizzle/schema.ts`
- 规范：由 `harness-spec` 更新 `openspec/`

## 禁止扩展

当前业务代码仍未创建。已评审设计限定为 Serenity 单账号、OpenAI `gpt-5.6-terra` 适配器、私有网页主入口和可选签名飞书提醒；多账号、多源、A 股公司级映射、新通知渠道和交易能力不进入本 change。只有 Harness 实施前确认完成后才能按 tasks 创建相关目录和接口。
