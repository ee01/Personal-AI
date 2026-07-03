# Jira Automation Import create-stage lock receipt plan

## Target

- Feature: `高风险导入确认` in Jira Automation Import.
- Source doc: `docs/features/jira_automation_import.md`.
- Main files: `src/contentScriptJiraAutomation.ts`, `tools/verify-jira-automation-import-e2e.mjs`.

## Current finding

- The preview correctly disables both import buttons until high-risk review is acknowledged.
- The footer status explains the lock, but the sticky header still shows a disabled `Import disabled copy` button without an adjacent reason.
- A real user can stay at the top of a long preview, see a disabled primary action, and have to scroll to rediscover that the lock is tied to the current preview, not a broken button or missing Jira permission.

## Plan

1. Add a compact create-stage status receipt beside the sticky header import button.
2. Keep the receipt tied to the same state as the buttons:
   - locked before high-risk acknowledgement;
   - reset to locked after rule selection or chained-trigger safeguard changes;
   - ready only after the current preview is acknowledged.
3. Add button `title` / accessible labels that preserve the no-write boundary while locked and the disabled-copy-only boundary while ready.
4. Extend the Jira Automation Import E2E to assert locked and ready receipt text.
5. Update the canonical feature doc with the current behavior.
6. Verify with targeted transform tests, `npm start` first successful compile, E2E, and scoped `git diff --check`.

## Reminder branch

- Local Reminders list `Personal AI` is absent on this machine, so no Reminder item can be linked or marked done.

