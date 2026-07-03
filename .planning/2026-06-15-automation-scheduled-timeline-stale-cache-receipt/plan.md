# Scheduled Messages Timeline stale-cache receipt plan

## Target

- Feature: Scheduled Messages / Timeline cache and Jira Milestone diagnostics.
- Index entry: `Timeline 缓存与 Jira Milestone`.
- Source doc: `docs/features/scheduled_messages_manager.md`.
- Reminder state: local Reminders is readable, but there is no `Personal AI` list on this machine.

## External product and research signals

- Atlassian Automation debugging guidance makes the audit log and smart-value debug output the first-class troubleshooting path, so this UI should keep the real Jira Sync Rule state separate from Apps Script sample probes.
- Zapier Zap history distinguishes run status, replay, and non-undoing history deletion, reinforcing that old successful state and latest failed run are different facts.
- Trigger-action debugging research shows users struggle to localize automation misbehavior without clear history/trace cues, so the main status line should expose the stale-cache boundary instead of burying it below the fold.
- Google Apps Script quotas keep Script Properties values small, so the current cache-size diagnostics remain relevant and should not be hidden.

## Current gap

When a project cache is still `ready` but the latest Timeline sync attempt failed, the panel background becomes warning-yellow and a later line says the old cache is still used. The main status line still says only `缓存可用`, which can make the user think the latest Jira Sync Rule succeeded.

## Plan

1. Add a shared headline formatter for Timeline cache project status.
2. Render `当前使用已有缓存，最近同步失败` in the panel's primary status line for ready cache plus failed latest sync.
3. Keep execution-impact copy explicit: Timeline triggers still use old cache; project variables still substitute from old cache, but future release cadence may be stale.
4. Add targeted unit coverage and strengthen the static verifier so this boundary cannot regress.
5. Update the Scheduled Messages feature doc with the refined receipt behavior.
6. Validate with targeted tests, `npm start` first compile, browser-level or equivalent E2E proof, and `git diff --check`.
