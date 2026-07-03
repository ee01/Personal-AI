# Jira Automation Import Create-Stage Acknowledgement Receipt

## Target

- Random feature: `高风险导入确认` under `Jira Automation Import`.
- Source doc: `docs/features/jira_automation_import.md`.
- Reminder status: local Reminders is reachable, but there is no `Personal AI` list.

## Product / Research Scan

- Atlassian import/export docs say imported automation rules are disabled and must be manually enabled after import.
- Atlassian masked secret docs keep secret values masked and require users to manage secret keys rather than relying on visible copied values.
- Microsoft Power Platform solution import treats connection references as target-environment bindings that must be supplied during import before flows can turn on.
- Trigger-action programming research shows users can author rules, but often need help identifying anti-patterns, chaining, and subtle rule interactions.

## User-Path Gap

The current import preview correctly blocks high-risk creates until the user checks the acknowledgement, and it resets that checkbox when the chained-trigger safeguard changes. The remaining gap is auditability and UX state: after the checkbox unlocks the button, the preview and imported Jira description do not explicitly record that the acknowledgement was only a create-stage gate for this specific disabled-copy request, not an activation approval.

## Implementation Plan

1. Add a create-stage acknowledgement status to the high-risk confirmation area.
   - Initial state: import remains locked until this current preview is acknowledged.
   - Checked state: acknowledgement applies only to this preview and Jira-side Activation plan review remains open.
   - Reset state when rule selection or chained-trigger safeguard changes.
2. Add an optional transform context field so imported rule descriptions can record the acknowledgement boundary.
   - UI imports pass the completed create-stage acknowledgement.
   - Generic transform callers keep the existing conservative wording.
3. Update targeted tests.
   - Transform test for the new review-note line.
   - Extension E2E for checkbox status text and imported description.
4. Update the feature doc and index row only if behavior changed.
5. Validate with the narrowest real proof ladder for this content-script UI:
   - `npm run verify:jira-automation-import`
   - `npm start` until first successful compile, then stop
   - `npm run verify:jira-automation-import:e2e`
   - `npm run verify:i18n`
   - path-scoped `git diff --check`
