# Topic Deep Link Undo Receipt Plan

## Scope

Target feature: `Topic Messages / 主题详情深链定位` in `docs/features/topic_based_messages.md`.

## Findings

- `?messageId=` already resets local filters, expands the matching conversation or context message, highlights it, and calls `markConversationAsRead`.
- The page shows a `消息定位回执`, but the recovery path for the automatic read sync mainly lives in the generic top toast. That can be missed when the user arrives from an external message link and is focused on the deep-link receipt.
- Reminders were readable, but there is no local `Personal AI` list in Apple Reminders, so no Reminder item is included in this run.
- Product references from Slack, Microsoft Teams, and Zulip support direct message anchors as re-entry points. Email deferral and conversation-curation research support keeping re-entry state and recovery controls visible near the context that changed.

## Implementation Plan

1. Change the message-focus receipt to support multiple inline actions.
2. Add an inline `撤销这次已读` action when a deep link caused read-state sync.
3. Keep `收起定位回执` and missing-target recovery actions intact.
4. Update focused source assertions and the existing Topic E2E to prove the inline undo restores the targeted context message to unread.
5. Update the Topic Messages feature doc with the new recovery boundary.
6. Verify with targeted Topic checks, first successful dev compile, E2E, and scoped whitespace checks.
