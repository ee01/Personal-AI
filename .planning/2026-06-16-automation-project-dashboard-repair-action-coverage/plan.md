# Project Dashboard Repair Action Coverage Plan

## Target

- Random feature: `项目证据修复路径` in `docs/features/brain_like_project_analysis_system.md`.
- Scope: Project Dashboard data-source check receipt and local evidence repair actions.

## Research Notes

- Jira dashboards and Linear project updates keep project status close to concrete work-item data, health, blockers, and next steps.
- Asana Smart Status still routes AI-generated status updates through a user review path before publishing.
- Dashboard design research highlights data quality, mismatched expectations, and verification as core usability risks.

## Gap

The data-source check already exposes local evidence repair buttons, but `buildProjectSyncLocalEvidenceRepairActions` only emits one action per gap type. When Memory Service sync adds multiple empty watched projects, the receipt says multiple projects need planning while only the first project has a direct action.

## Implementation Steps

1. Generate a bounded repair action queue instead of a single action per type.
2. Surface multiple watched-project planning actions before task-level ETA/source repairs.
3. Keep task-level actions scoped and bounded so the receipt stays scan-friendly.
4. Update targeted Project Dashboard verification for multiple watched-project planning actions.
5. Update feature docs to describe the bounded local-only repair queue.

## Verification

- `npm run verify:project-dashboard`
- `npm start` first successful compile, then stop watch
- `npm run verify:project-dashboard:e2e`
- Scoped `git diff --check`
