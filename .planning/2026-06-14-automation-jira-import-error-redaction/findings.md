# Jira Automation Import Error Redaction Findings

## Requirements

- Pick one random feature from `docs/index.md`.
- Confirm docs match current code.
- Check related product and research references.
- Implement an improvement that needs no substantial user decision.
- Improve UX and block bugs or unsafe states.
- Check local Reminders list `Personal AI`; only mark items done if the list and relevant items exist.
- Plan first, then implement, update docs, and verify deeply.

## Selected Feature

- Selected feature slice: `secret value 脱敏`.
- Capability: Jira Automation Import.
- Canonical doc: `docs/features/jira_automation_import.md`.
- Main source files: `src/jira-automation-import/transform.ts`, `src/contentScriptJiraAutomation.ts`.
- Existing verification: `npm run verify:jira-automation-import`, `npm run verify:jira-automation-import:e2e`.

## Repo Findings

- Current docs already describe disabled-copy import, secret re-entry, source-format warnings, high-risk acknowledgement semantics, sanitized review packets, sanitized descriptions, and post-import success receipts.
- `transform.ts` already scrubs `secret=true` containers, token/password/API-key fields, masked values, URL credentials, token query params, fragments, and webhook-like path tokens before preview, review packet, description, and create payload.
- `tools/verify-jira-automation-import-e2e.mjs` already asserts that preview, create payload, post-import success toast, and console do not contain known fixture secrets.
- Remaining UX/security gap: `createAutomationRule()` currently throws `API call failed: <status> <statusText>\n<raw response body>`, and `handleFileImport()` displays that full `Error.message` in `showErrorMessage()`. A failed Jira validation can echo raw URLs, headers, or tokens into a visible toast.
- Console logging also receives the raw thrown error; this is useful for debugging but can leak exactly the values the rest of the feature works to suppress.

## Reminder Findings

- AppleScript list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- There is no visible local Reminders list named `Personal AI`; no Reminder item can be incorporated or completed.

## External References

- Atlassian Jira Automation import/export docs: imported rules are manually enabled after import and imports should use the same automation version.
  - https://confluence.atlassian.com/automation/import-and-export-jira-automation-rules-1141480606.html
- Atlassian masked secret keys docs: users see secret key names, while values are masked and not displayed; editing requires pasting a new value.
  - https://confluence.atlassian.com/automation/create-and-edit-masked-secret-keys-for-automation-rules-1283362517.html
- Zapier app connection management exposes separate reconnect/test/status operations for credentials rather than treating workflow creation as credential health.
  - https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections
- Trigger-action programming debugging research argues that non-programmer automation users need better debugging support because complex rules produce misunderstandings and bugs.
  - https://www.blaseur.com/papers/imwut22-debuggingtap.pdf

## Planned Improvement

- Add a focused redaction helper for Jira Automation Import failure details.
- Preserve coarse status (`API call failed: 400 Bad Request`) and a recovery-oriented message.
- Redact token/password/API-key query params, URL credentials/fragments, webhook path tokens, bearer/basic tokens, known API-token shapes, and values following sensitive field names.
- Apply helper before user-visible import failure toasts.
- Avoid logging raw failed API response bodies to console; log redacted status/details instead.
- Extend tests and E2E to prove the failed-import path does not leak the fixture token or secret email.

