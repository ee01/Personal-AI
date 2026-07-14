# Project Evidence Queue Receipt

## Target

- Feature: `项目证据修复路径`
- Docs: `docs/features/brain_like_project_analysis_system.md`
- UI: `project-dashboard.html`

## Plan

1. Confirm the current feature contract, recent automation memory, and local Reminders.
2. Compare nearby product/research patterns for project status, source-data limits, and dashboard information quality.
3. Keep the implementation scoped to one user-visible trust gap in the existing evidence repair path.
4. Update Project Dashboard code, focused E2E coverage, and concise feature docs.
5. Verify with the Project Dashboard verifier, dev webpack compile, Project Dashboard E2E, and scoped diff check.

## Implemented

- Clicking a `证据补全` queue item now opens task detail with a `证据队列入口` receipt.
- The receipt states queue position, total queue size, current gap breakdown, hidden folded items when present, local sort basis, and no external read/write boundary.
- Evidence-gap calculation, risk scoring, ordering, task save behavior, data-source sync, and external APIs were not changed.

## Verification

- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm run verify:project-dashboard`
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm start -- --progress` until first successful compile, then stopped
- `PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" npm run verify:project-dashboard:e2e`
- `git diff --check -- src/components/dashboard/ProjectDashboard.tsx tools/verify-project-dashboard-e2e.mjs docs/features/brain_like_project_analysis_system.md docs/features/project_dashboard_usage_guide.md .planning/2026-07-05-automation-project-evidence-queue-receipt/plan.md`
