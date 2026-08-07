# Action Queue 随机巡检计划

## 目标功能

- Feature index: `动作队列`
- Canonical doc: `docs/memory_system.md`
- Primary UI/API: `ActionQueue.vue` / `proposed_actions`
- Initial selected slice: inspect before deciding; prefer a focused UX trust-boundary improvement if code already works

## 当前判断

- `docs/progressing/to-verify.md` 为空，本轮从 `docs/index.md` 随机候选中选中 `动作队列`。
- 最近自动化记忆刚覆盖 Task Scheduler、Notification Center、备份恢复、Jira Import、Today、Storyline、User Profile、Meeting、Reflection、Watch、Quick Ask 等表面，本轮避开这些重复点。
- AppleScript 未列出 `Personal AI`，但 EventKit 找到本地 `Personal AI` Reminders 列表；共有 4 条、0 条未完成，均为历史 Doubao / Notification 反馈，与动作队列无关。

## 实施步骤

| Step | Status | Scope |
| --- | --- | --- |
| 1 | completed | Inspect `memory_system.md`、动作队列 UI/API/service/test/verifier，确认文档是否反映最新行为 |
| 2 | completed | 做外部产品/论文扫描，寻找对动作队列、建议动作审批、自动化透明度和操作回执的建设性参考 |
| 3 | completed | 以真实用户路径检查空列表、筛选、普通动作、委派/外部动作、提交/失败/刷新等是否存在误导或阻塞 |
| 4 | completed | 选一个无需用户决策的窄改进，优先提升首屏/操作前后的边界清晰度 |
| 5 | completed | 更新代码、目标 verifier 和 `docs/index.md` / `docs/memory_system.md` 的简短描述 |
| 6 | completed | 运行目标测试、`npm start` 首次成功编译、必要 E2E、scoped `git diff --check` |
| 7 | completed | 若 Reminder 来源被使用则写备注并完成；本轮当前没有未完成相关 Reminder。最后更新自动化记忆 |

## 非目标

- 不改变动作队列后端执行语义、审批语义或外部委派真实 side effect。
- 不扩大 Memory Service 写入范围。
- 不把已完成且无关的 Reminder 当作本轮来源。

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` and `.planning/.active_plan` pointed to old completed runs | Initial planning check | Created this dedicated dated planning directory for the current sweep |
