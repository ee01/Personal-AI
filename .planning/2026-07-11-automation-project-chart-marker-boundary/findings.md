# Project Dashboard Chart Marker Boundary Findings

## Repo Findings

- `docs/progressing/to-verify.md` currently says there are no pending verification items.
- The worktree is broadly dirty before this run. Keep edits scoped to Project Dashboard chart presentation, docs, verifiers, planning, and automation memory.
- `docs/features/project_dashboard_usage_guide.md` is current for the core chart behavior: it documents Gantt readiness, dependency graph, local critical-chain candidate, task-count burndown, chart-basis receipt, and the non-authoritative local-workbench boundary.
- `src/utils/dashboardIntegration.ts` already computes:
  - Gantt readiness from active task ETA, milestone dates, and completed-task historical ETA anchors.
  - Dependency readiness from `dep` tasks plus task-level `dependencies`, including invalid targets and a longest local dependency-chain candidate.
  - Burndown/completion from local task counts, not effort/story points/velocity.
- `src/components/dashboard/ProjectDashboard.tsx` already gives chart driver buttons and chart panel action buttons `title` / `aria-label` boundaries through `buildProjectEvidenceRepairButtonBoundary`.
- Gap found: chart cards, progress bars, and marker dots expose mostly visual labels. Their hover/reader text does not explicitly say these are local chart projections, not authoritative Jira/GitHub/Confluence sync, prediction, project confirmation, notification, or auto-reschedule actions.

## Reminder Findings

- AppleScript Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- EventKit result: access granted, `Personal AI` list present, 4 total items, 0 incomplete items.
- All Personal AI items are completed historical Doubao / notification / test feedback. None relate to Project Dashboard chart overview, Gantt/dependency/burndown visualization, chart markers, chart progress, or chart authority boundaries.

## External References

- Atlassian Advanced Roadmaps dependencies report: dependencies are presented as a view-only report; switching to the view does not change the plan.
- Atlassian burndown guidance: burndown charts show remaining work over time and are useful for spotting risk, but they track a selected work measure and should not be read as quality or scope truth by themselves.
- GitHub Projects Insights: the default progress chart visualizes completed vs remaining work over time and is meant to help spot bottlenecks.
- Linear Project Graph / Insights: project graphs show project progress and estimated completion context; insights turn issue data into analysis views.
- DX burndown discussion and agile-metrics literature: burndown can mislead when scope, quality, cognitive load, collaboration, or effort basis are missing. This supports explicitly labeling Personal AI's current chart as task-count/local-workbench only.
- Agile/project visualization research: Gantt and burndown are useful overview tools but need details-on-demand and task-level drill-down to avoid misleading abstraction.
