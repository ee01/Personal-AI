# Task Scheduler Status API Improvement Plan

Goal: improve the randomly selected `Task Scheduler 状态 API` feature by checking current docs against code, doing a small outside product/paper scan, identifying one low-decision UX/code issue, implementing it narrowly, and validating it through the repo harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, memory hints, and local Reminder list state |
| 2 | completed | Inspect Task Scheduler docs, source, UI paths, tests, and current dirty-worktree scope |
| 3 | completed | Search current product/docs and paper references for task scheduler status, automation run history, and recovery/debug cues |
| 4 | completed | Lock a concrete improvement plan and implement the smallest useful slice |
| 5 | completed | Update canonical feature docs and focused verification coverage |
| 6 | completed | Run targeted tests, first successful `npm start` compile, relevant E2E, i18n, diff checks, and process cleanup |
| 7 | completed | Update automation memory and summarize Reminder status plus validation evidence |

## Decisions

- Selected feature: `Task Scheduler 状态 API`.
- Source doc: `docs/features/task_scheduler_api.md`.
- Reminder result: Reminders is readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done in this run.
- Existing worktree is heavily dirty before this run. Keep edits scoped to Task Scheduler code/docs/verifiers and this plan directory.
- Implementation slice: expose digest queue status sub-read failures as a visible Task Scheduler refresh/row receipt, without changing alarm scheduling, task execution, queue release, or notification behavior.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Ruby `alarm` unavailable | Reminder probe | Retried with a Perl alarm wrapper; Reminders was readable and confirmed `NO_PERSONAL_AI_LIST` |
