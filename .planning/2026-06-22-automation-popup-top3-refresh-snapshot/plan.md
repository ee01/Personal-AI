# Popup Top 3 Refresh Snapshot Plan

Goal: improve the randomly selected `Popup Top 3` feature so its docs match current behavior, external references inform the UX, and a focused no-decision improvement is implemented and verified.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, `docs/progressing/to-verify.md`, feature index, worktree state, and Reminders list names |
| 2 | completed | Select a non-recent random feature from `docs/features/index.md` and inspect current docs/code/verifiers |
| 3 | completed | Search current industry product references and related research for daily brief / proactive summary UX |
| 4 | completed | Implement a focused Popup Top 3 refresh-failure snapshot receipt |
| 5 | completed | Update feature docs and verifier/E2E assertions |
| 6 | completed | Run targeted verifier, dev compile, popup E2E, scoped diff check, and watcher cleanup |
| 7 | in_progress | Update automation memory, handle Reminder/archive bookkeeping, and summarize |

## Decisions

- Selected feature: `Popup Top 3` under Today Pilot.
- Source doc: `docs/features/today_pilot.md`.
- Primary implementation: `src/popup.tsx`.
- Existing local Reminders list names do not include `Personal AI`; no Reminder item can be incorporated or marked done.
- Worktree is already broadly dirty. Keep this run scoped to Popup Top 3 docs/code/verifier/E2E plus this planning directory and automation memory.
- Improvement slice: when a manual popup refresh fails after a successful brief is already visible, keep the last Top 3 snapshot visible and replace the first receipt with an explicit stale-refresh receipt. Initial load failure still shows degraded unavailable state.

## Verification Plan

- `npm run verify:day-pilot-home`
- `npm start` until first successful webpack compile, then stop
- `npm run verify:today-pilot-home:e2e`
- `git diff --check -- src/popup.tsx docs/features/today_pilot.md tools/verify-day-pilot-home.ts tools/verify-today-pilot-home-e2e.mjs .planning/2026-06-22-automation-popup-top3-refresh-snapshot/plan.md .planning/2026-06-22-automation-popup-top3-refresh-snapshot/findings.md .planning/2026-06-22-automation-popup-top3-refresh-snapshot/progress.md`
- Check for lingering webpack/E2E processes

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` belongs to an old Scheduled Messages run | Planning restore | Use an isolated `.planning/2026-06-22-automation-popup-top3-refresh-snapshot/` plan instead of editing the old root files |
| No `Personal AI` Reminders list | AppleScript list scan | Record absence and skip item-level Reminder work |
