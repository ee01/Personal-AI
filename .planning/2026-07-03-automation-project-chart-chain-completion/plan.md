# Project Chart Dependency Chain Completion Plan

## Target

- Feature: `甘特图 / 依赖图 / 燃尽图`
- Canonical doc: `docs/features/project_dashboard_usage_guide.md`
- Main source: `src/utils/dashboardIntegration.ts`, rendered by `src/components/dashboard/ProjectDashboard.tsx`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory showed recent sweeps for Agent Workflow, Memory Lens selection search, and broader Project Dashboard data-source checks, so this run keeps to the chart overview subfeature.
- Local Reminders: AppleScript did not list `Personal AI`; EventKit found `Personal AI` with 4 items, all completed historical Doubao / digest / sync feedback. No open Project Dashboard or chart-related Reminder item was incorporated.

## External Scan

- Microsoft Planner critical path and Linear dependencies both put dependency chains directly next to timeline/project graph views.
- Linear Project Graph and Jira / Agile burndown docs keep completion/progress graphs tied to actual issue/task data rather than treating charts as independent predictions.
- Gantt visualization research emphasizes that Gantt views support dependency and temporal lookup tasks, but at scale they need details-on-demand and clear task-level provenance.

## Improvement Plan

1. Keep the current local-only chart summary model: no Jira/GitHub/Confluence reads, no Memory Service writes, no schedule changes.
2. Add dependency-chain completion context when the longest local dependency chain includes completed upstream tasks.
3. Surface that context in the dependency card metric and critical-chain driver detail so the user knows part of the chain is historical, not active pending work.
4. Update focused verifier coverage and feature docs.

## Verification Plan

- `npm run verify:project-dashboard`
- `npm start -- --progress`, stop after first successful compile
- `node tools/verify-project-dashboard-e2e.mjs`
- scoped `git diff --check`
