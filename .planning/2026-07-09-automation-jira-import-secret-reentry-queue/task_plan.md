# Jira Import Secret Re-entry Queue Plan

## Goal

Improve `secret value 脱敏` under Jira Automation Import so users can act on redacted credential slots without mistaking the disabled-copy import for credential restoration.

## Selected Feature

- Index row: `secret value 脱敏`
- Capability: Jira Automation Import
- Source doc: `docs/features/jira_automation_import.md`
- Primary files: `src/jira-automation-import/transform.ts`, `src/contentScriptJiraAutomation.ts`, `tools/verify-jira-automation-import-e2e.mjs`

## Plan

1. Complete context and evidence gathering.
   - Status: complete
   - Notes: `docs/progressing/to-verify.md` is empty; automation memory shows recent exact focuses to avoid; EventKit found `Personal AI` with 4 total and 0 incomplete reminders.
2. Research comparable products and TAP/security literature.
   - Status: complete
   - Notes: Atlassian disabled imports, Power Platform environment variables/connections, GitHub push protection, SOUPS TAP usability, and eTAP privacy papers all support explicit pre-write and re-entry boundaries.
3. Implement a grouped secret re-entry queue.
   - Status: complete
   - Notes: Add a deterministic formatter that groups redacted slots by hidden Jira secrets, URL/query credentials, inline secret-like text, and named credential fields. Surface it in preview details, import boundary receipt, review packet, review note, success receipt, and warnings without exposing raw secrets.
4. Update canonical docs and index row.
   - Status: complete
   - Notes: `docs/features/jira_automation_import.md` and the `secret value 脱敏` index row now describe the queue as a review aid, not a restoration mechanism.
5. Verify.
   - Status: complete
   - Checks: `npm start -- --progress` compiled successfully and was stopped; `npm run verify:jira-automation-import` passed 37/37; `npm run verify:jira-automation-import:e2e` passed; scoped `git diff --check` passed.

## Boundaries

- Do not change Jira API endpoints, auth, create timing, disabled-copy state, chain-trigger semantics, secret detection policy, or payload redaction decisions unless required by tests.
- Do not mark Reminders done unless an incomplete related item exists; none exists this run.
- Worktree is broadly dirty; own only this planning directory and the selected Jira Import files/docs.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `docs/index.md` parser initially returned zero rows | Used the second column as doc column | Re-read index and parsed the third column as `所在文档` |
| E2E old failure toast intercepted success-receipt controls | Reproduced after adding queue assertions | Added import-error cleanup across same-origin documents and asserted retry removes stale failure UI |
| E2E failure assertion watched the wrong document | Failure toast now renders in the import dialog document | Moved the failure assertion to the dialog frame while keeping pending-receipt assertions at the page level |
