# Task Scheduler 手动失败回执改进计划

## 目标功能

- 来源索引：`docs/index.md`
- 选中功能：Task Scheduler 状态 API / Popup 后台任务概览
- 主文档：`docs/features/task_scheduler_api.md`

## 现状

- `TaskScheduler` 已经把失败、跳过、排程异常、连续失败和最近运行历史结构化成 `statusReceipt`。
- Popup 的任务行能显示失败状态和下一步建议。
- 但用户点击“立即执行”后，如果任务真实失败，`runTaskNow()` 直接进入 `catch`，只留下通用错误条；这次点击没有生成 `task-action-receipt-panel`。
- 结果是用户能看到任务行失败，却看不到“这次是一次性执行、没有改排程、历史仍保留”的操作边界。

## 外部参考

- Chrome `chrome.alarms` 官方文档强调 alarm 持久性和浏览器/扩展重启边界，适合继续把 storage 状态和 Chrome alarm 实况分开解释。
- Power Automate 的 run history / resubmit 路径把失败 run、错误细节和重试动作放在同一排障流程里，而不是只显示一个全局错误。
- 自动化信任/人因研究反复强调，自动化系统需要让用户知道当前模式、失败或降级状态，以及可手动接管点。

## 实施步骤

1. 调整 `src/popup.tsx` 的 `runTaskNow()`：
   - 只有没有 response 这种控制面失败才保留通用错误。
   - 任务本身失败时先刷新任务状态，再生成失败操作回执。
   - 回执说明本次只是一次性执行，自动排程或停用状态不被隐式改变。
2. 扩展 `buildTaskSchedulerActionReceipt()`：
   - 支持显式 `failed` 参数，避免在状态刷新失败或响应里只有错误文本时误显示“已手动执行”。
3. 更新 `tools/verify-task-scheduler-popup-filters-e2e.mjs`：
   - 点击一个会失败的后台任务立即执行按钮。
   - 验证 popup 顶部出现 `手动执行失败` 回执和一次性执行边界。
4. 更新 `docs/features/task_scheduler_api.md`：
   - 记录手动执行失败也会生成操作回执，不会被全局错误条吞掉。
5. 验证：
   - `npm run verify:task-scheduler-status-filters`
   - `npm run verify:task-scheduler-api`
   - `npm start` 首次成功编译后停止
   - `npm run verify:task-scheduler-popup-filters:e2e`
   - scoped `git diff --check`
