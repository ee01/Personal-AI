# Jira Automation Import secret success receipt

## Goal

Improve the `secret value 脱敏` slice of Jira Automation Import so the user still sees the disabled-copy and secret re-entry boundary after clicking import, not only before the create request.

## Context

- Selected from `docs/features/index.md` after avoiding the freshest automation targets.
- `docs/progressing/to-verify.md` says `暂无。`.
- Reminders are readable, but there is no `Personal AI` list on this Mac.
- Existing code already redacts `secret=true` payloads from preview, review packet, create payload, and console.
- External references support the same product direction:
  - Atlassian imports automation flows as disabled and expects reconfiguration for site-specific data.
  - Atlassian hidden web request header values display as dots and are intended for API tokens / secret keys.
  - Zapier workflow imports tell users to turn workflows on and test app connections after import.
  - Trigger-action security research points to user confusion around automation effects and the need for usable review surfaces.

## Plan

1. Add a post-import success receipt that uses the actual imported disabled-copy name.
2. Include next action copy: re-enter hidden secrets when applicable, test manually, enable in Jira, and note that the sanitized review note / Activation plan are in the rule description.
3. Update the Jira Automation Import E2E to assert the post-click receipt and keep secret leak checks.
4. Update `docs/features/jira_automation_import.md`.
5. Validate with targeted transform tests, first `npm start` compile, E2E, and `git diff --check`.

## Progress

- 2026-06-11: Plan created after code/doc/reminder/research inspection.
- 2026-06-11: Implemented post-import success receipt in `src/contentScriptJiraAutomation.ts`, updated Jira Automation Import E2E assertions, and documented the post-click handoff boundary.
- 2026-06-11: First E2E run failed because the success toast is rendered in the top Jira page document while the preview dialog lives in the iframe. Updated the assertion to check the parent page.
- 2026-06-11: Validation passed: `npm run verify:jira-automation-import`; first successful `npm start` compile then watcher stopped; `npm run verify:jira-automation-import:e2e`; `git diff --check`; no `npm start` / `webpack --watch` process remained.
