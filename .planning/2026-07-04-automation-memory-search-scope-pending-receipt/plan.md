# Task Plan: Memory Search Scope Pending Receipt

## Goal
Improve the `工作/个人/全部范围语义` feature so Memory Exploring search keeps the requested scope visible while a new scoped search is pending, without changing Memory Service recall, ranking, or feedback behavior.

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, feature index, automation memory, memory workflow notes, and `docs/progressing/to-verify.md`.
- [x] Randomly sample `docs/features/index.md` and select the first eligible non-fresh target.
- [x] Check Reminders via AppleScript and EventKit fallback.
- [x] Inspect Memory Search scope docs, UI, presentation helpers, and E2E/static verifier.
- **Status:** complete

### Phase 2: Research & UX Decision
- [x] Review current product references for memory/search scope and permission transparency.
- [x] Review RAG trust/transparency papers.
- [x] Choose one bounded UX improvement.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a pending scope receipt when switching work/personal/all starts a new search while old results may still be visible.
- [x] Keep the change presentation-only; do not alter recall/write/feedback APIs.
- [x] Update docs and verifiers.
- **Status:** complete

### Phase 4: Verification
- [x] Run `npm run verify:memory-search-results`.
- [x] Run `npm start -- --progress` until first successful compile, then stop it.
- [x] Run `npm run verify:memory-search-scope:e2e`.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [x] Update progress and automation memory.
- [x] Mark related Reminder item done only if an open related item exists.
- [x] Summarize touched files and validation.
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `工作/个人/全部范围语义` in `docs/features/memory_system.md` | Random sample first eligible target after skipping recent exact/family automation targets. |
| Add a pending receipt instead of backend scope changes | The risk is user perception during scope switching, not recall correctness. |
| Keep results visible while labeling them stale/pending | Avoids layout churn and preserves prior evidence while making the current request boundary explicit. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| AppleScript check for `Personal AI` list returned absent | 1 | EventKit fallback found the list and all items were completed/unrelated. |
| Root `task_plan.md` is stale from an older Scheduled Messages run | 1 | Use this isolated `.planning/` directory for the active run. |
