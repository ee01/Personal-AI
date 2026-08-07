# Project Dashboard 图表口径改进计划

## 目标功能

- 随机目标: `甘特图 / 依赖图 / 燃尽图`
- 所属文档: `docs/features/project_dashboard_usage_guide.md`
- 主要代码: `src/utils/dashboardIntegration.ts`、`src/components/dashboard/ProjectDashboard.tsx`

## 当前判断

当前图表概览已经有 `图表依据` 回执、依赖链读取、无效依赖提示和关键任务修复入口。剩余 UX 缺口集中在燃尽卡: UI 显示 `33% 完成` 等百分比，但当前本地工作台没有 story point、工时或 scope-change 历史，只能按任务数计算完成率。用户容易把它误读成 Jira/Agile 里的 effort burndown 或速度预测。

## 外部参考

- Jira Advanced Roadmaps 把计划视图作为从 Jira 数据拉取的规划沙盒，支持时间线、容量、依赖和场景建模，保存前仍应区分计划视图和源系统更新。
- Jira burndown 指南强调 burndown 通常跟踪剩余 effort / story points / hours，不能表达质量、个人表现或 scope change。
- PMI dashboard 论文强调 dashboard 的价值在于及时把关键项目指标交给相关决策者，但前提是指标口径能被理解。

## 实施步骤

1. 在燃尽/完成面板所有状态的 `metrics` 和说明中加入 `任务数口径`，明确当前只按本地任务条目计数，不含 story point、工时、scope change 或速度预测。
2. 更新 `verify-project-dashboard` 的图表单测，覆盖风险、缺 ETA、ready、empty 四类燃尽状态的口径。
3. 更新 Project Dashboard E2E，确认页面燃尽卡直接显示 `任务数口径`。
4. 更新 `docs/features/project_dashboard_usage_guide.md` 和 `docs/index.md` 的目标行，保持文档是最新但不过细。
5. 跑 `npm run verify:project-dashboard`、`npm start` 首次成功编译、`npm run verify:project-dashboard:e2e`、scoped `git diff --check`。
