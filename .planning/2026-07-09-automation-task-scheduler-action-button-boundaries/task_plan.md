# Task Scheduler 按钮操作边界计划

## 目标功能

- Feature index: `Task Scheduler 状态 API`
- Canonical doc: `docs/features/task_scheduler_api.md`
- Primary UI: `src/popup.tsx`
- Existing verifiers: `verify:task-scheduler-api`, `verify:task-scheduler-status-filters`, `verify:task-scheduler-popup-filters:e2e`

## 当前判断

- `TaskScheduler` 后端已经提供 `statusReceipt` / `refreshReceipt`，popup 也有刷新回执、需处理总览、pending action 和任务行操作范围。
- 剩余 UX 缺口在按钮层：鼠标 hover / 键盘焦点 / 读屏只听到 `立即执行`、`修复排程`、`启用或停用` 等动作名时，仍可能不知道该按钮不会立即启用排程、不会清空历史、不会把修复等同于执行。
- Reminder `Personal AI` 通过 EventKit 确认存在，但当前 4 条全是已完成历史项，没有 Task Scheduler 相关未完成反馈。

## 外部参考

- Apache Airflow UI: Grid View 把任务状态、失败/重试定位和可采取动作放在同一个任务状态入口。
- Datadog Monitor Status Page: 告警原因、上下文和 quick actions 放在同一排障页面。
- Automation transparency research: 自动化界面应让职责、活动和影响可见，尤其是用户准备采取动作前。

## 实施步骤

1. 在 `src/popup.tsx` 增加按钮级 title / aria-label 文案 helper，复用已有操作边界语义。
2. 把任务行开关、重排、暂停、立即执行按钮的 `title` 和 `aria-label` 改成包含动作和边界的短句。
3. 更新 `tools/verify-task-scheduler-popup-filters-e2e.mjs`，断言按钮级 hover/aria 文案包含 no-run / no-history / no-reenable 等关键边界。
4. 更新 `docs/features/task_scheduler_api.md` 和 `docs/index.md` 的简短描述。
5. 跑 targeted verifier、dev build、Task Scheduler popup E2E、scoped diff check。

## 非目标

- 不改变 `TaskScheduler` alarm 创建、修复、执行、跳过、历史保存或状态排序。
- 不新增后端 API。
- 不改变 Reminder。
