# Findings & Decisions

## Local Findings
- Selected feature: `主题详情深链定位` under Topic Messages.
- Source doc: `docs/features/topic_based_messages.md`.
- Main code: `src/modals/components/TopicDetailPage.vue`, `src/modals/topic-detail-data.ts`, `src/modals/topic-unread-preview.ts`, and `src/modals/memory-store.ts`.
- Existing docs are broadly current: `?messageId=` switches to conversations, resets read/status filters, expands, highlights, syncs read state, and handles context-message targets.
- Current weak spot: `findTopicConversationByMessageId()` can find a parent conversation through a context message, but `TopicDetailPage` treats the target as missing when the parent conversation itself lacks a primary ID. Imported or legacy records can have this shape.
- Current weak spot: several identity helpers only read camelCase fields. Backend/imported data often uses snake_case fields such as `message_id` and `source_message_id`.
- Local Reminders list scan returned `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; no `Personal AI` list was visible.

## External References
- Microsoft Teams message links take users to the specific message and highlight it; deleted or inaccessible messages produce visible feedback.
- Zulip message/topic links are permanent and message-ID based, even when messages move across topics or channels.
- Slack supports copying message links and expands shared links into previews, reinforcing that links need context and traceability.
- Short-text topic modeling research warns that instant-message text is sparse and context-dependent, so deep links should preserve parent/context relationships.
- Email deferral/triage research reinforces that unread pressure and later handling are separate mental states; deep-link read sync should be explicit and undoable.

## Improvement Plan
1. Add import/legacy identity aliases: `message_id`, `conversation_id`, `source_message_id`, `externalMessageId`, `external_message_id`.
2. In `TopicDetailPage`, derive a render ID from the sorted conversation index when the parent lacks a primary ID, then expand/highlight/scroll the exact context message.
3. Clear conversation search for `?messageId=` links so deep-link navigation always starts from an unfiltered target view, matching the feature doc.
4. Add targeted static assertions and E2E fixture coverage for a context message whose parent conversation has no primary ID.
5. Update `docs/features/topic_based_messages.md` concisely; no index row change is required because the feature already exists.
