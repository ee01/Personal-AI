# Topic muted list restore receipt plan

## Target

- Feature: `主题静音` under Topic Messages.
- Source doc: `docs/features/topic_based_messages.md`.
- Main UI: `src/modals/components/EntityListPage.vue`.
- Verifier: `tools/verify-topic-based-messages-e2e.mjs`.

## Context checked

- `AGENT.md` read.
- `docs/progressing/to-verify.md` has no carry-over items.
- Automation memory shows the freshest sweep covered Message Reaction Snooze, so Topic Messages is not a duplicate of the newest target.
- EventKit found the local `Personal AI` Reminder list with four completed Doubao / Notification historical items and no open Topic Messages feedback.
- Existing Topic detail work already has local restore receipts; the list page still restores muted topics without a persistent no-write receipt.

## External scan

- Slack mute docs separate notification muting from leaving or deleting a conversation and support temporary mute.
- Zulip topic/channel mute docs keep muted topics recoverable and distinguish mute/unmute from unread semantics.
- Microsoft Teams notification docs show mute as personal attention control, not shared conversation mutation.
- Notification-interruption and email-deferral research both support reducing low-value interruptions only when recovery and re-entry remain clear.

## Implementation steps

1. Add a Topic list `取消静音回执` after `restoreMutedTopic` from both the muted-card restore button and the post-mute undo toast.
2. Keep semantics unchanged: remove only the local muted topic entry, preserve unread state, do not sync Memory Service or write the source platform.
3. Extend Topic E2E to assert the new receipt for both restore entry points.
4. Update `topic_based_messages.md` and `docs/features/index.md` with a concise current-behavior note.
5. Run targeted Topic checks, dev compile, E2E, and scoped diff checks.
