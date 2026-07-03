# Jira Import Inline Secret Scrub Plan

## Selected feature

- Feature index row: `secret value 脱敏`
- Capability: Jira Automation Import
- Canonical doc: `docs/features/jira_automation_import.md`

## Context checked

- `docs/progressing/to-verify.md` has no carry-over work.
- Automation memory showed the latest completed sweeps were Remind and Rehearsal, so this run avoided those feature families.
- Local Reminders lists are readable, but there is no `Personal AI` list on this machine; no Reminder item is available to incorporate or mark done.
- The worktree is already broadly dirty, so this pass is scoped to Jira Automation Import files plus this plan.

## External references

- Atlassian import/export docs: imported automation rules must be manually enabled and version compatibility matters.
- Atlassian masked secret key docs: secret key values are meant to stay masked while only names/scopes are visible.
- GitHub Actions docs: non-secret sensitive values need explicit masking before they can safely appear in logs.
- NDSS 2019 secret-leakage research: accidental secret leakage is persistent and widespread, so imported automation JSON should be treated as a hostile secret-bearing artifact.

## Gap

The current code handles `secret=true` containers, sensitive URL credentials, known token fields, and failed Jira API errors. A remaining path can still carry secrets when a rule stores credentials inside free-text fields such as `customBody`, source descriptions, labels, or even a source rule name. Those values can appear in preview rows, copied review packets, imported descriptions, labels, create payloads, or console-visible error context if not normalized by the same sanitizer.

## Implementation steps

1. Add a reusable inline-secret redaction helper for free text.
2. Use that helper in review-signal formatting so copied packets and preview samples do not leak inline `clientSecret`, `Bearer`, token query values, or high-entropy values.
3. Use the helper when building imported rule names, preserved descriptions, labels, and generic payload string fields.
4. Export a display sanitizer for content-script preview labels and multi-rule dropdown text.
5. Add targeted tests for source description, label, body, and rule-name redaction.
6. Extend the existing Jira Automation Import E2E fixture to assert those secrets are absent from preview, payload, description, and console.
7. Update the canonical feature doc and run the repo validation ladder.

## Validation target

- `npm run verify:jira-automation-import`
- `npm start` until first successful compile, then stop
- `npm run verify:jira-automation-import:e2e`
- `git diff --check` on touched files
