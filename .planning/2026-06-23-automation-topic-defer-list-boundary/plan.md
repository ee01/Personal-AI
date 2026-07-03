# Topic defer list boundary receipt

## Target

- Random feature: `主题稍后处理`
- Source doc: `docs/features/topic_based_messages.md`
- Main UI: `src/modals/components/EntityListPage.vue` and `src/modals/components/TopicDetailPage.vue`

## Plan

1. Keep the existing local-only defer model: deferred topics stay unread, persist in browser `localStorage`, and return to the unread flow when restored or expired.
2. Add a first-visible boundary receipt inside the topic-list `稍后` menu, before any preset or custom time can be selected.
3. Fix the reused Topic detail route state so a later navigation to `?readFilter=unread` is honored after a previous `?messageId=` deep link.
4. Update the canonical feature doc and Topic verification harness.

## External scan

- Slack Later and Slack reminders make deferred messages/files recoverable from a personal later queue.
- Gmail Snooze temporarily removes mail until a chosen time and then returns it to the inbox.
- Microsoft Research email deferral work shows users defer messages when they need more time, information, or context switching before acting.
- Zulip topic mute patterns reinforce that hidden attention states need an explicit way back.

## Implementation notes

- List-card defer now shows `稍后处理边界`: local browser state only, topic leaves the unread queue temporarily, no read marking, no Memory Service sync, no original-platform write, returns only on expiry or restore.
- Topic detail now refreshes `convReadFilter` from `route.query.readFilter` on topic changes when there is no active `messageId` query.

## Verification

- `npm run verify:topic-based-messages`
- `npm start` first successful webpack dev compile, then stopped watcher
- `npm run verify:topic-based-messages:e2e`
- `git diff --check -- src/modals/components/EntityListPage.vue src/modals/components/TopicDetailPage.vue tools/verify-topic-based-messages.ts tools/verify-topic-based-messages-e2e.mjs docs/features/topic_based_messages.md`
