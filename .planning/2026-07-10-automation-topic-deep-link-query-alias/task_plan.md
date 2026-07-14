# Topic deep-link query alias plan

## Target

- Feature: `主题详情深链定位`
- Docs: `docs/features/topic_based_messages.md`
- Surface: `src/modals/components/TopicDetailPage.vue`

## Findings

- `docs/progressing/to-verify.md` is empty.
- EventKit can read the local `Personal AI` Reminder list; all 4 items are already completed and unrelated to Topic Messages or deep-link positioning.
- Existing message identity matching already recognizes `message_id`, `sourceMessageId`, URL params, encoded IDs, and Slack `ts` / permalink aliases.
- The page route only listened to `route.query.messageId`, so a valid `/topic/:id?message_id=...` or `/topic/:id?ts=...` link could silently open a normal topic detail page without focus, receipt, or invalid/missing feedback.

## Plan

1. Add a single route-query resolver for the same alias keys used by message identity matching.
2. Use that resolver in the topic-load watcher, message-focus watcher, and read-filter precedence guard.
3. Keep the existing no-history-pull and no-platform-write behavior unchanged.
4. Add E2E coverage proving `?ts=` triggers the same Slack timestamp focus path as `?messageId=`.
5. Update feature docs and index with the route-level alias contract.

## Verification

- `npm run verify:topic-based-messages`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:topic-based-messages:e2e`
- Scoped `git diff --check`
