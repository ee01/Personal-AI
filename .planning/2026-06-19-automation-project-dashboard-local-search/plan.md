# Project Dashboard Local Search Plan

## Target

- Random feature: `项目面板` / Project Dashboard from `docs/features/index.md`.
- Scope: current browser-local Project Dashboard list filtering and navigation only.

## Current Finding

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is reachable, but there is no `Personal AI` list on this machine, so no Reminder item can be incorporated or completed.
- The current dashboard already has health-view filters, evidence queues, review queues, data-source receipts, and chart receipts, but no local search across projects/tasks/Jira/platform evidence.

## External Signals

- Atlassian Home Dashboard Insights summarizes dashboards into notable insights and anomalies, but also states AI reliability can vary and some widgets are not analyzed.
- Linear project updates keep health, progress, update history, reminders, staleness, and filters close to project review workflows.
- Dashboard UX research highlights data quality, mismatched expectations, and user-tailored dashboard needs.
- Project risk research supports activity-level risk attention rather than only project-level status.

## Plan

1. Add a small local search helper for Project Dashboard projects.
2. Search project name/description, task title/description/status/ETA, Jira key/title, platform status/owner/Jira, and milestone label/date.
3. Add a search control beside existing project-view filters, with a visible result/boundary receipt and clear action.
4. Update Project Dashboard docs to describe local-only search and its non-sync boundary.
5. Verify with targeted utility tests, webpack dev compile, Project Dashboard E2E, and scoped diff check.
