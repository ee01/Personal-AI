# Project Dashboard Chart Receipt Automation Plan

## Goal

Improve the Project Dashboard `甘特图 / 依赖图 / 燃尽图` user path so the lightweight chart overview stays honest about data readiness, missing evidence, and what the user can do next.

## Scope

- Target feature: `甘特图 / 依赖图 / 燃尽图`
- Canonical doc: `docs/features/project_dashboard_usage_guide.md`
- Likely source: Project Dashboard presentation, dashboard integration helpers, and focused verification scripts
- Reminder status: Reminders is reachable, but no `Personal AI` list exists, so no reminder items are in scope

## Plan

1. [complete] Inspect current chart readiness implementation, docs, and tests.
2. [complete] Research comparable product/paper patterns and extract one practical UX improvement.
3. [complete] Implement the smallest useful chart-readiness UX/code change.
4. [complete] Update docs and focused verification.
5. [complete] Run targeted validation, dev compile, E2E where available, and diff checks.
6. [complete] Update automation memory and close out.

## Constraints

- Do not revert or stage unrelated dirty worktree changes.
- Keep chart work lightweight; do not build a full Gantt/network/burndown engine.
- Prefer visible receipts and direct repair paths over decorative charting.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `node` not found on default PATH | Random feature picker | Use documented nvm path: `$HOME/.nvm/versions/node/v24.13.0/bin` |
| E2E could not find external-authority boundary in poor-evidence chart receipt | First `verify:project-dashboard:e2e` run | Append local/non-authoritative boundary to every chart receipt state, not only fully ready state |
