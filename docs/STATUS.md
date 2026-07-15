# 项目状态

更新时间：2026-07-15

## 当前阶段

`build-serenity-intelligence-monitor` 的原始 8 组研究闭环已完成本地实现、Mock/自动化验证和一次 `test_verify`，但用户在 Harness `user_accept` 判定家庭交付方式不合格。当前正在修订同一 change 的书面规格：新增 Electron 自包含 Windows 启动器、GUI 首次设置、DPAPI vault、受控服务生命周期、双协议 AI registry/probe、备份和脱敏诊断；Group 9～14 尚未实施，当前不得完成 `user_accept` 或归档。

## 已有能力

- 两个同权限家庭账号、服务端 Redis 会话、CSRF/同源保护和私有 API
- 最新情报、时间线、组合筛选、分层详情、六类反馈和运行状态网页
- X 官方 API 单账号适配器、稳定身份 bootstrap、分页/补偿、版本与生命周期归档
- 有界上下文、现有 OpenAI `gpt-5.6-terra` Responses 严格结构化适配器、原子预算与用量审计；它将由可配置双协议 registry/probe 修订任务取代
- 版本化可解释重要性评分和提醒候选事实
- 默认关闭的飞书提醒；评分候选生产扫描、事务 reservation、冷却/去重、带审计的人工恢复、强制安全签名和结果未知保护
- MySQL migration、BullMQ worker、容器入口、Secret/能力边界审计

## 验证证据

- `pnpm check`：通过
- `pnpm test`：44 个测试文件、188 个测试全部通过
- `pnpm lint`：通过
- `pnpm build`：通过，生成 `dist/public` 和 `dist/server/main.js`
- `pnpm audit:secrets`：输出 `secret-audit-ok`
- 通知专项：关闭/误配置/签名固定向量/候选预留/并发/中断恢复/超时/人工恢复/重试成功均通过 Mock 测试
- 验收报告：`docs/verification/build-serenity-intelligence-monitor.md`

## 已完成的规格与实现工作

- 19 条验收标准、38 条测试用例、8 个任务组、33 个可追溯任务
- X 官方轮询/补偿、上下文、内容版本、恢复和成本边界设计
- 私有网页主入口、单管理员会话、搜索/详情/反馈/状态设计
- OpenAI `gpt-5.6-terra` Responses API 适配器与严格结构化输出方案
- 可选飞书提醒；启用时强制安全签名，未配置时不阻塞归档、AI、搜索和查看
- 失败可见/可恢复、外部文本不可信、无交易/Hook/客户端抓取边界测试

## 尚未真实验证

- Docker/Compose 构建和运行、生产 HTTPS 部署
- 真实 X Developer 凭据、credits、政策复核和内容闭环
- 真实 OpenAI `gpt-5.6-terra` 质量、usage 和成本
- 可选的真实签名飞书发送
- 两个家庭账号现场操作和爸爸中文理解验收
- Electron Windows `.exe`、GUI-only 首启、DPAPI vault、真实 Docker 生命周期、备份恢复和脱敏诊断均尚未实现或验证

## 下一步

完成 OpenSpec strict validate、AC→TC→Task 追溯检查、重新顾问团审查与 debate，把 Group 9～14 和审查结论交给用户确认；确认前不写实现代码。后续实现完成后必须重新独立复核、运行完整验证与 Harness `test_verify`，再回到 `user_accept`。
