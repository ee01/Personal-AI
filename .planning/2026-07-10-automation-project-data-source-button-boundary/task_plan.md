# Project Data Source Button Boundary Plan

## Target

- Feature: `项目数据源检查`
- Canonical doc: `docs/features/brain_like_project_analysis_system.md`
- Main UI: `src/components/dashboard/ProjectDashboard.tsx`
- Verification: `npm run verify:project-dashboard`, `npm start`, `npm run verify:project-dashboard:e2e`

## Context

- `docs/progressing/to-verify.md` is empty.
- Recent automation runs covered Skill Foundry, Local ASR, Coverage, multi-user identity, Topic defer, Memory Capture, Prompt Config, and other exact surfaces, so this run avoids those.
- Reminder check: AppleScript did not list `Personal AI`; EventKit found the `Personal AI` list with 4 total items and 0 incomplete items. No Reminder item needs completion.
- External scan: GitHub Projects Insights, Linear Project Graph, and provenance/data-quality dashboard research all point to placing source-data basis and completeness limits at the decision point, not only after a panel opens.

## Plan

1. Add shared pre-click boundary text to both `同步/检查数据源` buttons.
2. Keep behavior presentation-only: no change to Memory Service reads, watched-project merge, Jira/GitHub/Confluence status, local persistence, or external writeback.
3. Extend Project Dashboard E2E to assert the title and aria-label on both sync buttons.
4. Update docs and index with a concise note.
5. Run targeted verifier, first successful dev compile, E2E, and scoped diff checks.
