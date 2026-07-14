# Scheduled Messages Config Sync Button Boundary Plan

Goal: improve the randomly selected `定时消息配置同步` feature by checking the current docs/code, incorporating Reminder and external product/research signals, then implementing one low-decision UX fix with focused verification.

## Selected Feature

- Feature: `定时消息配置同步`
- Capability: Scheduled Messages
- Source doc: `docs/features/scheduled_messages_manager.md`
- Main implementation: `src/scheduled-messages/ConfigSyncService.ts`, `src/scheduled-messages/ScheduledMessagesManager.tsx`
- Existing verifier: `tools/verify-scheduled-messages-config-sync-e2e.mjs`

## Plan

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, current planning context, and worktree state |
| 2 | completed | Check local Reminders through AppleScript and EventKit |
| 3 | completed | Inspect Scheduled Messages Config docs, Config sync service, UI flow, and existing E2E coverage |
| 4 | completed | Search current product docs and papers for config/automation sync and debugging guidance |
| 5 | completed | Add a button-level pre-click boundary for manual Config sync and update concise feature docs |
| 6 | completed | Extend focused E2E assertions and run targeted validation |
| 7 | completed | Run dev build, final E2E, scoped diff checks, update automation memory, and close Reminder state |

## Decision

The docs and backend sync logic are current: Sheet Config remains the cross-device source, local storage is cache, writes are Sheet-first, same-timestamp conflicts do not silently overwrite, and completion/failure banners already separate Config and Messages/Logs phases.

The remaining UX gap is at the control point: the header `同步` button still exposes only a generic `title="同步数据"` and has no explicit `aria-label`. Before clicking, a user cannot tell that the action will read Sheet Config, may update only local cache when Sheet is newer, may write Config only to recover missing worksheet IDs, then reads Messages/Logs, and never sends messages or executes the queue. The implementation will add a shared button-boundary helper and E2E assertions without changing sync semantics.

## Reminder State

AppleScript listed Reminder lists but not `Personal AI`. EventKit found `Personal AI` with 4 total items and 0 incomplete items. All items are completed historical Doubao / notification feedback, so no Scheduled Messages Config sync feedback is incorporated and no Reminder item should be marked done.

## External Signals

- Google Sheets `RAW` value input keeps values stored as entered, supporting the existing Config write choice for rule IDs, URLs, and timestamps.
- Microsoft Power Platform environment variables separate deployable app logic from environment-specific references and centralize reusable config values, reinforcing Sheet Config as the portable source while local storage remains runtime cache.
- Airtable automation run history distinguishes current configuration from past run context; this supports keeping Config sync, Messages refresh, and actual execution separate in the UI.
- Trigger-action debugging research shows end users struggle to locate and repair automation faults without stage-level feedback. Manual Config sync should name what was checked, what was adopted, what was not written, and what still needs recovery.

## Validation Target

- `node --check tools/verify-scheduled-messages-config-sync-e2e.mjs`
- Direct ConfigSyncService test with the repo's `ts-node/esm` shape
- `npm start -- --progress`, stopped after first successful compile
- `npm run verify:scheduled-messages-config-sync:e2e`
- Scoped `git diff --check`

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root planning files are stale Scheduled Messages one-click setup notes | Planning restore | Use a dedicated `.planning/2026-07-12-automation-scheduled-config-sync-button-boundary/` directory and update `.planning/.active_plan` |
| AppleScript did not show `Personal AI` | Reminder probe | EventKit fallback found the list and confirmed 0 incomplete items |
| Process probe matched its own parallel command | First process check | Re-ran a standalone `ps`/`awk` check; no webpack or Config Sync E2E process remained |
