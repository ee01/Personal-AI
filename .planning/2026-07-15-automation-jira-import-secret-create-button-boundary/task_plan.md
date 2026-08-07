# Jira Automation Import secret create-button boundary

## Selected feature

- Feature: `secret value 脱敏`
- Area: Jira Automation Import
- Docs: `docs/features/jira_automation_import.md`, `docs/index.md`
- Runtime: `src/contentScriptJiraAutomation.ts`, `src/jira-automation-import/transform.ts`
- Verifier: `tools/verify-jira-automation-import-e2e.mjs`, `npm run verify:jira-automation-import`, `npm run verify:jira-automation-import:e2e`

## Reminder check

- AppleScript listed local Reminder lists but did not show `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No open Reminder item was related to Jira Automation Import, secret redaction, credential re-entry, or disabled-copy activation, so no Reminder feedback was incorporated or marked done.

## External scan

- Atlassian Jira Automation import/export docs say imported flows start disabled and need manual enablement; same-name imports become copies.
- Atlassian Send web request docs say hidden header values render as dots and are meant for API tokens or secret keys that should not be shared.
- Microsoft Power Platform environment-variable docs frame keys, connections, and credentials as environment-specific references that should be supplied or changed during ALM/import rather than hard-coded.
- TAP usability/security research shows users need concrete context to repair automation problems and that rule interactions/anti-patterns often diverge from user mental models.

## Product finding

The transform and preview already sanitize raw secret values and show `Secret re-entry map` plus `Credential re-entry queue`. The remaining UX gap is at the actual create-request controls: the sticky header and footer `Import disabled copy` buttons only had generic boundary text. When a user scrolls away from the detailed queue, the button itself did not repeat which disabled copy will be created, how many credential re-entry slots are still open, whether rule chaining is blocked/preserved, and that no working credentials are restored.

## Plan

1. Add a dynamic create-button boundary label built from the current imported rule name, target project, high-risk count, secret re-entry queue groups, and rule-chaining choice.
2. Attach that boundary to both create buttons as `title` and `aria-label`, while keeping the existing visible button text.
3. Extend the Jira Automation Import E2E to assert header/footer button boundaries, title/ARIA parity, chaining-choice refresh, and no raw secret leakage.
4. Update feature docs and index with concise behavior wording.
5. Run targeted transform tests, dev webpack compile through `npm start`, Jira Automation Import E2E, and scoped whitespace checks.
