# Jira Automation Import post-import navigation receipt plan

## Target

- Feature: `高风险导入提示` under Jira Automation Import.
- Canonical doc: `docs/features/jira_automation_import.md`.
- Source surface: `src/contentScriptJiraAutomation.ts`.
- Verification surface: `tools/verify-jira-automation-import-e2e.mjs` plus `src/jira-automation-import/__tests__/transform.test.ts`.

## Context checked

- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory shows very recent sweeps covered Relationship Radar, AR Data, Doubao, Skill Foundry, Compose Assist, Outreach, User Profile, Project Dashboard, Scheduled Messages, Memory Capture, Memory Lens, Evidence Watch, Native Join, Ask, Agent Workflow, Google Slides, Glip, Today, Notification, Dream, and Meeting Pilot surfaces, so this run avoids those fresh targets.
- EventKit found the local `Personal AI` Reminders list with 4 completed historical Doubao / Notification items; no open or Jira Automation Import related Reminder item was available to incorporate.

## External scan

- Atlassian Jira Automation import/export docs say imported rules are disabled and need manual enablement, and same-version/source compatibility can matter.
- Atlassian Cloud Automation import docs call out Server/Data Center to Cloud and Cloud to Cloud reconfiguration risks, especially instance-specific fields and custom fields.
- Microsoft Power Platform environment variables and solution import patterns keep environment-specific references such as connections and keys visible during ALM moves.
- TAP usability/security research highlights that automation rules and chained trigger-action behavior are easy for users to misjudge, so the post-create pause should preserve review context rather than force users away.

## UX gap

After create success, Personal AI clearly said a disabled copy was created and then auto-navigated to the rule details. The user could lose the preview context and copied-review-packet opportunity if they needed a moment to finish reading the success receipt. The default navigation is useful, but it needed a visible control state: queued navigation, cancel navigation, and immediate open.

## Plan

1. Keep disabled-copy creation, sanitization, pending receipt, success receipt, and Jira payload semantics unchanged.
2. Replace the plain post-import success toast for Jira Automation Import with a `Post-import navigation receipt`.
3. Make the receipt state that automatic navigation is queued, and that staying only cancels navigation; it does not undo the disabled copy, enable the rule, run automation, or complete Jira-side Activation plan.
4. Add `Open rule details now` and `Stay here` actions. The default delayed navigation remains.
5. Update E2E to assert the receipt text, buttons, and cancellation behavior.
6. Update the canonical feature doc and index with a concise behavior note.
7. Verify with transform tests, syntax check, dev webpack compile, Jira Automation Import E2E, and scoped whitespace checks.

## Implementation notes

- Do not touch the existing provider-credential redaction changes in `transform.ts`; they are pre-existing dirty work from an earlier run.
- Do not change Atlassian/Jira API route semantics or payload conversion.
- Keep the feature scoped to presentation/navigation control after create success.
