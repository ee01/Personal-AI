# Task Plan: Continue Task Center unfinished work

## Goal
把任务中心尚未接线的双 lane 同步补上（任务中心 ↔ Sheet 镜像），并补一小步 Phase 3 收件箱，同时列出必须用户动手的事项。

## Current Phase
Delivery complete

## Phases

### Phase 1: Requirements & Discovery
- [x] List user-required ops vs implementable gaps
- [x] Confirm P0 is Sheet mirror (forward + reverse), not Phase 4 / OpenClaw
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Pure mapper between ledger tasks and ScheduledMessage rows
- [x] Extension syncer uses Google token; backend only stores mirror_ref
- [x] Pause/delete of ☁️ tasks must write Sheet, otherwise Jira still fires
- **Status:** complete

### Phase 3: Implementation
- [x] Mapper + unit tests
- [x] Backend: mirrorRef PATCH, mirrorRequired when already mirrored, reusable key includes paused
- [x] Extension syncer + background + Task Center UI
- [x] Reverse register from Scheduled Messages / Glip / AR create
- [x] Inbox chip + reflection title fold
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Mapper tests
- [x] api-task-center tests
- [x] webpack compile
- [x] verify:task-center-ui
- **Status:** complete

### Phase 5: Delivery
- [x] Tell the user what they must do vs what landed
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Do not start Phase 4 (Sheet read-only / GAS DOMAIN) | Needs the user's cutover call; ☁️ 24/7 independence is at stake |
| Do not build intent-fragments / OpenClaw plugin this round | Needs running OpenClaw + user channel decisions |
| Credential MS→Sheet push is listed as user-ops | Redeploying Jira rules is blocked by domain policy |
| Glip compose without L2 writes 🏠 ledger | Matches L0 promise; with L2 keep writing Sheet |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|          | 1       |            |
