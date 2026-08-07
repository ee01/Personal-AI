# Task Plan: Topic Messages Defer Return Receipt

## Goal
Improve `主题稍后处理` so users can understand when a locally deferred unread topic will return, without adding new backend API scope.

## Current Phase
Complete

## Phases

### Phase 1: Discovery, Reminder Check, and Research
- [x] Read automation memory and avoid recent feature targets
- [x] Check `docs/progressing/to-verify.md`
- [x] Check local Reminders for a `Personal AI` list
- [x] Randomly select a non-recent feature from `docs/index.md`
- [x] Inspect Topic Messages defer code and tests
- [x] Record external product and paper research in `findings.md`
- **Status:** complete

### Phase 2: Improvement Plan
- [x] Compare current docs to code
- [x] Identify a low-decision defect or UX gap
- [x] Decide the implementation boundary
- **Status:** complete

### Phase 3: Implementation
- [x] Update Topic Messages source code
- [x] Update targeted verifier and E2E coverage
- [x] Update `docs/features/topic_based_messages.md`
- **Status:** complete

### Phase 4: Testing and Verification
- [x] Run `npm run verify:topic-based-messages`
- [x] Run `npm start` until first successful development compile, then stop it
- [x] Run `npm run verify:topic-based-messages:e2e`
- [x] Run `git diff --check`
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with selection, research, files, validation, and run time
- [x] Report Reminder outcome and validation evidence
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Selected `主题稍后处理` under Topic Messages | Random sampler picked it from feature docs not recently covered by automation memory. |
| Keep scope frontend/local-state only unless code proves otherwise | Current docs say defer is browser-local and backend read-status APIs are still a future improvement. |
| Show deferred state persistently in Topic detail | After the 10-second toast expired, detail view hid the fact that this unread topic had been removed from the unread flow. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
