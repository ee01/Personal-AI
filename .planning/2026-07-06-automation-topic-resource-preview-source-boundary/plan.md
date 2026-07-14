# Topic Resource Preview Source Boundary

## Target

- Feature: `Topic 来源链接安全展示`
- Canonical doc: `docs/features/topic_based_messages.md`
- Primary UI: `src/modals/components/EntityListPage.vue`

## Findings

- `TopicDetailPage.vue` already uses `topic-link-safety.ts` to expose safe hosts, hide unsupported / credentialed URLs, show fallback-filter reasons, and leave a post-click source-open receipt.
- `EntityListPage.vue` already opens only safe `http(s)` resource preview links and shows a post-click no-sync receipt.
- The remaining UX gap is pre-click: a Topic card resource preview only says `打开` / `详情`, so the user cannot see the target host, hidden-source reason, or no-sync boundary until after clicking.
- EventKit found the `Personal AI` Reminders list, but all 4 items were completed historical Doubao / Notification feedback and unrelated to Topic source links.

## Plan

1. Add a visible source note to Topic list resource preview rows:
   - safe URL: show `来源 <host> · 仅打开标签页`
   - unsafe URL: show `来源已隐藏 · <reason>`
   - no usable URL: show `无可信外链 · 打开详情`
2. Strengthen the preview tooltip so click-before-action explicitly says no Memory Service sync, no read marking, and no platform write.
3. Update targeted static verifier and E2E assertions for the new pre-click note.
4. Update `docs/features/topic_based_messages.md` concisely.
5. Verify with `npm run verify:topic-based-messages`, `npm start` first successful compile, `npm run verify:topic-based-messages:e2e`, and scoped `git diff --check`.
