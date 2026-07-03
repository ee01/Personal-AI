# Jira Automation Import preflight receipt plan

## Context

- Target feature: `Jira Automation Import` / `Jira 自动化规则导入`.
- Source doc: `docs/features/jira_automation_import.md`.
- `docs/progressing/to-verify.md`: no carry-over items.
- Local Reminders: list names were readable, but no `Personal AI` list exists, so no Reminder item can be completed.
- Recent automation memory covered nearby Jira Design Links and many receipt surfaces, but not this exact import-preflight waiting state.

## External signals

- Atlassian import docs emphasize that imported automation flows initially stay disabled, and cross-instance/server-to-cloud imports often need manual reconfiguration.
- Microsoft Power Platform solution import docs treat imports as environment-bound ALM moves, with trust, permissions, draft/published state, and overwrite risks visible before activation.
- TAP debugging and TAP security-usability papers show users need support through the whole automation debugging path and that flagged automation risks need wording that matches user mental models.

## UX gap

After a JSON file is selected, the UI can spend time parsing the file and reading target Jira rule names before the preview dialog opens. During that interval, users only see the native file picker close and have no immediate receipt explaining that the app is still in preflight and has not created, edited, enabled, run, or restored anything in Jira.

## Implementation plan

1. Add a short preflight receipt immediately after file selection.
2. Keep the receipt scoped to local JSON parsing plus target rule-name lookup.
3. Clear/replace it when the preview opens, create starts, or an error occurs.
4. Extend the Jira Automation Import E2E with a delayed rule-list fixture to assert the waiting receipt and no-create boundary.
5. Update `docs/features/jira_automation_import.md` with the new behavior.
6. Verify with targeted transform tests, first successful `npm start` compile, E2E, and scoped `git diff --check`.

## Status

- [x] Code change
- [x] E2E update
- [x] Docs update
- [x] Verification

## Verification

- `npm run verify:jira-automation-import`: passed, 36 tests.
- `node --check tools/verify-jira-automation-import-e2e.mjs`: passed.
- `npm start`: first successful webpack dev compile, then stopped.
- `npm run verify:jira-automation-import:e2e`: passed.
- Scoped `git diff --check`: passed.
- `pgrep -fl "webpack.*webpack\\.dev\\.cjs"`: no leftover watcher.
