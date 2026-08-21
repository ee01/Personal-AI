# Findings: 依赖 Jira 镜像

## Requirements
- hover 有 jiraKey 时展示 status
- 无 ETA 且 Jira 有 Target End：提示可更新（hover 不可点）
- ETA 与 Target End 不一致：同样提示
- 打开页批拉缓存；确认写 ETA 在单击浮层

## Design
- `item_markers.jira_status` / `jira_target_end` / `jira_fetched_at`
- `refresh_from_jira` 按 `jira_key` 更新 dep 缓存，永不改 `date`
- collectRefreshKeys：甘特票 ≤50 + 未包含的 dep ≤25
- 扩展 search 加 `status`；单票 fetch 也返回 status
- hover：`depHoverTip()`；角标 pending（缺 ETA）优先于 drift（不一致）
- popover：status 芯片 + 采用/改用按钮 + 「刷新 Jira」只更新缓存
- **空白浮窗（2026-08-17）**：`openDepPopover` 先 `floatAt` 再 `fmtMD(d.jiraTargetEnd!)`。任务有 2+ 依赖且其中一条没有缓存 Target End 时，map 抛错，留下空的白色 `.owner-pop`。修复：无 Target End 不调 `fmtMD`；先算 HTML 再挂浮层。

## Resources
- TeamService applyRefreshFromJira / update_marker
- GanttPanel silentRefreshFromJira
- contentScriptRoadmap handleRefreshJiraIssues
- useMarkerFloats openDepPopover
- docs/features/personal_roadmap.md
- docs/demo/roadmap-demo.html
