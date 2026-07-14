# Task Scheduler header toggle pending receipt

## Target

- Feature: `Task Scheduler 状态 API`
- Source doc: `docs/features/task_scheduler_api.md`
- Surface: popup top `message_analysis` schedule toggle and background task panel

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Recent automation memory already covered Decision Center, Topic mute, Snooze, Jira Automation, Relationship Radar, AR Data, Doubao, Coverage, Reflection, Action Queue, Evidence Watch, Native Join, Ask, Agent Workflow, Skill Foundry, Compose Assist, Project Dashboard, Meeting Pilot, Message Analysis, Notification Center, Today Pilot, Rehearsal, and related surfaces, so this run selected Task Scheduler.
- AppleScript listed local Reminder lists without `Personal AI`; EventKit found `Personal AI` with 4 completed historical Doubao / Notification / test items and no open Task Scheduler feedback.

## External scan

- Temporal Web UI and workflow event history keep current execution state, metadata, and event history visible for debugging rather than flattening a workflow into a switch.
- Apache Airflow Grid View emphasizes recent run state, failure visibility, retry/debug actions, and at-a-glance monitoring.
- GitHub Actions workflow runs API separates queued, in-progress, completed, skipped, failure, and related states, reinforcing that pending and final states should not be conflated.
- Automation transparency research supports making automation responsibilities, activity, and effects directly observable so users do not over-trust a disabled control or spinner.

## Improvement plan

1. Add a compact pending receipt below the popup header toggle when the top `message_analysis` schedule switch request is in flight.
2. Reuse the existing pending action semantics where possible, but make the receipt visible even when the background task panel is collapsed.
3. State the boundary explicitly: the page still reflects the last confirmed state; the request has not run the task, confirmed a Chrome alarm, changed the next-run time, or cleared history yet.
4. Update the existing Task Scheduler popup E2E to delay the top toggle response and assert pending -> confirmed behavior.
5. Update the canonical feature doc and index with a concise behavior note.

## Verification

- `node --check tools/verify-task-scheduler-popup-filters-e2e.mjs`
- `npm run verify:task-scheduler-api`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:task-scheduler-popup-filters:e2e`
- Scoped `git diff --check`
