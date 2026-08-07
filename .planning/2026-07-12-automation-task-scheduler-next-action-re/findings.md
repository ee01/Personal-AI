# Findings & Decisions

## Requirements
- Follow the recurring `docs/index.md` sweep: choose one feature, verify docs against code, research comparable products/papers, find and implement a low-decision improvement, update docs, run strong focused validation, and close relevant Reminders.
- Source feature: `Task Scheduler 状态 API` in `docs/features/task_scheduler_api.md`.
- Relevant source files found so far: `src/popup.tsx`, `src/services/TaskScheduler.ts`, `src/services/taskSchedulerDefinitions.ts`, `tools/verify-task-scheduler-api.ts`, and `tools/verify-task-scheduler-popup-filters-e2e.mjs`.

## Research Findings
- `docs/progressing/to-verify.md` is empty.
- Automation memory shows today's latest exact/family targets were Google Slides Analyzer, Decision Center, Scheduled Messages, Ask, Native Join, Memory Lens, Meeting Panorama, safe-link/search/timeline, Rehearsal, Message Analysis, and backup work. Those were avoided.
- Older Task Scheduler runs already implemented status receipts, refresh calibration detail, header toggle pending receipt, collapsed attention preview, and button-level task action title/ARIA boundaries.
- AppleScript listed Reminder lists but omitted `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items. All items are completed historical Doubao/notification/test feedback and unrelated to Task Scheduler.
- Current code already has rich Task Scheduler receipts in `src/popup.tsx`: refresh pending/failure receipts, action receipts, task-row status receipts, action boundaries, and button-level `title` / `aria-label`.
- UX gap: `taskSchedulerNextStep` renders as the first expanded instruction (`.task-next-step`) but currently has no `title` or `aria-label` explaining that the next-step text is advisory only and does not itself run, pause, repair, retry, or clear history.
- Chrome Alarms docs say alarms may be delayed by sleep and persistence is browser/version-dependent, and recommend checking alarm state on service worker start; Task Scheduler's refresh/repair receipts should keep treating alarm calibration as separate from running tasks.
- Temporal Web UI groups metadata, event history, and workflow actions; this supports keeping status, history, and actions close together rather than making users jump to a separate debug page.
- GitHub Actions workflow-runs API exposes separate statuses/conclusions such as queued, in_progress, skipped, stale, failure, timed_out, and success; Task Scheduler should keep skip/failure/running/schedule attention distinct in UI.
- Zapier run-status docs distinguish errored, safely halted, on hold, needs review, running, scheduled, skipped, and successful; their troubleshooting docs route from an issue to the affected step, supporting direct next-step copy near each problematic task.
- Automation transparency research supports making responsibilities, activities, and effects visible, but also warns against assuming more transparency is always better for agent-like automation. For this popup, the better slice is hover/reader boundary at the top next-step strip, not more visible paragraphs.
- Trigger-action debugging work shows users need help diagnosing why automations did or did not run. This maps to explaining that a recommendation is not itself a run/reschedule/pause action.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use a dedicated `.planning/2026-07-12-automation-task-scheduler-next-action-re/` directory | Avoids reusing stale root planning files from an older Scheduled Messages run. |
| Treat root `task_plan.md` / `findings.md` / `progress.md` as stale prior-run artifacts | They refer to an older Scheduled Messages one-click setup run and should not steer this Task Scheduler sweep. |
| Keep visible next-step copy unchanged, add `title` / `aria-label` | Keeps the popup compact while closing the hover/focus/read-screen boundary. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Existing worktree is broadly dirty, including Task Scheduler docs/source/verifier files | Read before editing and keep changes narrowly scoped; do not revert unrelated changes. |

## Resources
- `docs/features/task_scheduler_api.md`
- `.planning/2026-07-03-automation-task-scheduler-status-receipts/task_plan.md`
- `.planning/2026-07-09-automation-task-scheduler-action-button-boundaries/task_plan.md`
- Chrome Alarms API: https://developer.chrome.com/docs/extensions/reference/api/alarms
- Temporal Web UI: https://docs.temporal.io/web-ui
- GitHub Actions workflow runs API: https://docs.github.com/en/rest/actions/workflow-runs
- Zapier run statuses: https://help.zapier.com/hc/en-us/articles/20505304170637-Review-run-statuses-in-Zap-workflows
- Zapier troubleshooting: https://help.zapier.com/hc/en-us/articles/8496037690637-How-to-troubleshoot-errors-in-Zap-workflows
- Helping Users Debug Trigger-Action Programs: https://dl.acm.org/doi/abs/10.1145/3569506
- Automation transparency design principle: https://journals.sagepub.com/doi/abs/10.1177/0018720819887252
