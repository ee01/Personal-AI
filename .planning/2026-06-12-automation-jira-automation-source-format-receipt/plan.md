# Jira Automation source-format receipt plan

- Selected feature: `Jira 自动化规则导入` under `docs/features/jira_automation_import.md`.
- Carry-over: `docs/progressing/to-verify.md` is empty.
- Reminder branch: local Reminders are readable, but no `Personal AI` list exists, so no Reminder item is incorporated or marked done.
- External grounding: Atlassian import/export docs say same-version JSON matters and imported rules stay disabled; Atlassian's Send web request KB calls out Cloud/Data Center header JSON differences; masked secret docs keep secret values hidden; audit-log docs make post-enable verification part of the recovery path; trigger-action debugging research supports carrying compatibility context into the review artifact, not only the preview.

## Plan

1. Carry the parsed `cloud` source-format flag through preview, review packet, Jira description, warnings, and activation plan.
2. Treat `cloud=false` plus web requests, external effects, custom/app components, or credentials as a high-risk source-format compatibility check.
3. Surface the source-format receipt in the preview and copied packet, and keep the first post-import action focused on format compatibility when it is the likely blocker.
4. Update the Jira Automation Import feature doc with the source-format compatibility boundary.
5. Run focused transform tests, first successful dev compile, Jira Automation Import E2E, and diff checks.
