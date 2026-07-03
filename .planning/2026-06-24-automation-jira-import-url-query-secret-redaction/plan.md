# Jira Automation Import URL Query Secret Redaction

## Target

- Feature index pick: `secret value 脱敏`
- Capability: Jira Automation Import
- Source doc: `docs/features/jira_automation_import.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is reachable, but there is no `Personal AI` list on this Mac, so no Reminder item is attached to this run.
- Recent automation memory already covered Jira issue-key recovery, Google Slides, Snooze, Prompt Config, Dream Replay, Outreach, and other fresh areas; this run stayed on Jira Automation Import but focused only on the secret-redaction sub-surface.

## External Scan

- Atlassian Jira Automation masked secret keys keep secret values masked and require role/scope-aware reuse instead of raw token copy.
- GitHub Actions secrets masking is useful but explicitly not guaranteed for every transformed secret, so import tooling should avoid carrying raw values into logs, descriptions, and payloads in the first place.
- OWASP Secrets Management guidance emphasizes central storage, auditing, rotation, and leak prevention across the full lifecycle.
- Checked-in secrets research highlights that developers struggle with config and URL-like values that are easy to share accidentally.

## Improvement Plan

1. Extend URL-query credential detection to cover `code`, `functionKey`, API gateway subscription keys, `sasToken`, and `sharedAccessKey` without marking ordinary non-URL fields like `statusCode` as secret-bearing.
2. Reuse the existing redaction path so preview details, Secret re-entry map, review packet, import description, failed-create receipt, and create payload all stay consistent.
3. Add focused transform coverage and strengthen the existing extension E2E fixture so the new query forms are proven through a real imported-rule preview and POST payload.
4. Keep docs concise: mention the added query credential shapes and leave implementation details in tests/source.

## Verification Plan

- `npm run verify:jira-automation-import`
- `node --check tools/verify-jira-automation-import-e2e.mjs`
- `npm start` until first successful compile, then stop the watcher
- `npm run verify:jira-automation-import:e2e`
- Scoped `git diff --check`
