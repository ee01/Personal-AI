# Project Dashboard Immutable Task Order Plan

## Target

- Selected feature: `项目面板` / Project Dashboard from `docs/features/index.md`.
- Source docs: `docs/features/project_dashboard_usage_guide.md` and `docs/features/brain_like_project_analysis_system.md`.
- Reminder scan: AppleScript missed `Personal AI`; EventKit found 4 items, all completed and unrelated to Project Dashboard.

## External scan

- Jira dashboards expose configurable gadgets for unresolved issues, progress charts, filters, road maps, and burndown-style project views. That reinforces that a project dashboard should keep progress and bottlenecks visible without changing source data during display.
- Linear project updates pair a health indicator with deeper status, challenges, next steps, update history, and staleness cues. That supports keeping Project Dashboard's state/review summaries as readable projections over stable project data.
- Dashboard HCI research on data quality and mismatched expectations warns that users need help verifying dashboard information. Render-time data mutation would make verification harder because the local JSON order could change without an explicit user action.
- Dashboard evaluation research frames dashboards around task performance, interaction workflow, and system implementation. This run focuses on system implementation hygiene that preserves predictable interaction workflow.

## Plan

1. Add a shared timeline task sorting helper that returns a new sorted array and never mutates the input task list.
2. Route Project Dashboard timeline, drag, resize, vertical placement, and card render sorting through the helper.
3. Add a targeted regression case to `verify:project-dashboard` proving sorted task views leave the original task array untouched.
4. Update canonical feature docs with the immutable view-sorting boundary.
5. Verify with targeted script, first successful `npm start` compile, Project Dashboard E2E, and scoped `git diff --check`.
