# Topic messageId deep link focus receipt plan

## Target

- Feature: Topic Messages / topic detail deep-link定位
- Source doc: `docs/features/topic_based_messages.md`
- Primary UI: `src/modals/components/TopicDetailPage.vue`
- Verification: `npm run verify:topic-based-messages`, `npm run verify:topic-based-messages:e2e`

## Current finding

- `?messageId=` already switches to conversations, clears search/read/group filters, expands the target discussion, highlights the parent/context message, and syncs explicit unread state.
- The current notice is a single transient sentence. It does not clearly tell the user that filters were reset only for定位, that read sync is local/cache-backed through the existing entity path, or what to do when the message was not in the returned detail payload.
- Reminder check: local Reminders is readable, but there is no `Personal AI` list, so no Reminder item is linked to this run.

## External reference takeaway

- Microsoft Teams and Zulip treat message/topic links as stable navigation anchors that should land the user in context.
- Slack Later and email-triage research separate reading, deferral, and revisiting, so state changes caused by a link should expose their scope and recovery path.
- Short-message topic modeling research reinforces that context messages need first-class定位, not just parent-summary highlighting.

## Implementation steps

1. Replace the plain `messageFocusNotice.text` shape with a structured deep-link receipt.
2. On success, show target type, current filter reset, read-sync outcome, and the local/cache-backed boundary.
3. On missing target, show that the detail payload did not contain the message and provide a direct "查看全部聊天记录" recovery action.
4. Keep the existing highlighter, scroll, read-sync, and timeout behavior unchanged.
5. Extend targeted source assertions and E2E expectations for both success and missing-message receipts.
6. Update the feature doc with the current UX contract and limitation.
