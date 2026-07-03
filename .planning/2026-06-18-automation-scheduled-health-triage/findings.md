# Findings

## Repo Findings

- `docs/features/index.md` random target after reroll: `队列健康提示` under `Scheduled Messages`.
- Reminders app is reachable, but local list names do not include `Personal AI`; no Reminder items can be inspected or completed.
- Existing queue health already supports congested explicit-time slots, no-time 08:00 queues, expired execution windows, invalid times, one-click recovery, failure receipts, and E2E coverage.
- UX gap: the top health banner lists detailed issue rows, but lacks a compact triage summary that tells the user how many rows can be fixed now, how many require manual editing, and which item should be handled first.

## External Research

- Microsoft Power Automate monitoring guidance emphasizes that automations are not set-and-forget; monitoring should expose run history, failures, performance, and actionable troubleshooting.
- Google Apps Script quotas can throw exceptions and stop execution when limits are exceeded, so scheduled-message health UI should preserve concrete failure and recovery boundaries rather than implying guaranteed delivery.
- Databricks Jobs surfaces owner, last run result, run history, task status, metrics, alerts, and workflow health dashboards; this supports showing health summaries and action targets in one place.
- CSCW 2024 research on AI-powered reminders shows people incorporate reminders differently and benefit when forgotten tasks are surfaced in a workflow-aligned way; a low-friction triage summary fits that direction better than adding more required review states.

## Design Decision

Add an information-only triage strip above the existing issue list. It will not change scheduling logic or write behavior. It should summarize:

- priority target
- one-click recoverable count
- manual-review count
- write/send boundary
