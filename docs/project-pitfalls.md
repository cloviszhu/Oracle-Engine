# 项目踩坑记录

## 容器中的 ESM 运行标识

- 构建产物使用 ESM 时，runtime 镜像必须同时包含声明 `"type": "module"` 的 `package.json`。
- 仅复制 `dist/` 会让 Node 将 `.js` 按 CommonJS 解析；静态测试应检查 runtime 同时复制 `package.json`、`dist/` 和 migration。

## 跨层详情 ID 契约

- 私有详情 API 以 `content_items.id` 查询，研究卡片 ID 不能直接用于 `/intelligence/:id`。
- 通知消息必须同时保留审计用 `cardId` 和导航用 `contentId`，链接契约测试应断言后者。

## 持久化候选不等于生产编排

- 实现 reservation 类和发送 worker 仍不足以证明真实候选会产生 delivery。
- 生产组合根必须明确连接“已落库的重要性候选 → reservation → durable delivery → queue”，并用 wiring 测试覆盖。

## 外部发送中断的歧义窗口

- worker 在写入 `sending` 后退出时，不能把记录留在永久处理中，也不能盲目重发。
- 超过外部时限与保护窗口后应转为 `outcome_unknown`，等待人工对账。

## 人工恢复必须可执行且可审计

- 标记 `manual_retry_allowed=true` 时，状态 API、网页入口和服务端恢复路径必须同时存在。
- 通知恢复只允许 `blocked`/`dead_letter`，每次请求记录 actor 和原状态，旧 attempt 历史不得覆盖。
