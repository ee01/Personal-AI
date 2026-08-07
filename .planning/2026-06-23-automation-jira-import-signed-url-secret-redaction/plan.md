# Jira Automation Import signed URL secret redaction

## Target

- Feature index row: `secret value 脱敏`
- Capability: Jira Automation Import
- Source document: `docs/features/jira_automation_import.md`

## Current finding

The Jira Automation import flow already has a strong shared redaction contract for `secret=true`, bearer tokens, API-token query keys, hidden secret containers, copy packets, post-import receipts, failure receipts, and the create payload.

The remaining gap is narrower: URL query secret detection does not explicitly cover common signed URL and cloud credential parameters such as `sig`, `signature`, `X-Amz-Signature`, `X-Amz-Credential`, `X-Amz-Security-Token`, `AWSAccessKeyId`, `GoogleAccessId`, and `X-Goog-Signature`. If a Jira automation rule calls a signed storage URL or webhook URL, these values can be authorization material even when the key name does not include `token`, `password`, or `secret`.

## External scan

- Atlassian Automation masked secret keys keep secret values masked and show only key names in automation rules.
- GitHub Actions recommends explicit masking for sensitive data that is not already a stored secret.
- AWS S3 presigned URLs use query parameters such as `X-Amz-Credential`, `X-Amz-Security-Token`, and `X-Amz-Signature` as authentication material.
- Azure Storage SAS URLs append a signed token to the URI; the `sig` query parameter authorizes the request.
- OWASP documents query-string exposure of passwords, tokens, credentials, and other sensitive data as a real disclosure issue.
- Secret-management research recommends moving secrets out of artifacts and limiting accidental persistence through scanning and short-lived credentials.

## Plan

1. Extend the shared sensitive-key detector in `src/jira-automation-import/transform.ts` for signed URL and cloud credential query parameters.
2. Add transform tests proving signed URL query parameters are redacted in preview signals, review notes, re-entry map, and create payload.
3. Update the Jira Automation Import E2E fixture so the browser preview, post-import receipt, Jira description, create payload, and console checks reject signed URL leaks.
4. Update `docs/features/jira_automation_import.md` and `docs/index.md` with a concise note; do not add implementation-level detail beyond the user-facing contract.
5. Verify with `verify:jira-automation-import`, `npm start` first compile, `verify:jira-automation-import:e2e`, and scoped whitespace checks.

