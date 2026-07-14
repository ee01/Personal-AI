# DigestQueueService 本地摘要执行边界改进计划

## 选择结果

- 来源：`docs/features/index.md` 随机候选第 8 项。
- 目标功能：`DigestQueueService 本地摘要`。
- 所属文档：`docs/features/notification_center.md`。
- 本轮范围：popup 里 `digest_queue_process / 汇总推送队列处理` 任务行的可见操作边界，以及 `立即执行` 按钮的 hover / 读屏语义。

## Reminder 检查

- AppleScript 未列出 `Personal AI`。
- EventKit 找到 `Personal AI` 列表：共 4 条，未完成 0 条。
- 没有与本地摘要、通知聚合、低打扰推送相关的未完成反馈，因此本轮不标记 Reminder done。

## 外部产品和论文信号

- Apple Scheduled Summary / Notification Summary 把通知摘要设计成用户选择应用和时间的低打扰机制，重点是让用户在合适时间处理，而不是每条即时打断。
- Slack notification schedule / reminders 和 GitHub scheduled reminders 都强调“在指定时间提醒”以及可管理、可删除的提醒配置。
- SuprSend batching / digest docs 把事件按收件人和 workflow 聚合，到 schedule 后只发送一条 consolidated notification。
- Fitz et al. 的 smartphone notification batching 研究显示批量通知可以改善注意力、幸福感和生产力；Mark et al. 的 email batching / interruption 研究也把分批处理和压力、生产力联系起来。

结论：本地摘要队列的核心 UX 不是“刷新一下状态”，而是“到了释放窗口才可能发送”。在真正会触发一次后台任务的按钮上，用户应该提前看到当前快照下会处理什么、哪些仍会留在本机队列，以及哪些系统状态不会被确认或写回。

## 发现的问题

当前 popup 已经在 `task-queue-summary` 卡片中展示：

- 当前本地待释放数量
- 已到期数量
- 下次释放时间
- source / schedule breakdown
- 查看或刷新不会立即发送、不写 Memory Service、不确认通知

但 `立即执行` 按钮仍使用通用 Task Scheduler 文案：只说跑一次、保留历史、自动排程不变。作为用户，我无法在点击前判断：

- 这次会不会释放已到期摘要；
- 未到期条目是否会被清掉；
- 空队列是不是仍会发送空摘要；
- 状态读取失败时点击是否等价于刷新；
- 发送和“确认通知 / 写 Memory Service”之间的边界。

## 实现计划

1. 在 `src/popup.tsx` 增加 DigestQueue 专用 helper。
   - 输入：`task.currentQueueStatus`、`task.currentQueueStatusError`、`task.enabled`、`isBusy` / `isExecuting`。
   - 输出：可见操作边界、run button title、aria-label。
2. 覆盖四类状态。
   - 已到期：说明会处理已到释放窗口的本地摘要，可能发送到配置渠道；未到期保留。
   - 未到期：说明只检查队列，不提前发送。
   - 空队列：说明只确认空队列，不发送空摘要。
   - 状态未确认：说明不是单纯刷新，会尝试读取并处理到期摘要，结果以运行回执为准。
3. 保持行为不变。
   - 不改 `DigestQueueService` 的入队、去重、释放窗口、发送、保留失败逻辑。
   - 不改 `TaskScheduler` 后台执行流程。
   - 不改 Notification Center feed / delivery。
4. 更新 verifier。
   - 在 `tools/verify-task-scheduler-popup-filters-e2e.mjs` 断言 visible boundary、run button title 和 aria-label。
   - 覆盖已到期、空队列、状态未确认。
5. 更新文档。
   - `docs/features/notification_center.md` 补充本地摘要执行按钮边界。
   - `docs/features/index.md` 的该行保持简洁同步。

## 验证计划

- `node --check tools/verify-task-scheduler-popup-filters-e2e.mjs`
- `npm run verify:digest-queue-service`
- `npm run verify:task-scheduler-api`
- `npm start -- --progress`，等待首次成功编译后停止。
- `npm run verify:task-scheduler-popup-filters:e2e`
- scoped `git diff --check`
