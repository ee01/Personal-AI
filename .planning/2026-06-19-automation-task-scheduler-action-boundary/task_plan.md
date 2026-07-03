# Task Scheduler Action Boundary Plan

## Goal

Improve `Task Scheduler 状态 API` UX by making pre-click task action side effects visible in the popup before the user clicks run, repair, pause, or enable.

## Target

- Random feature: `Task Scheduler 状态 API`
- Source doc: `docs/features/task_scheduler_api.md`
- Main UI/code: `src/popup.tsx`
- Verification: `verify:task-scheduler-api`, `verify:task-scheduler-status-filters`, `npm start`, `verify:task-scheduler-popup-filters:e2e`, scoped `git diff --check`

## Plan

1. [complete] Capture current state, reminders, and external references.
2. [complete] Add a visible per-row `操作范围` / `Action scope` line in the Task Scheduler popup.
3. [complete] Update E2E checks to assert failed, skipped/disabled, normal, and English action-scope copy.
4. [complete] Update `docs/features/task_scheduler_api.md` with concise behavior and references.
5. [complete] Run validation and close out automation memory.

## Constraints

- Worktree is already dirty with many unrelated changes; keep the diff scoped.
- Local Reminders list is reachable, but there is no `Personal AI` list.
- Preserve existing post-action receipts and status receipts.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| None yet | - | - |
