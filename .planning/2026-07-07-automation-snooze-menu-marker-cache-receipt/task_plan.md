# Plan: Snooze Menu Marker Cache Receipt

## Goal

Improve Message Reaction's Snooze quick-time menu so an existing same-source Snooze reschedule preview clearly states whether the local marker cache is fresh, stale, or not timestamped before the user treats the preview as current queue truth.

## Selected Feature

- Feature index row: `Snooze 快速时间菜单`
- Capability: `Message Reaction`
- Canonical doc: `docs/features/message_reaction.md`

## Plan

1. [complete] Read repo workflow, feature index, automation memory, current docs, current code, and Reminder state.
2. [complete] Scan relevant industry/product/research references and identify a constructive UX improvement.
3. [complete] Implement a scoped presentation-only cache freshness receipt for existing Snooze marker previews.
4. [complete] Update focused tests/E2E and concise feature docs/index text.
5. [complete] Run targeted verifier, first successful `npm start` compile, Message Reaction E2E, and scoped whitespace checks.
6. [complete] Update automation memory and close out with exact validation evidence.

## Decisions

- Do not repeat the existing uncommitted reschedule-target work. Build on it by adding cache freshness to the receipt.
- Keep behavior presentation-only: no change to reminder creation, same-source update, pending protection, Google Sheets writes, Bot delivery, marker synchronization, or Reminder.app state.
- Use EventKit Reminder state as read-only evidence; there are no open related Reminder items to complete.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Existing worktree is broadly dirty | Initial status check | Limit edits to this feature's files and new planning directory. |
| `SnoozeUI.ts` is not the current tested implementation | Source inspection | Switched to `MessageReactionUI.ts` and current presentation helpers. |
| Message Reaction E2E timed out reopening toolbar from marker tooltip focus state | First E2E run | Moved stale-menu assertion into the existing stable toolbar section and restored cache freshness before continuing. |
