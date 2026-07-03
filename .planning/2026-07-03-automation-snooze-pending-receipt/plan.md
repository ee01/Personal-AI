# Snooze pending duplicate receipt plan

## Target

- Randomly selected feature: `Snooze 去重与撤销`
- Feature family: Message Reaction
- Canonical doc: `docs/features/message_reaction.md`
- Primary code: `src/message-reaction/SnoozeManager.ts`, `src/message-reaction/MessageReactionUI.ts`, `src/message-reaction/snoozeCreateResult.ts`, `src/message-reaction/snoozeToastActions.ts`

## Current findings

- `docs/progressing/to-verify.md` has no carry-over item.
- AppleScript does not list `Personal AI`, but EventKit found the list. All 4 items are already completed historical Doubao / digest / sync feedback and none are related to Snooze.
- Existing Snooze docs and tests already cover quick-menu receipts, existing-marker reschedule previews, success Toast undo/management actions, stale undo protection, marker sync lag, and management fallback.
- The current `request_pending` path correctly blocks duplicate writes and suppresses a red error Toast, but the second click can look like a no-op. A neutral receipt would better explain that the new click was ignored while the first request owns the write path.

## External references

- Slack reminders and Slack Later keep message reminders recoverable in one place and support completing, editing, or deleting them from a management surface.
- Gmail Snooze keeps deferred emails available from a Snoozed view, so users have a clear recovery path even when the item is temporarily removed from the main flow.
- The MobileHCI 2018 Snooze study found users actively defer notifications to user-defined times; the interface should make deferral and redelivery state legible.

## Implementation plan

1. [done] Add a neutral pending receipt helper for `request_pending` results:
   - Say the same-message Snooze request is already being created or updated.
   - Say this click did not create a second row, did not change the reminder time, and did not write memory or send a Bot message.
   - Keep the management path available for recovery.
2. [done] Render the pending receipt from both quick-menu and custom-picker Snooze submit paths when `reason === 'request_pending'`.
3. [done] Add focused unit coverage for the new helper and preserve the existing `getSnoozeCreateFailureMessage()` suppression behavior.
4. [done] Add i18n entries for English UI copy.
5. [done] Update `docs/features/message_reaction.md` without over-detailing implementation internals.
6. [done] Verify with `npm run verify:message-reaction`, `npm start` to first successful compile, `npm run verify:message-reaction:e2e`, and scoped `git diff --check`.

## Completion notes

- Added an informational Snooze pending toast for duplicate `request_pending` clicks, wired through quick-menu and custom-picker submission paths.
- Added English translation coverage for the new receipt copy.
- While running Message Reaction E2E, the existing Watch flow exposed a missing draft boundary receipt in `topic-modal.tsx`; the form now renders the existing follow-thread draft receipt before save without changing Watch save or runtime semantics.
- No Reminder item was open or related to Snooze, so no Reminder item was marked done.

## Verification

- `npm run verify:message-reaction` passed 91/91.
- `npm start -- --progress` compiled successfully once in 15566 ms and was stopped.
- `npm run verify:message-reaction:e2e` passed.
- Scoped `git diff --check` passed for the touched Snooze, Watch receipt, docs, and plan files.
- No `webpack --watch` or `message-reaction-toolbar-check` process remained.

## Non-goals

- Do not change Background duplicate protection.
- Do not change Snooze creation, reschedule, undo, Google Sheet, marker cache, or Bot delivery behavior.
- Do not mark any Reminder item done because none is open or relevant.
