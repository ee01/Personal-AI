# Rehearsal Management Evidence Boundary Plan

## Goal
Improve `Rehearsal 管理页` by keeping the docs/code aligned, incorporating Reminder and external-product/research context, then implementing one bounded UX fix with repo-native verification.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read `AGENT.md`, automation memory, memory guidance, feature index, and `docs/progressing/to-verify.md`
- [x] Confirm no carry-over item exists and select `Rehearsal 管理页`
- [x] Check local Reminders through AppleScript and EventKit fallback
- **Status:** completed

### Phase 2: Code, Docs, And Research
- [x] Inspect `docs/features/rehearsal.md`
- [x] Inspect `src/modals/components/RehearsalsPage.vue`
- [x] Inspect `tools/verify-rehearsals-page-e2e.mjs`
- [x] Run a small external product/research scan
- **Status:** completed

### Phase 3: Implementation
- [x] Add source-evidence row hover/read-screen boundaries without changing data or actions
- [x] Extend Rehearsal page E2E assertions for the evidence-row boundary
- [x] Update concise feature docs/index wording
- **Status:** completed

### Phase 4: Testing & Verification
- [x] Run syntax check for the updated E2E script
- [x] Run `npm start`, wait for first successful compile, then stop it
- [x] Run the Rehearsal page E2E verifier
- [x] Run scoped `git diff --check`
- **Status:** completed

### Phase 5: Closeout
- [x] Confirm no related Reminder item needs completion
- [x] Update automation memory
- [x] Summarize implementation, verification, and external references
- **Status:** completed

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected feature: `Rehearsal 管理页` | Random sample candidate that is not one of the freshest automation targets and has a real user-facing management/recovery path |
| Scope: evidence-row boundary labels | The page already covers list, deep-link, action, failure, cue-edit, and card boundaries; source evidence rows still expose only raw refs and lack a reader-facing audit boundary |
| No lifecycle/API changes | The issue is presentation/accessibility clarity, not matching, feedback, Rehearsal state transitions, or Memory Service behavior |
| No Reminder item incorporated | EventKit found `Personal AI` with 4 total items and 0 incomplete items; completed items are unrelated Doubao/test/notification history |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Root `task_plan.md` is stale from an older Scheduled Messages run | Created isolated `.planning/2026-07-15-automation-rehearsal-management-page-rec/` |
| AppleScript did not list `Personal AI` | Used EventKit fallback, which found the list and confirmed 0 incomplete items |
| `docs/index.md` already had unrelated dirty edits from prior automation runs | Left unrelated lines untouched and treated only the Rehearsal row wording as owned by this pass |
