# Project Dashboard watched-project status plan

## Goal

Improve the `Memory Service watched projects 补齐` UX so the first visible sync status names the Memory Service watched projects that were created or matched, without changing sync semantics or writing back to Memory Service.

## Selected Feature

- Random sample item: `Memory Service watched projects 补齐`
- Capability: Project Dashboard
- Source docs: `docs/features/brain_like_project_analysis_system.md`, `docs/features/index.md`
- Runtime surface: `project-dashboard.html` data-source sync/check flow

## Plan

1. Confirm current behavior and related Reminder state.
   - Status: complete
2. Research comparable industry and paper guidance for project status/source provenance.
   - Status: complete
3. Implement a narrow first-screen sync receipt improvement.
   - Status: complete
4. Update focused unit/E2E assertions and concise docs/index wording.
   - Status: complete
5. Run targeted verification, dev compile, E2E, whitespace checks, and cleanup.
   - Status: complete

## Scope Guardrails

- Do not change watched-project fetching, matching, project creation, local persistence, or external writeback behavior.
- Do not read Jira/GitHub/Confluence as part of this change.
- Do not mark any Reminder complete unless an open related Reminder is actually used.

## Errors Encountered

None yet.

## Verification

- `node --check tools/verify-project-dashboard-e2e.mjs` passed.
- `npm run verify:project-dashboard` passed.
- `npm start -- --progress` compiled successfully in 19221 ms and was stopped after the first successful compile.
- `node tools/verify-project-dashboard-e2e.mjs` passed.
- Scoped `git diff --check` passed.
- Process cleanup found no remaining webpack watcher, Project Dashboard E2E, Playwright, or Chromium process.
