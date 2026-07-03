# Project Dashboard Source-Specific Diagnostics Plan

## Target

- Feature: `项目数据源检查` in `docs/features/brain_like_project_analysis_system.md`.
- Reminder state: local Reminders lists were readable, but no `Personal AI` list exists, so no Reminder item can be incorporated or marked done.
- Scope: improve the source-check result panel without adding real Jira/GitHub/Confluence sync.

## Research Notes

- GitHub Projects and Linear project status patterns emphasize source data and update context before treating project dashboards as predictive truth.
- Atlassian/Jira dashboard and status-report patterns keep report scope close to issue/source data.
- Dashboard data-quality/provenance research supports exposing missing, unavailable, and not-configured sources separately from the local evidence quality.

## User Problem

The current Project Dashboard source check already separates Memory Service readiness, not-configured external sources, and local evidence coverage. However, the GitHub and Confluence cards reuse a generic platform-source diagnostic, so their local diagnostic text can talk about ETA or Jira/platform coverage instead of the source-specific seeds a user would need for repository or document mapping. As a user, this makes the next action less clear after seeing three not-configured source cards.

## Implementation Plan

1. Extend the local coverage summary with lightweight project-level context for Confluence-style page/status-report mapping.
2. Replace the generic GitHub/Confluence diagnostics with source-specific diagnostics:
   - Jira: keep task Jira/source coverage.
   - GitHub: show repository/PR/commit/release sync is not configured and point to local platform/Jira source seeds, not ETA.
   - Confluence: show page/space/status-report sync is not configured and point to project descriptions, milestones, and待规划 gaps.
3. Update targeted Project Dashboard verifier assertions.
4. Update the Project Dashboard E2E to assert visible source-specific diagnostics in the data-source panel.
5. Update feature docs to describe the refined source-specific diagnostic receipt.

## Verification

- `npm run verify:project-dashboard`
- `npm start -- --progress` until first successful compile, then stop.
- `npm run verify:project-dashboard:e2e`
- Scoped `git diff --check`
