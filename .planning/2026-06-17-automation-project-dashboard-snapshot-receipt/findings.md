# Project Dashboard Snapshot Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` currently says `暂无。`, so there is no carry-over verification item to continue.
- Recent automation memory covered many nearby Project Dashboard data-source and evidence-repair receipts, but not the local refresh snapshot/failure path.
- `ProjectDashboard.tsx` refreshes data through `loadProjects()`, and background refresh runs every 30 seconds with `loadProjects({ silent: true })`.
- On success, `lastRefresh` updates. On failure, manual refresh shows a toast, but silent refresh does not surface that the displayed data may now be stale.
- The existing E2E already proves data-source checks, export receipts, decision brief actions, review gates, evidence repair, chart receipt, filters, import review, and Jira source repair. A focused assertion can be added without creating a new harness.

## External Reference Findings

- Jira dashboard gadgets and reporting docs emphasize visible data source scope, status, and chart/gadget context rather than treating every refresh as an external truth update: https://support.atlassian.com/jira-cloud-administration/docs/use-dashboard-gadgets/ and https://confluence.atlassian.com/jirakb/reporting-in-jira-461504615.html.
- GitHub Projects status updates and roadmap views separate project status communication from raw issue data, which supports keeping dashboard snapshots and external-source checks distinct: https://docs.github.com/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects and https://docs.github.com/en/issues/planning-and-tracking-with-projects/sharing-project-updates.
- Linear project updates emphasize health indicators plus narrative status; project overview/graph features depend on underlying project issue data rather than a generic refresh button: https://linear.app/docs/initiative-and-project-updates and https://linear.app/docs/projects.
- The 2024 Gantt visualization taxonomy connects useful Gantt views to explicit low-level tasks and data queries, supporting the existing "chart evidence" approach and this run's snapshot-boundary work: https://arxiv.org/abs/2408.04050.
- Mining-software-repositories research warns that repository/project data can be incomplete, inaccessible, stale, or semantically inconsistent, so status dashboards should expose freshness and quality boundaries: https://link.springer.com/article/10.1007/s10664-015-9393-5.

## Design Conclusion

- The smallest useful improvement is not another source card or review queue. It is a persistent local snapshot receipt near the header that tells users whether the current dashboard is a freshly loaded local snapshot or a retained older snapshot after a failed refresh.
- This matches the product's existing trust-boundary style: visible receipts over vague toasts, and clear separation between local read, external sync, and durable writeback.
