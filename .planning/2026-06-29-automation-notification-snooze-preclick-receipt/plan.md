# 通知提醒稍后点击前回执计划

- 目标：`通知提醒与免打扰路径` / Memory Service `notification_records`。
- Reminder：本机可读 Reminders 列表，但无 `Personal AI` 列表；无 item 纳入或完成。
- 外部参考：Slack/Android 都把暂停/稍后作为显式通知控制；Snooze/Bounded Deferral 研究强调延后提醒要平衡打扰与仍可察觉，并避免二次打扰变成无来源的新提醒。

## Plan

1. 在 Chrome 通知 presentation helper 里为 todo notification 的 `contextMessage` 补点击前回执，展示预计回提醒时间、延后时长和边界。
2. 保持按钮 title 与二级动作执行逻辑不变，notice/proposed_action 只保留原文案。
3. 增加 `backendNotifications` focused test，覆盖有 dueAt、已过期和普通 24h snooze 的 hint。
4. 更新 `docs/features/memory_system.md`，只补充点击前回执语义，不展开实现细节。
5. 验证：focused helper test、memory-service notificationCenter test、`npm start` 首次 compile、scoped `git diff --check`。
