# Task Scheduler 旧快照边界提示

## 选择

- 随机抽中 `Task Scheduler 状态 API`，对应 `docs/features/task_scheduler_api.md`。
- `docs/progressing/to-verify.md` 为 `暂无。`。
- 本机 Reminders 可读，但没有 `Personal AI` 列表，本次没有可纳入或标记完成的 Reminder item。
- 避开上一轮 automation memory 中刚处理过的 Scheduled Messages / Timeline 缓存。

## 外部参照

- Chrome alarms 文档强调 alarm 持久化与浏览器/扩展生命周期有关，状态页不能只假设排程仍然存在。
- Zapier Zap History / Replay 把 run history、错误详情、manual replay / autoreplay 拆开呈现，避免用户把一次失败误读成永久状态。
- GitHub Actions workflow runs 支持查看日志、重新运行、取消等操作，状态页同时保留运行结果和恢复动作。
- 自动化透明度研究强调用户需要知道自动化为什么可用、为什么失败，以及何时应该接管。

## 发现的问题

Popup 的后台任务面板已经能展示 `statusReceipt`，但 `GET_TASK_SCHEDULER_STATUS` 失败时仍保留旧任务列表。当前错误文案没有明确说明下方列表只是上次成功读取的快照，用户可能误以为 Chrome alarm / 执行中 / 失败状态刚刚被确认过。

## 改进计划

1. 在 popup 中把状态读取失败文案升级为快照边界回执：
   - 有旧任务列表时：说明读取失败、下方仍是上次快照、当前 Chrome alarm 和执行状态未确认。
   - 没有旧任务列表时：说明没有可用快照。
2. 保留旧列表，避免用户失去任务名称、历史错误和手动操作入口；但让错误条承担 freshness 边界。
3. 更新 Task Scheduler 功能文档，补充“刷新失败不确认当前状态”的用户可见边界。
4. 扩展 E2E：在 popup 已有任务快照后模拟背景状态请求失败，断言错误条显示旧快照边界，同时旧列表仍保留。
5. 验证：
   - `npm run verify:task-scheduler-api`
   - `npm run verify:task-scheduler-status-filters`
   - `npm start` 首次成功编译后停止
   - `npm run verify:task-scheduler-popup-filters:e2e`
   - scoped `git diff --check`
