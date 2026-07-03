# Jira Automation Import Review Packet Boundary

## Target

- Random feature: `高风险导入确认`
- Source doc: `docs/features/jira_automation_import.md`
- Main implementation: `src/contentScriptJiraAutomation.ts`

## External Signals

- Atlassian Jira Automation imports rules as disabled and requires manual enablement after import.
- Power Platform ALM treats environment variables, connection references, and keys as target-environment binding decisions rather than invisible automatic rewrites.
- Trigger-action programming research shows users often misread rule side effects and bug behavior when automation UIs do not make outcomes and boundaries explicit.

## Plan

1. Keep the existing high-risk acknowledgement gate and disabled-copy import mechanics unchanged.
2. Add a visible review-packet scope receipt that says packet copy is local sanitized clipboard handoff only.
3. Make copy success/failure receipts state that copying does not acknowledge high risk, unlock import, create/edit Jira rules, enable automation, run schedules, or restore secrets.
4. Update the canonical Jira Automation Import doc and feature index line.
5. Extend the existing Jira Automation Import E2E to assert the new copy boundary and unchanged high-risk gate.
6. Verify with the targeted transform test, dev webpack compile, E2E, and scoped whitespace checks.
