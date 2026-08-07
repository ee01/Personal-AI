# Task Plan: Project Dashboard Source Readiness Receipt

## Goal
Improve Project Dashboard data-source checks so users can see the local evidence quality and next repair action before trusting the checked source status.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read automation memory, AGENT.md, feature index, carry-over to-verify, and local Reminder lists
- [x] Randomly select a non-recent feature from docs/index.md
- [x] Inspect relevant Project Dashboard docs, code, and verification scripts
- [x] Check external product and paper direction
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Keep scope to source-readiness UX; do not implement real Jira/GitHub/Confluence sync
- [x] Add a top-level local evidence receipt to ProjectSyncReadiness
- [x] Render receipt above source cards and add deterministic + E2E assertions
- [x] Update source-of-truth feature docs
- **Status:** complete

### Phase 3: Implementation
- [x] Extend sync readiness model with local evidence receipt
- [x] Render receipt in ProjectDashboard and style for mobile/desktop
- [x] Update verify-project-dashboard and E2E fixtures
- [x] Update docs/features/brain_like_project_analysis_system.md and project_dashboard_usage_guide.md
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run npm run verify:project-dashboard
- [x] Run npm start until first successful compile, then stop watcher
- [x] Run npm run verify:project-dashboard:e2e
- [x] Run git diff --check
- [x] Document test results
- **Status:** complete

### Phase 5: Delivery
- [x] Update automation memory with run summary and timestamp
- [x] Report files changed, validation evidence, Reminder state, and source links
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Target `项目数据源检查` under Project Dashboard | Randomly selected from docs/index.md after excluding recent automation targets. |
| Do not add real Jira/GitHub/Confluence sync | Current product boundary explicitly says external sync is not connected; this run should improve trust/UX without overclaiming authority. |
| Promote local evidence quality to a top-level receipt | Source cards already show detailed diagnostics, but the panel header does not give a direct action when Memory Service is readable yet local ETA/source coverage is poor. |

## Errors Encountered
| Error | Resolution |
|-------|------------|
