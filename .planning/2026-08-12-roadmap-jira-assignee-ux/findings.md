# Findings

## Existing state
- `create_jira_prompt` / Agent 创建路径已有未提交改动，可复用。
- `assignee_map` 尚未落地；demo 有完整交互。
- 导入 Task 日期逻辑不完整：缺 Target 时默认 7 天，未实现 `importedTaskSpan`。
- 选人浮层仍是旧版（输入在底、无滚动/聚焦/翻转）。
- 子任务 × 仅 `s.temp`（草稿）可见；导入子任务无法删。
- 别名编辑器固定 `top: 4px` + 主任务 `barLeft()`，双击子任务时盖在主条上。
- `contentScriptRoadmap.ts` 右上角固定徽标「Personal AI 已连接 · N 个重点项目」。

## Demo helpers to port
- `importedTaskSpan(epic, ts, te)`
- `dispName` / `resolveAssignee` / Prompt 组装
- `.creator-tag` / `.bar-link`
- owner float：搜索置顶 + max-height + flip + focus

## Extra UX (user)
1. 连接徽标：打开后展示数秒消失；重点数量变动再提示「新加入的 xxx 已纳入 Personal AI 重点项目」。
2. 别名编辑对齐对应子任务条。
3. 导入子任务可单独 × 删除，可再导入。
