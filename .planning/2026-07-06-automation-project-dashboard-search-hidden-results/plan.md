# Project Dashboard 本地查找隐藏命中恢复计划

## 目标功能

- 索引条目：`项目本地查找`
- 所属能力：Project Dashboard
- 主文档：`docs/features/project_dashboard_usage_guide.md`

## 当前发现

- 文档已描述本地查找会在当前浏览器本地快照内匹配项目、任务、Jira、平台来源和里程碑，并和项目视图筛选组合使用。
- 代码已实现多关键词 AND、命中构成回执、本地无外部读写边界，以及空状态下的 `查看全部项目` 恢复按钮。
- UX 缺口：当本地查找有命中但当前项目视图筛选隐藏了结果时，顶部回执只写“切到全部”，没有就地操作。用户看到问题后还要回到筛选按钮区找入口。

## Reminder 输入

EventKit 找到 `Personal AI` Reminders 列表，合计 4 条，未完成 0 条。现有条目都已完成，且都是 Doubao / Notification / 测试相关历史反馈；没有和 Project Dashboard、本地查找、项目筛选或隐藏命中恢复相关的未完成条目。本轮不标记 Reminder。

## 外部参考

- Jira quick filters 把文本/条件筛选作为 board 视图的进一步收窄方式。
- Asana task search 支持复杂过滤，但也明确搜索索引可能存在一致性延迟。
- Faceted search 和 scoped facets 研究都强调用户需要在收窄和放宽结果集之间快速切换，并看清当前结果集边界。

## 改进计划

1. 在 `ProjectDashboard.tsx` 的本地查找回执中，把隐藏命中的提示升级为带按钮的恢复行。
2. 点击恢复按钮时切换到 `全部` 项目视图，并显示短状态回执，说明这只是放宽当前本地筛选，不会读取或同步外部系统。
3. 更新 `tools/verify-project-dashboard-e2e.mjs`，优先点击新回执按钮证明路径可用。
4. 更新 `docs/features/project_dashboard_usage_guide.md` 和 `docs/features/index.md` 的简短描述。
5. 运行 `tools/verify-project-dashboard.ts`、`npm start` 首次编译、`tools/verify-project-dashboard-e2e.mjs` 和 scoped `git diff --check`。

## 边界

- 不改本地查找匹配算法。
- 不改 `chrome.storage.local` 数据结构。
- 不新增 Memory Service、Jira、GitHub 或 Confluence 读取。
- 不触碰 unrelated dirty files。
