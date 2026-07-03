# Topic Messages participant context

## Target

Feature: Topic Messages / 主题式未读阅读

Random selection avoided the freshest Memory Coverage Map focus and landed on Topic Messages.

## Context checked

- `docs/progressing/to-verify.md`: no carry-over work.
- Automation memory: no existing `$CODEX_HOME/automations/automation/memory.md`.
- Local Reminders: list names were readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- External references: Slack unread/catch-up, Zulip recent conversation/topic mute, email deferral research, short-text topic modeling research.

## Gap

The topic list can already filter by topic title, unread preview text, conversations, resources, projects, tickets, webpages, and source fields. It still does not treat participants/source people as first-class recall cues, even though topic triage products expose participant filters and the repository data shape already has `people`, conversation senders, and co-occurring people.

As a user, remembering "Mira was involved in that unread thread" should be enough to narrow the current topic list. The card should also show a small participant receipt so the user does not have to open each topic just to identify the people involved.

## Plan

1. Add a reusable Topic participant extractor that reads people arrays, participant arrays/names, co-occurring Person entities, conversation senders, and context-message senders with de-duplication.
2. Include those participant labels in current-page Topic list search.
3. Show compact participant chips on Topic cards when labels are available.
4. Update `docs/features/topic_based_messages.md` with the new current behavior and remaining boundary.
5. Extend `verify:topic-based-messages` and `verify:topic-based-messages:e2e`.
6. Validate with targeted script, first successful `npm start` compile, E2E, and `git diff --check`.
