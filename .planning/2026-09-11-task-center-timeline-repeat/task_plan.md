# Task Plan: Task Center Timeline-triggered repeat

## Goal
任务中心定时推送和 L2「帮我做 / Agent 任务」除了固定日历重复外，也能按项目 Timeline Milestone 触发，每个版本的该节点再执行一次，并镜像到 ☁️ Sheet。

## Current Phase
Delivery complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm current Task Center only has calendar Repeat_Every
- [x] Confirm Scheduled Messages already has Timeline trigger (empty Schedule_Date + Timeline_Milestone)
- [x] Confirm ☁️ executor never marks Timeline rows Done (repeats across releases)
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Store Timeline in recurrenceSpec `{ trigger:'timeline', timelineProject, timelineMilestone, timelineOffset, scheduleTime }`
- [x] Force lane=jira_sheet; hide calendar repeat; push-only (match scheduled messages)
- [x] Mapper writes empty Schedule_Date + Timeline_* so GAS classify as Timeline
- **Status:** complete

### Phase 3: Implementation
- [x] Draft/spec helpers + hydrate/label
- [x] Sheet mapper round-trip
- [x] Task Center editor UI
- [x] Docs
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Unit tests (schedule + mapper + levels)
- [x] webpack compile
- [x] verify:task-center-ui including Timeline path
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize in Chinese
- **Status:** complete

### Phase 6: Agent / 帮我做 Timeline
- [x] Show Timeline trigger on Scheduled Messages 帮我做 (AgentTask)
- [x] Show Timeline trigger on Task Center Agent 任务; keep spec when switching push↔agent
- [x] Mapper/docs/tests cover AgentTask + empty Schedule_Date + Timeline_*
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Timeline is L2 / ☁️ only | Release dates come from Timeline Sync cache; 🏠 cannot resolve next FF |
| Agent / 帮我做 also gets Timeline | User asked; GAS already matches AgentTask Timeline rows and never marks them Done; `/agent-tasks/execute` uses a per-minute executionKey so later releases get a new run |
| No Repeat_Every on Timeline rows | GAS `determineMessageType` treats empty date + milestone as Timeline; calendar repeat stays a separate mode |
| Same-row stay-Active is the repeat | Do not clone ledger occurrences; Sheet/Jira re-hits each new version's milestone; ☁️ ledger action stays queued (due-scan skips jira_sheet) |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| UI check hung on 已保存 after Timeline save | 1 | L2 sheetId makes upsert wait on Google OAuth; assert POST payload instead of toast |
