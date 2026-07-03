# Project Dashboard Dependency Link Receipt Plan

## Target

- Random feature: `甘特图 / 依赖图 / 燃尽图` in `docs/features/project_dashboard_usage_guide.md`.
- Scope: keep the existing lightweight chart overview, but make the dependency panel honest when task-level dependency IDs exist.

## Research Notes

- Jira burndown docs define burndown as remaining work over time, so Personal AI should avoid trend claims when ETA/task evidence is incomplete.
- Linear project dependencies and Microsoft Planner critical path both put blocking relationships on the timeline path; dependency evidence should not be inferred only from a visual task type.
- The 2024 Gantt visualization task taxonomy frames Gantt charts as query-backed temporal/dependency views, which supports making missing dependency targets explicit instead of silently dropping them.

## Gap

The current chart helper treats only `type: "dep"` tasks as dependency graph evidence. Imported reports and older project/task shapes can carry `dependencies: string[]`, but the current sanitize/export path drops those IDs and the dependency panel can say there is no dependency data.

## Implementation Steps

1. Preserve `dependencies: string[]` on project report tasks and Fishbone tasks.
2. Make the dependency readiness panel include active tasks that either are `dep` tasks or have dependency IDs.
3. Detect dependency IDs that do not match a task or milestone in the current project and surface them as an actionable warning driver.
4. Keep existing source-evidence behavior: dependency links without Jira/platform source remain partial and route to the task source repair path.
5. Update docs to describe the dependency-link receipt boundary.
6. Verify with the Project Dashboard targeted script, extension compile, and Project Dashboard E2E.

