# DigestQueueService 本地摘要释放窗口改进计划

## 选择来源

- 随机目标：`DigestQueueService 本地摘要`
- 所属能力：Notification Center
- 主文档：`docs/features/notification_center.md`
- Reminder：本机 Reminders 可读，但没有 `Personal AI` 列表；本轮无 Reminder 条目可纳入或标记完成。

## 外部扫描

- Apple Scheduled Summary / Reduce Interruptions 强调把低优先级通知合并到用户指定时间，并让重要通知突破摘要窗口：https://support.apple.com/guide/mac-help/summarize-notifications-reduce-interruptions-mchldf5e4cb6/mac
- Slack Activity 把通知变成可筛选、可扫读的队列，并支持 saved views：https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view
- Bounded deferral 研究强调用有上界的延迟平衡 awareness 和 interruption：https://erichorvitz.com/bdef_studies.htm
- 通知打断研究显示减少 notification-caused interruptions 对表现和压力都有益：https://pmc.ncbi.nlm.nih.gov/articles/PMC10244611/

## 代码和体验发现

当前本地 digest 已有队列保留、失败恢复、popup 当前队列回执和 Bot 文案自包含等能力。但用户配置 `每日 08:00` 或 `每周某日 08:00` 时，实际释放窗口仍可能被两个小时级门控放大：

1. `digest_queue_process` 的 Chrome alarm 每 60 分钟检查一次。
2. `ConcernedItems 定时消息摘要` 注册到 `DigestQueueService` 时自身也是 hourly gate。

如果后台任务在 07:55 检查到“暂无到期”，08:00 到期的摘要通常要等下一次小时级检查。对用户来说，这更像“某个小时内发送”，不是“按我设置的释放时间发送”。这不需要用户决策，可以直接改成较小的本地检查窗口；发送仍只发生在条目到期后，查看/刷新仍无副作用。

## 实施计划

1. 把本地 digest 队列处理任务的检查频率收紧到 15 分钟。
2. 把 ConcernedItems digest 的内部 gate 同步改成 15 分钟，避免外层 15 分钟检查被内部 hourly gate 抵消。
3. 更新 popup / scheduler 回执文案，明确“到达释放窗口后由后台任务推送，通常 15 分钟内检查”，并继续说明查看/刷新不会发送、不会写入 Memory Service、不会确认通知。
4. 更新 `tools/verify-digest-queue-service.ts`，覆盖 15 分钟内部 gate、当前队列 summary 的释放窗口文案、以及 due/future 状态。
5. 更新 `docs/features/notification_center.md`，保持文档简洁：本地摘要是低打扰队列，15 分钟检查窗口只是释放触发频率，不改变通知发送资格。
6. 验证：`npm run verify:digest-queue-service`、必要时 `npm run verify:task-scheduler-api`、`npm start` 首次成功编译、popup E2E、`npm run verify:i18n`、 scoped `git diff --check`。
