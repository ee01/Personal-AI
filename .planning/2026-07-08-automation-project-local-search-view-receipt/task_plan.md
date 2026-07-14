# Project Dashboard Local Search View Receipt Plan

## Target

- Feature: `项目本地查找`
- Source doc: `docs/features/project_dashboard_usage_guide.md`
- Runtime surface: `project-dashboard.html`

## Plan

1. Keep the search algorithm and storage behavior unchanged: local snapshot only, no Memory Service / Jira / GitHub / Confluence reads or writes.
2. Add a first-screen receipt field that names the active project view, visible matched projects in that view, hidden matches filtered out by the view, and the recovery action.
3. Update the static verifier and Playwright E2E to assert the current-view receipt, including the hidden-match path.
4. Update concise feature docs and the index row to describe the current-view visible/hidden search basis.
5. Run targeted static verification, dev build first compile, Project Dashboard E2E, and scoped whitespace checks.
