# Topic unread reading batch plan

## Target

- Feature: `主题式未读阅读` under Topic Messages.
- Scope: Topic detail conversation tab, especially `readFilter=unread` entry from the topic list.
- Reminder status: Reminders is reachable, but there is no `Personal AI` list on this machine.

## Product and research scan

- Slack Unreads keeps read triage reversible and separates reading now from returning later.
- Zulip muted topics do not contribute to unread counters but remain recoverable through explicit muted-topic views.
- Email deferral research treats defer as a normal triage outcome, not a failure to read everything immediately.
- Short-text topic research reinforces that topic pages must preserve context and provenance because single chat messages are sparse.

## UX gap

The detail page already has unread/read filters, sticky unread behavior after expansion, defer/mute boundaries, and source-open receipts. The first screen still asks users to infer what the current reading batch means before they expand a message or click `全部已阅`.

That makes two trust boundaries too quiet:

- Expanding a conversation can mark that conversation as read through the current entity cache path.
- `全部已阅` updates known topic read state but does not modify the original chat platform.

## Implementation steps

1. Add a first-screen `阅读批次回执` to the conversation tab.
2. Make the receipt state-aware for unread/all/read filters, local search, group filters, and deferred/muted topic state.
3. Keep copy concise: visible batch count, unread count, current filter scope, expand boundary, and mark-all-read boundary.
4. Update `docs/features/topic_based_messages.md` and `docs/features/index.md`.
5. Extend `tools/verify-topic-based-messages.ts` and `tools/verify-topic-based-messages-e2e.mjs`.
6. Run targeted Topic Messages verification, dev compile, E2E, i18n if affected, and scoped whitespace checks.
