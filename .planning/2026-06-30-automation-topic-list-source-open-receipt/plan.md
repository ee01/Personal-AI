# Topic 列表资源打开回执改进计划

## 目标功能

- 随机抽中功能：Topic Messages / 主题式未读阅读
- 功能文档：`docs/features/topic_based_messages.md`
- 目标入口：`src/modals/components/EntityListPage.vue` 的 Topic 列表资源预览

## 发现

Topic 详情页打开聊天、资源或网页来源后会展示“来源打开回执”，说明这只是请求浏览器打开外部标签页，不会重新读取原始消息、同步 Memory Service、标记已读或写回原始平台。

Topic 列表卡片的资源预览也能直接打开可信 `http(s)` 链接，但当前静默调用 `window.open()`，没有同等回执。真实用户从列表快速扫未读主题时，容易误判这个动作是否改变了阅读状态或触发了后端同步。

## 外部参考

- Slack Unreads / Later 把阅读、稍后和已读拆开，并强调可恢复的 catch-up 心智。
- Notion AI Connectors 强调来源引用和权限边界。
- Microsoft Defender Safe Links 与 RFC 3986 都支持“外链打开前后露出真实目标和安全边界”的设计方向。
- Email deferral / conversation triage 研究说明未读视图应帮助用户快速处理注意力压力，而不是制造隐式状态变化。

## 实施步骤

1. 在 `EntityListPage.vue` 增加 Topic 列表级 `sourceOpenReceipt` 状态区，位置放在过滤/队列回执附近。
2. 资源预览打开可信链接时，先记录回执，再 `window.open()`；回执内容明确：外部标签页、目标域名、无 Memory Service 同步、无已读标记、无原平台写回。
3. 增加小型工具函数从 URL 提取主机名并处理异常，避免无效链接导致 UI 阻塞。
4. 更新 `docs/features/topic_based_messages.md`，把列表卡片资源打开回执纳入当前行为。
5. 扩展 `tools/verify-topic-based-messages-e2e.mjs` 或相关验证，覆盖列表资源预览打开后的回执。
6. 运行 `npm run verify:topic-based-messages`、`npm run verify:topic-based-messages:e2e`、`npm start` 首次成功编译和 scoped `git diff --check`。

## Reminder

本机 Reminders 列表中没有 `Personal AI`，本轮没有可读取或可标记完成的 Reminder item。
