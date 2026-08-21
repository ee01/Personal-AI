# Task Plan: 依赖 Jira status / Target End 镜像

## Goal
打开页批拉依赖 ticket 的 status 与 Target End 落入团队共享 marker（不自动改 ETA）；hover 只读提示；单击 popover 确认是否把 Target End 写成 ETA。文档与 demo 对齐。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] 对照 marker schema、静默刷新、hover/popover、demo
- **Status:** complete

### Phase 2: Planning & Structure
- [x] 落库共享 `jira_status` / `jira_target_end` / `jira_fetched_at`
- [x] 打开页 refresh 批拉 dep keys；不写 `date`
- [x] hover 只读；popover 确认采用 ETA
- **Status:** complete

### Phase 3: Implementation
- [x] 迁移 + types + refresh_from_jira 写 marker 缓存
- [x] 扩展拉 status；前端 keys/hover/popover
- [x] 文档 + demo
- [x] 单测
- **Status:** complete

### Phase 4: Testing & Verification
- [x] vitest：markers / refresh / contract
- **Status:** complete

### Phase 5: Delivery
- [x] 中文说明行为与文档位置
- **Status:** complete

## Key Questions
1. 自动写 ETA？否
2. 缓存落库共享？是
3. hover 可点？否，单击 popover

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 静默刷新不 bump marker version | 避免与用户改 ETA 的 OCC 打架 |
| popover「刷新 Jira」只写缓存 | 与打开页同一语义；采用 ETA 另按钮 |
| 主任务 50 + 依赖额外 25 key | 避免 dep 被甘特票挤掉 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
