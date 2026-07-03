# Rehearsal empty filter receipt plan

## Target

- Feature: `Rehearsal 管理页`
- Source doc: `docs/features/rehearsal.md`
- Runtime surface: `memory-exploring.html#/rehearsals`

## Finding

The page already explains list scope, card readiness, scenario readiness, action receipts, and deep-link failures when there are visible rows. When a status filter or search returns zero rows, the page collapses to a generic empty line. As a user, that makes a successful empty read look too similar to a service failure or a hidden state change.

Targeted API verification also exposed a Rehearsal contract bug: stale / expired rehearsals were capped to `p2` in `RehearsalActivationService`, but later context-recall rerank, cue compilation, and lens presentation stages could promote them back to `p1`. The fix must preserve the stale weak-prompt ceiling through the final returned match.

## External scan

- Apple Reminders, Todoist, and Microsoft To Do all separate reminder filters/lists from the reminder execution itself; empty filtered views should not imply reminders were deleted or executed.
- Prospective-memory and context-aware reminder research emphasize cue-action binding quality and interruptibility, so an empty management view should explain the read scope and recovery path instead of encouraging status changes from uncertainty.
- TriggerBench-style prospective-memory evaluations highlight false positives and misses as core risks; the management page should keep "not visible in this filter" distinct from "not eligible to trigger".

## Implementation steps

1. Add an `空筛选回执` state to `RehearsalsPage.vue` when list loading succeeds with zero rows.
2. Show current status/search scope, visible count, boundary, and recovery actions.
3. Add `查看 All`, `清空搜索`, and `刷新` handlers without mutating Rehearsal status or feedback.
4. Extend `tools/verify-rehearsals-page-e2e.mjs` to assert the empty-filter receipt and recovery.
5. Update `docs/features/rehearsal.md` with concise current behavior and validation notes.
6. Keep stale Rehearsal matches capped at `p2` after context rerank, cue compilation, and lens presentation.

## Verification

- `node --check tools/verify-rehearsals-page-e2e.mjs`
- `npm start -- --progress` until first successful compile, then stop
- `node tools/verify-rehearsals-page-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts`
- scoped `git diff --check`
