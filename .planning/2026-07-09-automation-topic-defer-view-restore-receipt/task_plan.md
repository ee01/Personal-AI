# Topic Defer View/Restore Receipt Plan

## Target

- Feature: `主题稍后处理` under Topic Messages.
- Canonical doc: `docs/features/topic_based_messages.md`.
- Main surface: `src/modals/components/EntityListPage.vue`.

## Plan

1. Confirm the existing Topic defer implementation, docs, and verifier coverage.
2. Add a low-friction `查看稍后` path after a topic is deferred so users can immediately verify where the topic went.
3. Add a list-level `恢复未读回执` after restoring a deferred topic, matching the detail-page no-write/no-sync boundary.
4. Update the Topic Messages docs/index and the existing targeted/E2E checks.
5. Run `verify:topic-based-messages`, first successful `npm start` compile, `verify:topic-based-messages:e2e`, and scoped `git diff --check`.
