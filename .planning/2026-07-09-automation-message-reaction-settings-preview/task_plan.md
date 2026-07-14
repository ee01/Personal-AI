# Message Reaction Settings Preview Plan

## Target

- Feature: `消息交互工具栏` under Message Reaction.
- Canonical doc: `docs/features/message_reaction.md`.
- Main implementation: `src/message-reaction/MessageReactionUI.ts`.

## Findings

- `docs/progressing/to-verify.md` is empty, so this run can choose a fresh feature.
- Automation memory shows the freshest exact targets were Scheduled Messages queue health, Agent Thinking, Doubao revoke, Ask, Memory Lens, Action Queue, and Task Scheduler. This run picked Message Reaction toolbar settings from the randomized sample to avoid repeating those exact surfaces.
- AppleScript listed Reminder lists but did not expose `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items. Completed items were Doubao / digest / test feedback, unrelated to Message Reaction toolbar settings.
- External scan: Gmail lets users disable hover actions, Slack Later keeps saved/reminder items in one personal place, Teams message actions/workflows require a follow-up details/confirmation step, and Microsoft Human-AI guidelines emphasize status, user control, and recovery.

## Plan

1. Add a save-before preview row to the Message Reaction settings popup.
2. Make the row update when the user toggles each local toolbar entry.
3. Keep the change presentation-only: no new storage keys, no behavior change to Snooze / Watch / Reply / Followup / Openclaw.
4. Update English translations, E2E assertions, feature docs, and the feature index.
5. Verify with targeted Message Reaction tests, dev webpack compile, Message Reaction E2E, and scoped whitespace checks.
