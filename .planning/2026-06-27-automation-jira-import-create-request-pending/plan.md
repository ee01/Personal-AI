# Jira Automation Import Create-Request Pending Receipt

## Target

- Random feature: `Jira 自动化规则导入`
- Canonical doc: `docs/features/jira_automation_import.md`
- Runtime surface: Jira Automation import preview and create request flow

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders list names were readable, but there is no `Personal AI` list, so no Reminder item can be included or completed.
- Recent automation memory heavily covered Meeting Pilot, Doubao Bridge, Memory Exploring, Coverage, Scheduled Messages, OpenClaw, Memory Capture, Remind, Skill Foundry, Notification Center, Compose, Relationship Radar, Native Join, and nearby receipt surfaces. Jira Automation Import was selected from the remaining random candidate pool.
- External scan:
  - Atlassian Jira Automation import docs say imported rules are disabled and must be manually enabled.
  - Power Platform ALM docs keep target-environment connection references and environment variables explicit during import/deployment.
  - Trigger-action programming research shows users often mispredict automation rule side effects and trigger semantics.

## UX Gap

The preview already explains that confirmation creates only a disabled copy, and the post-import success/failure receipts repeat that boundary. The narrow gap is the in-between pending state after the user confirms and before Jira responds: it currently shows a generic `Creating disabled Jira Automation copy...` message without the selected rule name, target project, chaining state, or explicit "request sent but not enabled/run/restored" boundary.

## Plan

1. Add a create-request pending receipt for the post-confirm/pre-response stage.
2. Include selected imported rule name, target project, `DISABLED` state, chained-trigger handling, and no-enable/no-run/no-schedule/no-secret-restoration boundary.
3. Keep existing preview, transform, payload, and Jira API semantics unchanged.
4. Extend `tools/verify-jira-automation-import-e2e.mjs` to assert the new pending receipt before the simulated Jira create failure/success result.
5. Update `docs/features/jira_automation_import.md` with the new visible pending-stage boundary.
6. Verify with `npm run verify:jira-automation-import`, `npm start` first successful compile, `npm run verify:jira-automation-import:e2e`, and scoped `git diff --check`.
