# Jira Automation Import Credential Restore Gate

## Target

- Feature: `secret value 脱敏` under `docs/features/jira_automation_import.md`.
- Goal: make the post-redaction credential recovery boundary clearer without changing Jira payload creation, import enablement, or existing sanitizer behavior.

## Findings

- `transform.ts` already redacts hidden Jira secrets, credential-like free text, URL query credentials, signed URL material, and failure details.
- The UI already exposes `Secret re-entry map`, but the user still has to infer that these placeholders are an enablement blocker, not a completed credential restore.
- Local Reminders: EventKit found the `Personal AI` list, but all items are already completed and none are about Jira Automation Import, so no Reminder item should be marked done.
- External scan: Atlassian import/masked-secret docs, hidden web-request headers, GitHub Actions secret masking, and TAP research all support keeping masked credentials and automation side effects explicit through review and enablement.

## Plan

1. Add a reusable credential restore gate summary derived only from existing safe secret re-entry slots.
2. Surface the gate in preview receipts, details, review packet, review note, and post-import success receipt.
3. Add focused unit/E2E assertions that the new gate appears and still does not leak raw credentials.
4. Update the canonical feature doc with the new user-visible behavior.
5. Run targeted transform tests, dev webpack compile via `npm start`, E2E verifier, and scoped whitespace check.
