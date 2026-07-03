# Project Dashboard 导出回执

## 目标功能

- 随机选中：`项目面板`，来源 `docs/features/index.md`。
- 主文档：`docs/features/project_dashboard_usage_guide.md`。
- 辅助文档：`docs/features/brain_like_project_analysis_system.md`。

## 现状

- `docs/progressing/to-verify.md` 为 `暂无。`，没有待接续验证项。
- 本机 Reminders 可读取列表，但没有 `Personal AI` 列表；本轮没有 Reminder 条目可纳入或标记完成。
- Project Dashboard 已经给同步、导入、图表概览提供结构化边界回执，但导出报告仍只有顶部一行成功状态。

## 外部参考

- Jira Cloud backup/export 文档强调导出范围、附件/媒体、自动化和恢复限制。
- Asana 项目导入/导出说明把 JSON/CSV 用于备份、迁移和分析，但不同对象不会天然等价。
- Buse & Zimmermann 的 software analytics 研究强调开发/项目分析工具要让用户从汇总钻到具体 artifact，并理解数据支持什么决策。
- Software engineering dashboards 研究强调 dashboard 是把仓库数据转成可消费信息，也有范围和误读风险。

## 改进方案

1. 在 Project Dashboard 顶部增加导出后的结构化 `导出报告回执`。
2. 回执显示文件名、导出范围、项目/任务/里程碑/Jira 数量、缺 ETA 和缺来源任务数。
3. 回执明确 JSON 只来自当前浏览器本地工作台，不会同步、删除、恢复或写回 Memory Service / Jira / GitHub / Confluence。
4. 更新 E2E，确保导出后能看到范围和边界。
5. 更新 `docs/features/project_dashboard_usage_guide.md`。

## 验证

- `npm run verify:project-dashboard`
- `npm start` 首次成功编译后停止 watcher
- `npm run verify:project-dashboard:e2e`
- `git diff --check`
