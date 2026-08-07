# Project Dashboard 本地查找多关键词收窄

## 目标

改进 `项目本地查找`，让用户可以输入跨字段线索，例如 `API Dana`、`FRESH Future` 或 `SDK blocked`，在同一个本地项目快照内按多个关键词同时收窄，而不是把整段输入当成一个连续字符串导致误判为空。

## 依据

- 本轮随机目标来自 `docs/index.md`：`项目本地查找` / `Project Dashboard`。
- `docs/progressing/to-verify.md` 为空。
- 本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有 Reminder item 可关联或完成。
- 业内扫描：
  - Linear Search 支持在 workspace 内查 issues/projects/documents，并继续用过滤器细化结果。
  - Jira advanced search / JQL 和 GitHub Issues search 都强调用多个条件收窄工作项。
  - Faceted search 研究强调复杂信息空间需要关键词、维度和可见 refinement 协同，而不是单一层级或单一字符串匹配。

## 问题

当前实现只检查单个 token 是否包含完整查询串。用户如果记得两个线索分别在不同字段里，例如 Jira key 的 `FRESH` 和任务标题里的 `Future`，输入 `FRESH Future` 会没有命中。这个空结果看起来像本地没有该项目，实际只是查询语义太窄。

## 实施计划

1. 把本地查找 query 标准化为多个空白分隔关键词。
2. 项目命中规则改为：每个关键词都能在该项目任意可查 token 中命中；空 query 仍返回全部。
3. 命中构成回执继续按项目字段 / 任务 / Jira / 平台来源 / 里程碑汇总，并在多关键词时显示“按 N 个关键词同时收窄”的本地回执。
4. 保持边界不变：不读取、不同步、不写回 Memory Service、Jira、GitHub、Confluence。
5. 补充 `verify:project-dashboard` 和 E2E 对多关键词跨字段命中的覆盖。
6. 更新 `docs/features/project_dashboard_usage_guide.md` 中本地查找的行为说明。

## 非目标

- 不接入真实 Jira/GitHub/Confluence 搜索。
- 不加入高级布尔语法、保存搜索、模糊拼写或语义检索。
- 不改变项目视图筛选和风险排序。
