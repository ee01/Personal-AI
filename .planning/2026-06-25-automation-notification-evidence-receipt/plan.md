# Notification Center 证据回执计划

## 目标

本轮随机目标是 `Notification Center / 渠道投递回执`。重点不改投递状态机，而是补齐现有文档里已经预留但未呈现的通知证据线：当 feed item 本身带 `evidence_refs_json` 时，用户在 Chrome 通知或 Provider/Doubao 摘要里要能看到“依据 N 条记忆”，并且明确这只是只读依据，不代表已处理、已确认或已重发。

## 外部参考

- Firebase Cloud Messaging 区分 message accepted 和 device delivery，并把 BigQuery delivery export 用于事后诊断，说明投递回执应该服务于排障而不是替代用户处理状态。
- Teams read receipt 资料明确指出在 notification / activity feed 中看到消息不等于 read receipt，和 Personal AI 的“渠道送达不等于用户处理”一致。
- Intelligent Notification Systems survey 强调通知在不合适时机出现会打断用户，因此通知应该暴露上下文与依据，减少不必要的切换。
- Email batching 研究支持低打扰摘要要可预期；摘要里缺少依据会让用户只能打开详情确认。

## 实施步骤

1. 服务端 `NotificationCenterService` 从 `notification_records.evidence_refs_json` 和 `proposed_actions.evidence_refs_json` 安全解析紧凑证据标签，返回 `evidenceReceipt`。
2. Provider/Doubao digest 在每条通知后显示 `[依据 N 条记忆；只读依据]`，不改变 sourceRefs 写入逻辑。
3. Chrome 通知 context label 追加 `依据 N 条记忆`，并保留原有 deliveryContext / channelReceipts 文案。
4. 更新 `MemoryServiceClient` 类型、`backendNotifications` helper、文档与测试。
5. 验证：`notificationCenter.test.ts`、`backendNotifications.test.ts`、`npm start` 首次编译、通知相关 E2E、路径级 `git diff --check`。

## Reminder

本机 Reminders 列表中没有 `Personal AI` 列表，本轮没有可完成或可备注的 Reminder item。
