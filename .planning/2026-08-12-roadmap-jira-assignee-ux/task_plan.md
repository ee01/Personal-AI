# Task Plan: Roadmap Jira Assignee + UX

## Goal
落地 `docs/progressing/roadmap-jira-assignee-and-ux-plan.md`（R1–R9）并修复连接徽标、子任务别名编辑定位、导入子任务可单独删除；完成后删除 progressing plan doc，更新 `docs/features/personal_roadmap.md`。

## Current Phase
Phase 4 — complete

## Phases

### Phase 1: Discovery & contract — complete
### Phase 2: Backend — complete
### Phase 3: Frontend UX + extras — complete
### Phase 4: Docs + verify + cleanup — complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 映射存 `teams.assignee_map_json` | plan 明确；覆盖成员+创建者 |
| 导入子任务允许 × | 用户明确要求；与草稿删除同入口 |
| 徽标自动淡出 | 用户嫌碍眼；变动再提示 |
| Agent Prompt 前端组装 | plan 2.6 / 4.3；扩展只追加结果契约 |

## Notes
- progressing plan 已删除；行为写入 `docs/features/personal_roadmap.md`
- 验证：roadmap 单测 + build；extension `npm start` 首次编译成功
