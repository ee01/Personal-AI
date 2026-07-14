# Project Dashboard Chart Marker Boundary Plan

Goal: improve the selected `甘特图 / 依赖图 / 燃尽图` feature by checking docs/code freshness, incorporating Reminder and external research context, then landing a scoped UX improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, feature index, automation memory, relevant memory notes, worktree state, and `docs/progressing/to-verify.md` |
| 2 | completed | Randomly select a non-recent exact feature and inspect Project Dashboard chart docs, source, and verifiers |
| 3 | completed | Check local Reminders through AppleScript and EventKit, then gather current product and research references |
| 4 | completed | Implement a bounded chart-control UX improvement without changing sync, storage, chart algorithms, or external writes |
| 5 | completed | Update docs and existing Project Dashboard verifier / E2E assertions |
| 6 | completed | Run targeted verification, first successful dev compile, E2E, and scoped diff check |
| 7 | completed | Update automation memory and close out Reminder status |

## Selected Feature

- Feature: `甘特图 / 依赖图 / 燃尽图`
- Capability: Project Dashboard
- Source doc: `docs/features/project_dashboard_usage_guide.md`
- Main source: `src/components/dashboard/ProjectDashboard.tsx` and `src/utils/dashboardIntegration.ts`
- Existing verifiers: `npm run verify:project-dashboard`, `npm run verify:project-dashboard:e2e`

## Implementation Slice

The current chart logic already exposes readiness, key drivers, actions, task-count burndown, dependency-chain limits, and non-write boundaries. The remaining gap is that the visual chart card, progress bar, and timeline markers still read like decorative or authority-backed chart objects when hovered or read by assistive technology.

Planned change: mirror the chart basis and non-effect boundary into chart card, progress bar, and marker `title` / `aria-label` text. This is presentation/accessibility-only and must not change dashboard data, chart calculations, storage, import/export, Memory Service reads, Jira/GitHub/Confluence behavior, status review, notifications, prediction, or auto-rescheduling.

## Reminder State

AppleScript listed local Reminders but did not include `Personal AI`. EventKit found `Personal AI` with 4 total items and 0 incomplete items. All items are completed historical Doubao / notification / test feedback and unrelated to Project Dashboard charts, Gantt readiness, dependency graphs, burndown charts, or chart marker boundaries. Nothing should be marked done.

## External Reference Direction

- Atlassian Advanced Roadmaps treats dependencies as view-only and separates planning views from changes to the plan.
- GitHub Projects Insights frames burn-up/burn-down style charts as progress/bottleneck visibility, not automatic project mutation.
- Linear Project Graph / Insights emphasize progress visibility and estimation context.
- Agile dashboard and burndown guidance warns that task-count burndown can mislead when scope or effort is not visible.
- Visualization research supports overview plus details-on-demand, which fits the current Project Dashboard choice to keep chart points tied to specific local tasks.

## Validation Plan

1. `npm run verify:project-dashboard`
2. `npm start -- --progress`, stop after first successful compile
3. `npm run verify:project-dashboard:e2e`
4. `git diff --check -- <touched files>`

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` exists from an old Scheduled Messages run | Planning skill context restore | Read it as historical data, then use a dedicated `.planning/2026-07-11-automation-project-chart-marker-boundary/` directory for this run |
