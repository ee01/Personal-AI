# Task Scheduler 状态重置默认值修复

## 目标功能

- 随机抽中：`docs/features/task_scheduler_api.md`
- 范围：Task Scheduler 状态 API、共享任务开关 helper、Topic Messages 中的静默消息分析状态展示

## Reminder 检查

- 本机 Reminders 可访问，但可见列表里没有 `Personal AI`，所以本轮没有可纳入或可标记完成的 Reminder item。

## 外部参照

- Chrome alarms 官方文档强调 alarm 可能在浏览器重启后被清掉，应在 Service Worker 启动时确认/重建。
- Google Cloud Scheduler 把失败、重试次数、backoff 和下次调度分开表达，避免把失败恢复隐藏在普通成功状态里。
- Celery / Flower 监控强调任务事件、历史和可检查状态，方便排查后台任务是否真正运行。
- End-user debugging / trigger-action 研究强调给用户明确的状态线索和下一步，而不是让用户自己推断自动化为什么没有按预期工作。

## 发现

- `getTaskEnabled()` 已经会在缺少某个 task row 时回退任务定义默认值。
- `onTaskEnabledChanged()` 只有在 `newStates[taskId]` 存在时才触发 callback；如果 storage reset、迁移或部分写入移除了对应 row，打开中的 UI 可能继续显示旧开关。
- `topic-modal.tsx` 还在直接解析 `taskSchedulerStates`，同样会在 `message_analysis` row 缺失或 storage 被清空时保留旧状态。

## 实施计划

1. 给 `taskSchedulerDefinitions.ts` 增加统一的 storage-state 解析 helper，缺 row 或缺 `enabled` 时回退任务定义默认值。
2. 修复 `onTaskEnabledChanged()`：当 task row 被移除、storage 被清空或 `enabled` 缺失时，也要发出默认值。
3. 让 `topic-modal.tsx` 的静默消息分析状态监听复用同一 fallback 逻辑，避免 UI 状态过期。
4. 扩展 `verify-task-scheduler-api.ts` 覆盖 row 移除和 storage 清空。
5. 更新 `docs/features/task_scheduler_api.md`，把“重置/缺 row 回退默认值并通知打开中的 UI”写入文档。
6. 验证：`verify:task-scheduler-api`、`verify:task-scheduler-status-filters`、`npm start` 首次 compile、`verify:task-scheduler-popup-filters:e2e`、`git diff --check`。

## 完成记录

- 已实现共享 helper `resolveTaskEnabledFromSchedulerStates()`，`getTaskEnabled()` 和 `onTaskEnabledChanged()` 共用同一套缺失状态回退规则。
- 已让 `topic-modal.tsx` 的静默消息分析状态监听复用共享 helper，避免 storage reset 后继续显示旧开关。
- 已更新 Task Scheduler 功能文档和验证建议。
- 验证已通过：`npm run verify:task-scheduler-api`、`npm run verify:task-scheduler-status-filters`、`npm start` 首次 compile、`npm run verify:task-scheduler-popup-filters:e2e`、`npm run verify:topic-based-messages`、`npm run verify:topic-based-messages:e2e`、scoped `git diff --check`。
