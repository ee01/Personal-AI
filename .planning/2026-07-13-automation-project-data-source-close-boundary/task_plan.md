# Project Dashboard 数据源检查收起边界

## 选择

- 随机样本后选中：`Memory Service watched projects 补齐` / Project Dashboard。
- 避开最近几轮已经覆盖的 Quick Ask、Notification Center、Meeting side panel、User Profile export 和 Project Dashboard 本地查找。
- `docs/progressing/to-verify.md` 当前为空。
- Reminders：AppleScript 没列出 `Personal AI`，EventKit 找到 `Personal AI` 列表，4 条总计、0 条未完成；没有和 Project Dashboard / watched projects 相关的未完成反馈，本轮无需标记 done。

## 外部参考

- GitHub Projects Insights：charts use project items as source data, archived/deleted items are not tracked. 结论：项目洞察必须说明当前 source data 口径。
- Linear Project Graph：只有项目 started 且收集到足够 issue data 后才生成图，且定时更新。结论：本地项目面板不应把缺外部 issue data 的结果伪装成预测。
- Atlassian Home Dashboard Insights / Rovo：AI insights 在 dashboard 上生成，但用户仍从 dashboard context 进入。结论：检查入口需要把 AI/自动结果放回可审阅的来源面板。
- Data provenance dashboard 研究：provenance 支撑透明度和质量保证。结论：收起 / 隐藏来源面板时也要说明没有清空来源状态或触发外部动作。

## 发现

当前数据源检查主体已经有较好的边界：同步按钮、source scope、本地证据回执、来源卡、规划 / 补 ETA / 补来源按钮都说明只读 Memory Service watched projects、Jira/GitHub/Confluence 未接入、不反写外部。

剩余 UX 缺口在检查结果面板的 `收起` 控制：它是检查后最容易被点击的控制点，但之前没有 `title` / `aria-label` 说明点击只是隐藏面板。用户可能误解为取消同步、清空本轮结果或撤销新增的本地项目。

## 实施计划

1. 给 `.data-source-close` 按钮补 `title` 和 `aria-label`，说明只隐藏当前面板。
2. 在 Project Dashboard E2E 的 watched-project 成功同步路径里断言收起边界，并点击收起后确认状态条和新增项目仍存在。
3. 更新 `docs/features/brain_like_project_analysis_system.md`、`docs/features/project_dashboard_usage_guide.md` 和 `docs/features/index.md`。
4. 验证：`node --check tools/verify-project-dashboard-e2e.mjs`、`npm run verify:project-dashboard`、`npm start -- --progress` 首次编译、`npm run verify:project-dashboard:e2e`、scoped `git diff --check`。

## 当前时间

2026-07-13T03:05:16+0800
