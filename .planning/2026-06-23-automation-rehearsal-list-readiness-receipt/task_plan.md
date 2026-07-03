# Automation Rehearsal List Readiness Receipt Plan

## Goal

Improve the randomly selected `未来场景预演记忆` / Rehearsal feature by making list-level prompt eligibility and future-cue coverage visible before users open a detail pane.

## Context

- `docs/progressing/to-verify.md`: no carry-over item.
- Random target: `未来场景预演记忆` in `docs/features/rehearsal.md`.
- Reminder check: Reminders is reachable, but there is no `Personal AI` list on this machine.
- External scan: Apple Reminders, ChatGPT Tasks, context-aware reminders, and implementation-intention research all reinforce cue-action binding and clear inactive/paused/not-executed boundaries.
- Current implementation already has detail-level readiness, diagnostics, deep-link failure, and action receipts.

## Plan

1. Inspect Rehearsal docs, source, and current verification scripts.
2. Add a compact list-card readiness receipt that summarizes prompt eligibility, cue coverage, and non-execution boundary.
3. Update the Rehearsal E2E fixture/assertions to prove active, stale, and cue-less rows show the correct list-level state.
4. Update `docs/features/rehearsal.md` with the list-level behavior and latest research note.
5. Run targeted checks: syntax, memory-service Rehearsal tests, `npm start` first compile, Rehearsal page E2E, scoped `git diff --check`, and process cleanup.

## Status

- [x] Phase 1: Context, Reminder, and research collected.
- [x] Phase 2: Implement list-card readiness receipt.
- [x] Phase 3: Update docs and E2E coverage.
- [x] Phase 4: Run validation and close out.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `RecallEngine` embedding warning in Rehearsal API tests | `npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts` | Expected test mock path; tests passed and vector channel was intentionally unavailable. |
| `ReflectionThreadService` local research warning | `npm --prefix memory-service test -- --run src/__tests__/reflectionThreadService.test.ts` | Expected failure-path fixture; tests passed. |
