# Project Dashboard 图表历史锚点计划

## 目标功能

- 随机命中：`甘特图 / 依赖图 / 燃尽图`（Project Dashboard）
- 本轮聚焦：已完成任务的 ETA 作为本地历史排期锚点，避免“只有已完成任务 + 里程碑”的项目被甘特卡误说成只有里程碑日期。

## 背景检查

- `docs/progressing/to-verify.md` 当前为空。
- 本机 Reminders 可读，但不存在 `Personal AI` 列表，本轮没有可合并或可完成的 Reminder item。
- automation 记忆里最近已覆盖 Project Dashboard 本地多词查找、关键链候选、来源检查等边界；本轮避开这些精确主题。
- 业内资料和论文方向：项目 timeline / dependencies / critical path 视图应能回到具体工作项；Gantt 可视化研究强调任务、里程碑和历史上下文的 details-on-demand，而不是只显示抽象空态。

## 改进计划

1. [x] 在 `buildGanttReadinessPanel` 中识别已完成且带 ETA 的任务。
2. [x] 当项目没有活动任务但有已完成 ETA 时，甘特卡显示“历史排期锚点”，列出完成任务 driver 和 marker。
3. [x] 保持边界：历史锚点只来自当前浏览器本地工作台，不做 Jira/GitHub/Confluence 权威同步，不生成 effort/velocity 预测，不把项目误判为仍有活动排期。
4. [x] 更新 `tools/verify-project-dashboard.ts` 的纯函数断言和 `tools/verify-project-dashboard-e2e.mjs` 的 UI 断言。
5. [x] 更新 `docs/features/project_dashboard_usage_guide.md` 的图表概览说明和维护记录。
6. [x] 验证：`npm run verify:project-dashboard`、`npm start -- --progress` 首次成功编译、`npm run verify:project-dashboard:e2e`、`npm run verify:i18n`、scoped `git diff --check`。

## 实施结果

- `buildGanttReadinessPanel` 现在只在没有活动任务时读取已完成任务 ETA，避免历史完成项拉长仍在推进项目的活动排期范围。
- 有已完成 ETA 的完成态项目会显示 `已完成 ETA 可作历史锚点`，完成任务 driver 使用 `完成 ETA YYYY-MM-DD`，marker 标为 `complete`。
- 如果已完成任务缺 ETA，甘特卡保留 partial 状态，并提供 `补历史 ETA` 修复入口。

## 验证结果

- `npm run verify:project-dashboard` passed。
- `npm start -- --progress` reached first successful webpack dev compile, then watch stopped。
- `npm run verify:project-dashboard:e2e` passed。
- `npm run verify:i18n` passed。
- `git diff --check -- <本轮触碰文件>` passed。
