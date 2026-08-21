# Task Plan: Roadmap Jira 同步设计梳理

## Goal
把 roadmap-service 与 Chrome 扩展之间的 Jira 双向同步（打开页面 / 导入 / 拖动回写 / 创建 issue）整理成可核对的时机与字段清单，直接回答用户。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] 读 `docs/features/personal_roadmap.md` 同步边界
- [x] 对照打开刷新、Target 回写、导入、创建、assignee 的实现
- **Status:** complete

### Phase 2: Planning & Structure
- [x] 按「打开页面有/无扩展」+ 其他场景拆两个方向
- [x] 用 canvas 做对照图，聊天里给中文结论
- **Status:** complete

### Phase 3: Implementation
- [x] 写入 findings.md
- [x] 产出 canvas
- **Status:** complete

### Phase 4: Testing & Verification
- [x] 对照 `TeamService.refreshFromJira.test.ts`、`TargetSync.ts`、content script 字段列表复核
- **Status:** complete

### Phase 5: Delivery
- [x] 中文回答用户
- **Status:** complete

## Key Questions
1. 打开页面会不会自动从 Jira 拉字段？会不会推送到 Jira？
2. 有扩展 vs 无扩展分别怎样？
3. 两个方向分别在哪些用户动作下发生？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 只梳理、不改代码 | 用户要的是设计整理 |
| 用 canvas 做对照 | 场景 × 字段矩阵适合并排看 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- 权威文档：`docs/features/personal_roadmap.md`
- 打开静默刷新实现：`GanttPanel.vue` `silentRefreshFromJira`
- 写回：`runTargetDateSync` + `TargetSync.ts` + `handleUpdateAssignee`
