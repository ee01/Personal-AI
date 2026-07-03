# Rehearsal Stale Weak Prompt Plan

Goal: improve the randomly selected `场景预演边界` feature by making stale Rehearsal matches honor the documented weak-prompt boundary, then update docs and verify the user-visible contract.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo rules, feature index, automation memory, local Reminders list state, and current dirty worktree scope |
| 2 | completed | Inspect Rehearsal docs, backend activation/scoring code, API tests, and page E2E harness |
| 3 | completed | Search current product/paper references for context-aware reminders and prospective memory cue-action boundaries |
| 4 | completed | Implement the smallest no-extra-decision fix: cap stale Rehearsal matches to weak prompt priority and expose the stale boundary in match reasons |
| 5 | completed | Update canonical Rehearsal docs and this run's findings/progress |
| 6 | completed | Run targeted API tests, dev compile, Rehearsal page E2E, and scoped whitespace checks |
| 7 | completed | Update automation memory, attempt archive if available, and summarize outcome |

## Decisions

- Selected feature: `场景预演边界` under Rehearsal.
- Source doc: `docs/features/rehearsal.md`.
- Reminder state: Reminders is readable, but there is no visible `Personal AI` list on this machine, so no Reminder item is incorporated or completed.
- Scope control: the worktree is already broadly dirty; touch only Rehearsal backend/tests/docs plus this planning directory and automation memory.
- Implementation slice: stale Rehearsals may still match exact scene cues, but they should never become `p1`; they should show as `p2` weak prompts with an explicit stale reason.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion |
| Existing root planning files describe an old Scheduled Messages task | Planning context restore | Create this isolated `.planning/2026-06-15-automation-rehearsal-stale-weak-prompt/` plan and leave root planning files untouched |
| `tsc` inferred stale display priority as plain string | First `npm --prefix memory-service run build` | Added an explicit `ContextRecallDisplayPriority` annotation |
