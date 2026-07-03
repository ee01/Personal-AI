# Topic message deep-link identity plan

## Scope

- Feature: `Topic Messages` / `主题详情深链定位`
- Source doc: `docs/features/topic_based_messages.md`
- Primary code paths:
  - `src/modals/topic-detail-data.ts`
  - `src/modals/components/TopicDetailPage.vue`
  - `src/modals/memory-store.ts`
  - `tools/verify-topic-based-messages.ts`
  - `tools/verify-topic-based-messages-e2e.mjs`

## Research signals

- Teams and Zulip both treat message/topic links as stable anchors back to the exact conversation context.
- Slack unread/catch-up and email triage/deferral research separate reading, defer, and recovery states.
- For Personal AI, the useful improvement is not another button; it is making the link target identity dependable and keeping the read-sync boundary visible.

## Implementation plan

1. Centralize Topic message identity generation in `topic-detail-data.ts`.
2. Let deep links match raw ids, decoded ids, common URL query parameters, hash fragments, and URL path tail ids.
3. Reuse the same identity set in `TopicDetailPage.vue` for target classification, context highlighting, and DOM scroll matching.
4. Reuse the same identity set in `memory-store.ts` so successful deep-link targeting and read-state synchronization do not drift.
5. Extend targeted tests and E2E fixtures for encoded/full-link identities.
6. Update `docs/features/topic_based_messages.md` with the current behavior and boundary.

## Validation plan

1. `npm run verify:topic-based-messages`
2. `npm start` until the first successful compile, then stop it.
3. `npm run verify:topic-based-messages:e2e`
4. `git diff --check -- .planning/2026-06-15-automation-topic-message-identity/plan.md docs/features/topic_based_messages.md src/modals/topic-detail-data.ts src/modals/components/TopicDetailPage.vue src/modals/memory-store.ts tools/verify-topic-based-messages.ts tools/verify-topic-based-messages-e2e.mjs`
