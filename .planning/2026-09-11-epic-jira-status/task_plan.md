# Task Plan: Epic Jira status mirror

## Goal
让 Roadmap 主任务（Epic）像子任务一样镜像 Jira 工作流状态（Closed / Resolved / Done），并在甘特条上用同样的浅绿 + ✓ 样式展示。

## Current Phase
Phase 5: Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify why tasks work and epics do not
- [x] Document findings
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Reuse `refresh_from_jira` + `isDoneStatus` (no new fetch path)
- [x] Add `items.status` column + snapshot field + Gantt `.bar.done`
- **Status:** complete

### Phase 3: Implementation
- [x] Migration `015_items_status` + schema + types + mapItem
- [x] `applyRefreshFromJira` writes item status
- [x] GanttRow + tokens + contract helper + tests
- [x] Docs + demo
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Targeted + full vitest (161 tests)
- [x] `deploy:roadmap` + `verify:roadmap-service`
- [x] Live snapshot shows `items.status` (`Initial` on scheduled epics; no Closed epics currently)
- **Status:** complete

### Phase 5: Delivery
- [x] Commit owned files and push
- [x] Answer: when does Jira status fetch happen?
- **Status:** complete

## Key Questions
1. When is Jira status read? Open-page silent refresh (~2s after extension handshake), gated by 10-min team TTL. Page reload can trigger it only if TTL expired.
2. Should Backlog cards also restyle? Out of scope — tasks' visible style is Gantt/resource bars; epics only appear as Gantt main bars.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Persist `items.status`, don't fetch a new Jira path | Epic keys are already in `collectRefreshKeys`; status is already in the refresh payload; only persist + UI were missing |
| Same DONE set as subs (`Closed`/`Resolved`/`Done`) | User asked for the same resolve/close styling |
| Don't auto-unschedule closed epics | Subs stay on the Gantt when done; only color + ✓ |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| webpage-mcp chrome_javascript serialization failed | 1 | Used team API snapshot + chrome_read_page instead |
