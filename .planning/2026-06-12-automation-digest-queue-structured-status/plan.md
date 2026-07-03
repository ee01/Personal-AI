# DigestQueueService 本地摘要队列状态回执计划

## 目标功能

- 随机功能：`DigestQueueService 本地摘要`
- 主文档：`docs/features/notification_center.md`
- 主要路径：`src/services/DigestQueueService.ts`、`src/services/TaskScheduler.ts`、`src/popup.tsx`

## 当前观察

- `docs/progressing/to-verify.md` 没有待接续事项。
- 本机 Reminders 可读取，但没有 `Personal AI` 列表，本轮不纳入 Reminder 条目。
- 现有 popup 后台任务行能显示本地摘要队列总数、到期数和最早释放时间，但这是后端生成的一段中文字符串；英文 UI 也会显示中文，且用户看不到这些等待摘要属于哪个任务、关注项或释放节奏。

## 外部参考

- Apple Scheduled Summary 强调用户选择进入摘要的通知和接收时间。
- Slack Activity 把通知收敛成可筛选、可处理的工作队列。
- 通知打断和 batching 研究支持低打扰汇总，但前提是用户能预期延迟范围和恢复路径。

## 实施计划

1. 在 `DigestQueueStatusSummary` 里保留结构化任务快照，包括任务名、关注项 breakdown、释放节奏 breakdown。
2. `TaskScheduler` 继续保留旧 `currentQueueSummary`，同时给 `digest_queue_process` 状态补 `currentQueueStatus`。
3. popup 优先使用结构化状态按当前语言格式化队列回执，旧字符串只作为兜底。
4. 更新 DigestQueueService 单元验证和 popup E2E，覆盖中文和英文队列摘要。
5. 更新 `docs/features/notification_center.md`，只记录用户可感知行为和兼容边界。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-digest-queue-service.ts`
- `npm start` 到首次 webpack dev compile 成功后停止
- `node tools/verify-task-scheduler-popup-filters-e2e.mjs`
- `git diff --check`
