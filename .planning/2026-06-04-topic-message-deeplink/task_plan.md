# Task Plan: Topic Message Deep Link Sweep

## Goal
Improve the randomly selected `主题详情深链定位` feature by reconciling docs/code, checking external product and research references, incorporating local Reminder feedback when available, implementing one focused low-decision fix, and validating the result.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read automation memory, repo rules, feature index, and planning state
- [x] Randomly select a feature from `docs/index.md`
- [x] Check local Reminders `Personal AI` list
- [x] Inspect Topic Messages docs, code, tests, and current dirty diffs
- **Status:** complete

### Phase 2: External Product And Research Scan
- [x] Search product references for message permalinks and highlighted deep links
- [x] Search research references for triage, short-message/topic context, and deferral implications
- **Status:** complete

### Phase 3: Concrete Improvement Plan
- [x] Choose a no-user-decision improvement slice
- [x] Scope edits to Topic Messages deep-link compatibility and docs
- **Status:** complete

### Phase 4: Implementation
- [x] Make deep links work when the parent conversation lacks a stable ID but a context message has one
- [x] Accept common snake_case/import-style message identity fields in Topic detail, unread preview, and read-sync matching
- [x] Update feature docs with the new compatibility boundary
- **Status:** complete

### Phase 5: Testing & Verification
- [x] Run `npm run verify:topic-based-messages`
- [x] Run `npm start` until the first successful dev compile
- [x] Run `npm run verify:topic-based-messages:e2e`
- **Status:** complete

### Phase 6: Reminder And Delivery
- [x] Mark completed related Reminder items done, if a `Personal AI` list appears
- [x] Update automation memory
- [x] Summarize outcome
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `主题详情深链定位` | Randomly selected from `docs/index.md`. |
| No Reminder incorporation | Reminders exposed lists such as `We`, `Next actions`, and `Tasks`, but no visible `Personal AI` list. |
| Improvement slice: deep-link identity fallback | It fixes a concrete navigation blocker without changing product policy or adding review burden. |
| Preserve unrelated dirty worktree | Current repo has broad pre-existing modifications; keep this run scoped to Topic Messages and automation/planning files. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| `$CODEX_HOME` was empty in shell | Used `/Users/Esone/.codex/automations/automation/memory.md`, matching the provided automation path and existing file. |
| No visible `Personal AI` Reminders list | Recorded the absence and skipped Reminder completion. |
| First E2E run had a strict locator collision between a read-sync toast and the conversation summary | Narrowed the assertion to `.conversation-summary` before rerunning. |
