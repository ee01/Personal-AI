# Project Dashboard Snapshot Receipt Plan

Goal: improve the selected `项目面板` feature by making local snapshot refresh state visible, especially when a manual or background refresh fails while the UI keeps showing the previous local project data.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, existing planning files, `docs/progressing/to-verify.md`, feature index, worktree state, and Reminders list names |
| 2 | completed | Select `项目面板` / Project Dashboard and inspect feature docs, implementation files, and verifier/E2E coverage |
| 3 | completed | Check current industry/product and research references for project dashboard freshness, status, graph/readiness, and data-quality patterns |
| 4 | completed | Implement the smallest no-decision UX improvement: a visible local snapshot receipt for refresh success/failure |
| 5 | completed | Update Project Dashboard E2E and feature docs |
| 6 | completed | Run targeted verification, dev compile, E2E, and scoped diff checks |
| 7 | completed | Update automation memory and archive the Codex session |

## Decisions

- Selected feature: `项目面板` / Project Dashboard from `docs/index.md`.
- Primary doc: `docs/features/project_dashboard_usage_guide.md`.
- Related context doc: `docs/features/brain_like_project_analysis_system.md`.
- Main implementation: `src/components/dashboard/ProjectDashboard.tsx`.
- Existing verifier anchors: `tools/verify-project-dashboard.ts` and `tools/verify-project-dashboard-e2e.mjs`.
- Local Reminders is readable, but no list named `Personal AI` exists, so no Reminder item can be incorporated or marked done.
- Existing worktree is broadly dirty. Keep edits scoped to Project Dashboard, this planning directory, automation memory, and archive bookkeeping.

## Improvement Plan

1. Add a local snapshot receipt state to Project Dashboard.
2. On successful `GET_PROJECT_DATA`, show project count and last successful local read time.
3. On manual or silent refresh failure, preserve existing projects and show that the visible view is the previous local snapshot.
4. Make the boundary explicit: refresh reads only the current browser's local dashboard data; external source status still requires `同步/检查数据源`; refresh does not clear, overwrite, sync, or write back Memory Service, Jira, GitHub, or Confluence.
5. Extend E2E to verify the success receipt and a simulated failed manual refresh.
6. Update the feature doc so the documentation stays current without over-specifying implementation details.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder item completion |
| Very dirty worktree | Initial `git status --short` | Preserve unrelated files and use scoped verification/diff checks |
