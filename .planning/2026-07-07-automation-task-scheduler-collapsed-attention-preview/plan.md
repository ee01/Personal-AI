# Task Scheduler 折叠态需处理预览计划

## 背景

- 随机候选里先出现 Today Pilot / Meeting Pilot / Doubao 等近期连续覆盖能力族，本轮选择较独立的 `Task Scheduler 状态 API`。
- `docs/progressing/to-verify.md` 当前无待校验事项。
- EventKit 能读取本机 `Personal AI` Reminders 列表，但 4 条均已完成，且都是 Doubao / Notification / 测试历史项；没有开放的 Task Scheduler 相关反馈可纳入或标记完成。
- 现有实现已经把刷新、执行、启停、重排、失败、跳过和队列明细未确认边界说得较清楚；主要 UX 缺口在折叠态。

## 外部参考

- Chrome Alarms API 文档说明 alarm 持久化存在浏览器/生命周期差异，Task Scheduler 仍需要持续校准并说明刷新不等于执行。
- Temporal Web UI、GitHub Actions workflow runs、Apache Airflow 和 Datadog Monitor 状态页都把“状态 + 具体对象 + 历史/下一步”组合呈现，避免只给抽象计数。
- 自动化透明度研究强调让自动化职责、活动和影响可见；在 popup 里应优先暴露具体阻塞对象，而不是让用户展开后才知道是哪项任务出问题。

## 改进计划

1. 在 `src/popup.tsx` 为后台任务 summary 增加折叠态需处理预览：当存在执行中、排程异常、失败或最近跳过任务时，summary 继续显示数量，同时点名前 1-2 个任务及状态，超出时显示还有几项。
2. 保持展开态现有“下一步处理”和“需处理总览”不变；折叠态只解释当前已确认快照，不触发刷新、执行、启停或重排。
3. 添加紧凑样式，避免 popup summary 文本挤压标题或溢出。
4. 更新 `tools/verify-task-scheduler-popup-filters-e2e.mjs`，覆盖折叠 summary 的具体任务预览。
5. 更新 `docs/features/task_scheduler_api.md` 和 `docs/features/index.md` 的简短说明，保持文档不写实现细节。
6. 验证：`node --check`、`npm run verify:task-scheduler-api`、`npm start -- --progress` 首次成功编译后停止、`npm run verify:task-scheduler-popup-filters:e2e`、scoped `git diff --check`。
