# Task Plan: Roadmap 团队范围（日志 + 团队列表）

## Goal
协作同步 ticker / 活动日志只展示当前选中团队；团队下拉只列出本机已知团队（只读项带眼睛 icon）；查清 08/14 两条「更新了发布时间表标尺」日志实际做了什么。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm current activity/ticker/team-list behavior
- [x] Query production logs for patricia.li / sophia.lin
- [x] Confirm edit-token storage (localStorage, not cross-device)
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Decide known-teams localStorage + server `?ids=` filter
- [x] Decide ticker noise for silent release-sheet refresh
- **Status:** complete

### Phase 3: Implementation
- [x] Server `listTeams(ids)` empty-by-default + `?ids=`
- [x] Client known-teams localStorage + filter dropdown + eye icon
- [x] Harden activity to current team; ticker skip silent ruler refresh
- [x] Demo + docs
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Backend listTeams tests
- [x] pickTickerEntry + known-teams helper tests
- [x] Run vitest — 117 passed
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize log investigation + token storage advice in Chinese
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Known teams + edit tokens stay in page localStorage | Matches current auth (share token); extension does not store tokens |
| `GET /api/v1/teams?ids=` returns only requested ids; no ids → `[]` | Stops leaking all team names/JQL |
| Visiting `?team=` (with or without token) remembers that team | Read-only join via URL still works |
| Seed known-teams from existing `roadmap-edit-token:*` keys | Existing editors keep their teams after deploy |
| Silent `update_release_sheet` (not cleared) is ticker noise | Those two logs were 6h sheet re-fetch, not a config change; panel still shows them |
| Eye icon = no local edit token | Same signal as topbar 「只读」 |

## Errors Encountered
| Error | Resolution |
|-------|------------|
