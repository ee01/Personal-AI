# Findings

## Initial Context

- `docs/progressing/to-verify.md` says there are no pending verification items.
- `docs/index.md` lists `Snooze 快速时间菜单` under Message Reaction and points to `docs/features/message_reaction.md`.
- Local Reminders list names are readable, but `Personal AI` is absent.
- The repo worktree was already broadly dirty before this run; avoid unrelated changes.

## Code And UX Audit

- Runtime Snooze UI is implemented in `src/message-reaction/MessageReactionUI.ts`; `src/message-reaction/SnoozeUI.ts` is older legacy-shaped code and is not the primary surface referenced by the current E2E.
- The current quick menu already opens on click/hover/ArrowDown, uses `button[role="menuitem"]`, shows a receipt, disables options while creating/opening, keeps a management entry, and restores focus after returning from the custom picker.
- Existing marker detection reads `chrome.storage.local.glipMessageMarkers` and switches the receipt into a reschedule warning when the current message has a `snooze_pending` marker.
- Gap found: in English UI, the quick-menu reschedule receipt reuses the raw cached marker label, so a stored Chinese label like `稍后 5/18 09:00` appears inside an otherwise English receipt. `contentScriptGlip.tsx` already localizes `snooze_pending` display labels to `Remind ...` for English marker badges, so the quick menu should use the same visible contract.

## External References

- Slack Later: saved message reminders can be set or edited from Later, and reminders created from a message also appear in In progress, supporting one same-source item plus a clear management path.
- Gmail Snooze: users choose a later day/time for a snoozed email, reinforcing that quick picks and custom times need concrete previews.
- Microsoft Human-AI Interaction Guidelines: status feedback, user control, and cautious adaptation support visible boundary receipts for pending/rescheduled automation.
- MobileHCI 2018 Snooze study: user-defined notification deferral commonly uses both relative delays and concrete future times, supporting the current quick option mix and the need for clear reschedule state.
