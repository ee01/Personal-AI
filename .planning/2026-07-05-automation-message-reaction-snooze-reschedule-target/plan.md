# Message Reaction Snooze Reschedule Target Receipt

## Target

- Feature: `Snooze 去重与撤销` in `docs/features/message_reaction.md`
- User-visible gap: when a message already has a pending Snooze marker, the quick menu says the next pick will reschedule the same reminder, but the receipt does not name the new target time before the user commits.

## Plan

1. Keep Snooze creation, dedupe, undo, marker sync, and Scheduled Messages behavior unchanged.
2. Extend the existing quick-menu receipt for same-source Snooze markers with a live `will reschedule to` target time.
3. Refresh that target when the user hovers, focuses, or clicks a different quick option.
4. Update focused unit and E2E assertions for Chinese and English UI.
5. Document the behavior concisely in the Message Reaction feature doc and index.

## Verification

- `npm run verify:message-reaction`
- `node --check desktop-app/scripts/message-reaction-toolbar-check.mjs`
- `npm start -- --progress` until first successful compile, then stop watch
- `npm run verify:message-reaction:e2e`
- Scoped `git diff --check`
