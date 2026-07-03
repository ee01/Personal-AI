# Task Scheduler 操作回执

## 目标

- 随机目标：`Task Scheduler 状态 API`，来源于 `docs/features/index.md`。
- 用户问题：后台任务面板已经解释当前状态，但点击启用、停用、立即执行或重排后，用户仍需要从列表变化里推断“这次点击到底做了什么”。
- 设计方向：增加轻量、持久的操作回执，明确本次点击是否只改排程、只执行一次，或只重建 Chrome alarm。

## 计划

1. 保持 `TaskScheduler` 后台 API 不扩面，popup 在 action 成功后刷新真实任务状态。
2. 从刷新后的任务状态构建 `操作回执`：任务名、结果、边界、时间。
3. 在 popup 后台任务面板顶部展示回执，避免用户必须滚动到任务行或读历史。
4. 扩展 `verify-task-scheduler-popup-filters-e2e.mjs`，覆盖手动执行和暂停排程后的回执。
5. 更新 `docs/features/task_scheduler_api.md`，把用户可见语义写入 source of truth。

## 研究约束

- Chrome alarms 可能在重启/更新后变化，所以 UI 不应让用户误以为点击后一定等同于一次业务执行。
- Slack / Zapier / Power Automate 的相似路径都把 scheduled/replay/resubmit 行为和状态历史、可恢复动作放在同一处。
- 自动化透明度研究支持把动作结果、边界和下一步直接呈现给用户，尤其是自动化失败或恢复路径。
