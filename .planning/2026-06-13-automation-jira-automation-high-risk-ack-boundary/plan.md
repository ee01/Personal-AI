# Jira Automation high-risk acknowledgement boundary

## Target

- Random feature: `高风险导入确认`
- Feature doc: `docs/features/jira_automation_import.md`
- Main surfaces: `src/contentScriptJiraAutomation.ts`, `src/jira-automation-import/transform.ts`, `tools/verify-jira-automation-import-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders are readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Existing code already creates disabled Jira Automation copies, redacts secrets, blocks high-risk create until acknowledgement, writes an Activation plan, and shows pre/post import receipts.
- The remaining UX defect is boundary wording: the high-risk acknowledgement text currently says the user should confirm high-risk items before Jira creates the disabled copy, while the actual safe path is acknowledge before create, then complete Jira-side checks before enabling.

## External grounding

- Atlassian import/export guidance and hidden value behavior support disabled imports plus post-import reconfiguration rather than treating import as ready-to-run.
- Trigger-action automation research emphasizes that users misjudge automation side effects; the review artifact should preserve what remains open after acknowledgement.

## Plan

1. Reword the high-risk acknowledgement copy so the checkbox unlocks disabled-copy creation only.
2. Add a durable high-risk gate line to the copied review packet and Jira description review note.
3. Update the Jira Automation Import E2E and transform tests to assert the new create-vs-enable boundary.
4. Update `docs/features/jira_automation_import.md` with the corrected acknowledgement semantics.
5. Validate with `npm run verify:jira-automation-import`, first successful `npm start` compile, `npm run verify:jira-automation-import:e2e`, and `git diff --check`.

