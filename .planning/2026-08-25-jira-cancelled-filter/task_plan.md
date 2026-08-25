# Task Plan: Jira Cancelled Filter

## Goal
Backend Progress 与 Design Links 完全不展示 Cancelled 状态 ticket，并解释 MTR-141170 上 RCV-141220 缺失原因。

## Current Phase
Phase 5: Delivery

### Phase 3: Implementation
- [x] Add `isCancelledJiraStatus` and filter in design/backend prepare
- [x] Skip cancelled during collection/append
- [x] Update docs/index and feature docs
- [x] Update unit + e2e fixtures
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Unit + e2e passed
- [x] Live MTR-141170 shows RCV-141220, hides cancelled
- **Status:** complete

### Phase 5: Delivery
- [x] Auto-commit owned files
- [x] Pushed to origin/develop
- **Status:** complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm 5-item cap and closed-prefer ranking
- [x] Confirm cancelled tickets occupy parent_child slots on MTR-141170
- [x] webpage-mcp unavailable; proceed from screenshot + code
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Filter cancelled at display prepare time (and skip collection fetches)
- [x] Keep Closed/Done prefer for remaining tickets
- [x] Update docs + verify scripts + e2e
- **Status:** complete

### Phase 3: Implementation
- [ ] Add `isCancelledJiraStatus` and filter in design/backend prepare
- [ ] Skip cancelled during collection/append
- [ ] Update docs/index and feature docs
- [ ] Update unit + e2e fixtures
- **Status:** in_progress

### Phase 4: Testing & Verification
- [ ] Run verify-jira-design-links and verify-jira-backend-progress
- [ ] Run e2e after dist rebuild
- **Status:** pending

### Phase 5: Delivery
- [ ] Auto-commit owned files
- **Status:** pending

## Key Questions
- Should Won't Do / Rejected / Duplicate also hide? Yes — existing cancelled tone.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| webpage-mcp discovery failed | 1 | AppleScript/code-path investigation |
