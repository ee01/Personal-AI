# Findings

## Repo

- `docs/progressing/to-verify.md` says `暂无。`, so this run can choose a fresh feature.
- Selected `secret value 脱敏` from `docs/index.md`, under `docs/features/jira_automation_import.md`.
- Current implementation already has `Secret re-entry map` and `Credential restore gate`, but the preview compresses all redacted slots into a flat path list. This is safe but not very actionable when multiple credential classes are present.
- Existing verifier coverage already asserts no raw signed URL, provider token, hidden secret, body secret, label token, or failure-response secret leaks into preview, copy packet, create payload, console, or success/failure receipts.

## Reminders

- AppleScript did not list `Personal AI`.
- EventKit granted access and found `Personal AI` with 4 total reminders and 0 incomplete reminders.
- Existing completed items are historical Doubao / Notification / test notes and unrelated to Jira Automation Import or secret re-entry, so no Reminder item should be marked done.

## External References

- Atlassian Jira Automation import docs say imported rules must be manually enabled because imported rules are disabled, and same-name imports get copied names. This supports keeping Personal AI imports disabled and naming/boundary receipts explicit.
- Microsoft Power Platform environment variables docs describe moving apps across environments while changing external references such as connections and keys, and packaging secrets separately from the components that consume them. This supports treating Jira credentials as re-entry slots, not migrated values.
- GitHub push protection blocks detected secrets before they reach a repository and provides a reason for the block. This supports pre-create secret warnings and no raw credential propagation into Jira descriptions.
- SOUPS 2023 TAP usability research found users need understandable context to identify and repair automation anti-patterns. This supports a grouped queue that tells users what kind of credential work remains.
- eTAP research frames TAP platforms as handling sensitive cross-service data and argues for designs that avoid the platform seeing plaintext user data. This supports minimizing plaintext credential handling and making placeholders explicit.

