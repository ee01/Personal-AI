# Project Dashboard Data Source Check Findings

## Initial Findings

- Randomly selected feature from `docs/index.md`: `项目数据源检查`.
- Feature owner/capability: Project Dashboard.
- Source document from index: `docs/features/brain_like_project_analysis_system.md`.
- Feature index note: Jira/GitHub/Confluence status and gaps.
- `docs/progressing/to-verify.md` currently has no pending carry-over items.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be incorporated or completed in this run.
- The worktree has many unrelated dirty files. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/brain_like_project_analysis_system.md` and `docs/features/project_dashboard_usage_guide.md` are broadly current for the data-source check: they describe local Project Dashboard data, Memory Service watched-project import, Jira/GitHub/Confluence not-connected boundaries, local evidence coverage, and repair actions.
- Runtime source is concentrated in `src/utils/dashboardIntegration.ts` and `src/components/dashboard/ProjectDashboard.tsx`.
- `DashboardDataManager.syncProjectData()` attempts Memory Service `active watched projects`, then always adds Jira/GitHub/Confluence as `not_configured` source cards.
- The UI already shows local evidence metrics and per-source cards, but the first scan row is `本地证据回执`, not a compact check-scope row. A user can still need to infer from multiple cards which sources were actually read, skipped, or unavailable in this run.
- Existing verification is good: `npm run verify:project-dashboard` covers sync builder behavior, while `npm run verify:project-dashboard:e2e` covers extension UI data-source panels and repair actions.

## External Reference Findings

- GitHub Projects docs treat charts/insights as built from project item data, and status updates carry status, dates, history, and message context. Direction: keep the source data behind each dashboard judgment visible, not just the resulting status.
- Linear project updates make health status and update history first-class in the project overview/list. Direction: Project Dashboard should keep check history/scope visible near the top of the diagnostic panel.
- Atlassian's status-report guidance emphasizes high-level progress, risks, next steps, and source gathering from multiple project materials. Direction: the data-source check should tell the user which sources were gathered in this run before presenting conclusions.
- PMI's digital dashboard paper frames dashboards as tools for quickly updating project status and supporting decision-making/collaboration. Direction: source diagnostics should reduce interpretation work and lead directly to next actions.
- Software portfolio dashboard research emphasizes information needs, health indicators, and configurable data mining/visualization over raw metric display. Direction: the data-source panel should make read/skipped/unavailable source states directly scannable.
- A 2025 PMIS review notes that generic information-system success metrics can miss project-specific factors such as stakeholder alignment and dynamic collaboration. Direction: do not overclaim data-source health as project truth; keep check scope separate from local evidence quality.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use Project Dashboard data-source diagnostics as the focus | It is the randomly selected feature and has a clear low-decision surface around evidence/source freshness and repair gaps |
| Add a `sourceScope` receipt to the sync result | It lets tests and UI assert exactly what the current check attempted and what it skipped |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| JavaScript sampler syntax error while excluding recent targets | Simplified the memory parsing regex and reran |

## Resources

- `docs/index.md`
- `docs/features/brain_like_project_analysis_system.md`
- `docs/features/project_dashboard_usage_guide.md`
- GitHub Projects docs: https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects
- GitHub Projects insights docs: https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects
- GitHub project updates docs: https://docs.github.com/en/issues/planning-and-tracking-with-projects/sharing-project-updates
- Linear project updates docs: https://linear.app/docs/initiative-and-project-updates
- Atlassian status report guide: https://www.atlassian.com/agile/project-management/status-report
- PMI digital dashboard paper: https://www.pmi.org/learning/library/tools-projects-digital-dashboard-performance-8045
- Software portfolio dashboard paper: https://eprints.cs.univie.ac.at/6911/1/Paper.pdf
- PMIS evaluation review: https://osuva.uwasa.fi/bitstreams/a70affb7-a808-463a-aa75-3927ace1eafd/download
