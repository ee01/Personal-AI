# 自动答复未入队回执改进计划

## 目标

随机目标功能：`自动答复 / Reply`（Message Reaction）。

本轮聚焦用户在手动或后台消息分析后对自动答复结果的可见性：规则命中但没有创建队列行时，页面不能只显示成功入队数量或让用户去查 console。

## 外部参考

- Gmail / Google Chat Smart Reply、Outlook Suggested Replies 都把生成文本作为可编辑建议，用户仍要明确发送。
- Google Cloud Agent Assist Smart Reply 把建议展示给 human agent，而不是直接代发。
- Intercom Fin 强调高风险或不安全场景要 handoff。
- Smart Reply 和 AI-mediated communication 研究提醒 AI 回复建议会影响表达、信任和过度依赖，因此自动化发送路径需要更清楚的状态和失败边界。

## 需要实现

1. 让 `AutoReplyHandler` 在规则命中但未创建队列行时返回结构化 skipped reason，而不是只返回 `handled: false`。
2. 在 `MessageAnalysisDeliveryReceipt` 中新增 `autoReplySkipped`，并把 skip note 写入 `notes`。
3. 在 `topic-modal` 的“本轮分发回执”里显示“自动答复入队 / 未入队”和补充说明。
4. 更新功能文档，说明自动答复未入队的口径。
5. 用现有 Message Reaction 单元测试、message flow verifier、Message Analysis E2E 和 dev compile 验证。

## 非目标

- 不改变自动答复匹配、生成、发送、审核或 Google Sheet 写入逻辑。
- 不新增自动补发、重试、回扫历史或用户确认流程。
- 不改 Reminder；本机没有 `Personal AI` Reminders 列表。
