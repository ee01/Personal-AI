# Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`
- Automation memory shows recent exact targets through Scheduled Messages list filtering; Project Dashboard chart overview was not among the freshest exact targets.
- Random selected feature: `甘特图 / 依赖图 / 燃尽图` under Project Dashboard in `docs/features/project_dashboard_usage_guide.md`.
- Reminder probe: local Reminders listed existing lists, but there is no `Personal AI` list, so no user feedback items can be incorporated or marked complete.

## Current Doc Notes

- The doc already frames charts as lightweight overview cards, not a full Gantt engine.
- It says the chart cards should show readiness, missing ETA/Jira/platform source, key task rows, and direct task-detail repair paths.
- Larger interactive Gantt, dependency network, and trend prediction are explicitly future directions.

## Code Findings

- `buildProjectVisualizationSummary()` composes Gantt readiness, dependency graph, and burndown panels from local tasks, milestones, statuses, ETA, and source evidence.
- Individual panels already expose metrics, next steps, drivers, and repair actions.
- Gap: summary wording ignores `empty` panels. A project with ready Gantt/burndown but no dependency data can still say `图表数据可用`; an all-empty chart set can also overclaim readiness.
- Gap: the chart overview lacks a single visible receipt that says these are local lightweight charts, not Jira/GitHub/Confluence authority or statistical forecasts.

## External Research

- Linear project dependencies put blocking relationships directly on timeline views, reinforcing that dependency visuals should stay tied to explicit blocking/blocked objects.
- Jira burndown documentation frames burndown as remaining work over time used to judge whether a team can meet the sprint goal, so a Personal AI burndown card should not overclaim without remaining-work/time anchors.
- The 2024 Gantt chart task-taxonomy paper argues Gantt support depends on the underlying data queries, which supports exposing data-readiness rather than drawing decorative bars from weak data.
- Project Tube Map vs Gantt research emphasizes overview plus detail and complementary views, supporting the current “chart card + key task row + repair path” direction.

Sources:
- https://linear.app/docs/project-dependencies
- https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-the-burndown-chart/
- https://arxiv.org/abs/2408.04050
- https://kar.kent.ac.uk/14324/
