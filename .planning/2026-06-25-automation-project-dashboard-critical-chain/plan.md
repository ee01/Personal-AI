# Project Dashboard Critical Chain Candidate

## Target

- Random feature: `Project Dashboard` -> `甘特图 / 依赖图 / 燃尽图`
- Source doc: `docs/features/project_dashboard_usage_guide.md`
- Reminder status: local Reminders has no `Personal AI` list, so no reminder item can be merged or completed this run.

## External Signals

- Microsoft Planner exposes critical path as a timeline filter, tying priority to task dependencies.
- Linear shows project dependencies on timeline views so blocking relationships are visible near schedule context.
- Gantt visualization research frames dependency-heavy timeline views as queryable visual summaries, not only decorative bars.

## Improvement Plan

1. Keep the current lightweight chart model and avoid implementing a full interactive network graph.
2. Compute a local longest valid task-level `dependencies` chain for each project.
3. Surface that chain as `关键链候选` in the dependency chart metrics and driver rows.
4. Keep the boundary explicit: the candidate comes only from the current browser workspace and is not full critical path, prediction, or external Jira/GitHub/Confluence sync.
5. Verify through the focused Project Dashboard verifier, webpack development build, extension E2E, and scoped diff checks.

## Implementation Notes

- Milestone dependencies still count toward valid dependency targets, but they are not promoted into task-chain nodes.
- Missing, self-referential, or broken dependency targets keep using the existing invalid-target repair path.
- The candidate opens the leaf task so the user can review the end of the chain and repair source evidence when needed.
