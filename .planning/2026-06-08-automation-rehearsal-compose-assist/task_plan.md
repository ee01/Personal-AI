# Rehearsal Compose Assist Improvement Plan

Goal: improve the randomly selected `回复助手预演提醒` feature by confirming the current doc/code contract, incorporating relevant external product and research signals, checking local Reminder feedback when available, then implementing a focused low-decision UX/code improvement with full practical verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, repo rules, carry-over queue, feature index, prior planning context, and local Reminder list state |
| 2 | completed | Inspect Rehearsal and Compose Assist docs, source paths, message contracts, tests, and current dirty worktree scope |
| 3 | completed | Search current product and paper references for rehearsal/prospective-memory cues in writing assistants |
| 4 | completed | Write the concrete improvement plan and decide the smallest no-extra-decision implementation slice |
| 5 | completed | Implement selected code/docs/UX changes while preserving unrelated dirty files |
| 6 | completed | Run targeted verification, dev extension compile, relevant E2E, and diff checks |
| 7 | completed | Update Reminders if applicable, write automation memory, and summarize outcome |

## Decisions

- Selected feature: `回复助手预演提醒`.
- Feature family: Compose Assist / Rehearsal.
- Source doc from index: `docs/features/rehearsal.md`.
- Reminder scan found no visible `Personal AI` list, so there are no local Reminder items to incorporate or complete unless another source appears.
- The worktree is broadly dirty before this run. Keep edits tightly scoped to Rehearsal/Compose Assist feature files plus this planning and automation memory.
- Existing implementation already forces Rehearsal-backed suggestions into preview and records structured negative feedback, but the visible thumb-down receipt is generic.
- Selected implementation slice: make the Compose Assist thumb-down receipt Rehearsal-aware, saying the prehearsal-backed suggestion was hidden and will be downgraded for the same scene while the current surface also becomes more conservative.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root `task_plan.md` belongs to a prior Scheduled Messages run | Initial planning-file restore | Use a new isolated plan under `.planning/2026-06-08-automation-rehearsal-compose-assist/` and set it active |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion for this run |
