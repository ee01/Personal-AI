# Project Dashboard Evidence Repair Button Boundary

Goal: improve `项目证据修复路径` by making the actual repair controls state their local-only consequence before click, while keeping Project Dashboard data and write behavior unchanged.

## Context

- Selected feature: `项目证据修复路径` from `docs/index.md`.
- Carry-over: `docs/progressing/to-verify.md` is empty.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items; no Project Dashboard-related Reminder item is available to incorporate or mark done.
- Recent automation memory already covered Project Dashboard data-source button boundaries and evidence-queue entry receipts, so this run focuses on the lower control point: repair buttons in task detail, chart drill-down, decision brief, evidence queue, and data-source local repair actions.

## External Scan

- Atlassian project status guidance emphasizes reviewed status, tasks, risks, and clear communication before sharing project state.
- GitHub Projects insights are explicitly based on project items as source data, and project updates surface status history near the project context.
- Linear Project Graph only autogenerates after enough issue data exists, reinforcing that dashboards should expose data sufficiency before forecasting or status claims.
- Dashboard data-quality / provenance research highlights that users need data origin, quality, and repair context close to the action point to avoid over-trusting incomplete dashboards.

Sources checked:

- https://www.atlassian.com/agile/project-management/status-report
- https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects
- https://linear.app/docs/project-graph
- https://arxiv.org/abs/2209.06363
- https://arxiv.org/abs/2105.10895

## Plan

1. Add a shared `buildProjectEvidenceRepairButtonBoundary()` helper for ETA, source, general task detail, and watched-project planning repair actions.
2. Wire it into Project Dashboard repair controls: data-source repair buttons, evidence queue cards, decision-brief action, chart driver rows, chart panel action, and task-detail `补 ETA` / `补来源` buttons.
3. Extend `verify:project-dashboard` to assert the shared helper contract.
4. Extend Project Dashboard E2E to assert `title` / `aria-label` boundaries before activation across the local data-source path, queue path, chart path, decision brief, detail buttons, and watched-project planning path.
5. Update canonical docs and the feature index.
6. Validate with static verifier, dev compile, E2E, and scoped whitespace check.

## Boundary

This is a presentation/accessibility change. It does not change Project Dashboard storage, watched-project merge, data-source checks, task updates, Jira source validation, chart calculations, queue sorting, task-detail focus behavior, Memory Service writes, Jira/GitHub/Confluence reads or writes, notifications, or Reminder state.
