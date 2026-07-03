# Topic deep-link match-basis receipt plan

## Target

- Random feature: `Topic Messages` / `主题详情深链定位`
- Canonical doc: `docs/features/topic_based_messages.md`
- Main runtime surface: `src/modals/components/TopicDetailPage.vue`

## Research signals

- Slack exposes message permalinks from channel and timestamp inputs, so imported links often arrive as timestamp/path aliases rather than one canonical id.
- Microsoft Teams deep links distinguish chat id, message id, parent message id, and context type, which supports showing users what exact anchor was used.
- Zulip treats message IDs as stable navigation anchors and supports jumping near or exactly to a message by id.
- Conversational-context visualization research supports making context anchors and match basis visible to reduce cognitive effort in long conversation review.

## Current behavior

- `?messageId=` switches to the conversation tab, clears local filters, expands the matched parent discussion, highlights the parent or context message, and marks it read through the existing entity-cache path when applicable.
- Matching already supports ids, snake_case ids, encoded values, permalink parameters, URL path tails, and Slack timestamp/permalink aliases.
- The success receipt currently says which families of aliases can match, but not which basis actually matched this link.
- The success receipt is cleared after the same 6 second timeout as the visual highlight, so the read-sync boundary can disappear before the user checks it.

## Implementation steps

1. Add a small match-basis formatter in `TopicDetailPage.vue` that compares the link candidates with the matched target message identities and displays a safe, compact request/match summary.
2. Keep the success receipt after the 6 second highlight fade, with an explicit dismiss action, while preserving automatic clearing when there is no `messageId` or a different deep link is processed.
3. Update the Topic Messages doc to mention visible match basis and persistent receipt semantics.
4. Extend the existing static and Playwright verifiers to assert URL-parameter and Slack-alias match-basis receipts.

## Non-goals

- Do not change `findTopicConversationByMessageId` semantics.
- Do not change read-sync payloads or `CACHE_ENTITY`.
- Do not add backend history fetch for missing deep links.
- Do not change source-link safety rules.

## Validation

- `npm run verify:topic-based-messages`
- `npm start` until first successful webpack dev compile, then stop
- `npm run verify:topic-based-messages:e2e`
- Scoped `git diff --check`
