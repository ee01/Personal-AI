# Remind stale quick-menu request plan

## Target

- Feature: Message Reaction / 稍后处理 / Remind
- Source doc: `docs/features/message_reaction.md`
- Main code: `src/message-reaction/MessageReactionUI.ts`

## Improvement Plan

1. Keep the existing Remind quick-menu receipts and create/update semantics unchanged.
2. Add a request-validity guard that can be checked both before and after async local marker snapshot reads.
3. Preserve intentional keyboard/click opens and the custom-time back path by allowing those paths to reopen without hover.
4. Document the stale-request boundary in the Remind feature doc.
5. Verify with targeted Message Reaction tests, first successful extension compile, the existing toolbar E2E, and scoped diff hygiene.

## External Signals

- Slack Later keeps saved/reminded items in a dedicated later workflow and supports editing reminders instead of losing the item.
- Gmail Snooze returns the item only at the chosen time when notifications are enabled.
- Mobile notification-snoozing research frames snooze as user-controlled deferral, so the Remind UI should avoid creating a second interruption through stale hover UI.
