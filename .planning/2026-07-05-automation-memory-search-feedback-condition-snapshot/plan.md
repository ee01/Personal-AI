# 2026-07-05 Automation Plan: Memory Search Feedback Condition Snapshot

## Selected feature

- Feature: `搜索结果有用/不相关反馈`
- Capability: Memory Exploring
- Source doc: `docs/features/memory_system.md`
- Reason: Random sample produced this as a viable target and recent automation memory did not cover this exact feature. Recent adjacent search work focused on scope/loading/source safety; this pass focuses on feedback condition truthfulness.

## Current repo and reminder state

- `AGENT.md` read; runtime UI changes need `npm start` first-success compile plus focused E2E.
- `docs/progressing/to-verify.md` has no carry-over items.
- Automation memory shows recent AR Data, Doubao, Skill Foundry, Compose, Outreach, User Profile and Project Dashboard sweeps; avoid those.
- EventKit found local `Personal AI` Reminders list with 4 completed historical Doubao / Notification items. No open item is related to memory search feedback, relevance correction, search result ranking or feedback receipts.

## Industry and research scan

- Glean exposes low-friction search/chat feedback and asks for comments on downvotes so quality issues can be investigated without forcing a separate review queue.
- Microsoft Search treats user feedback as an experience-quality signal and lets admins manage feedback policies and diagnostics context.
- Algolia emphasizes binding interaction events to search identity such as query/result ids so analytics and ranking can attribute a click or conversion to the right search.
- Negative relevance-feedback research shows negative samples can improve retrieval but need careful scope; one bad result should not become an invisible global exclusion.

## UX problem

Search feedback already shows strong receipts: click-before scope, server effect, failure rollback and a post-feedback `用同一条件重新取证` action. The remaining trust gap is that the post-feedback receipt and rerun action read the page's current query/scope/mode. If the user changes search conditions while the same result remains visible, the old feedback effect can be described as if it belonged to the new query, and the button can rerun the wrong condition.

## Implementation steps

1. Add a per-result feedback condition snapshot containing query, scope, mode, entity type, selected type filter, result position and user-facing context.
2. Capture the snapshot when feedback is submitted and preserve it with the server effect or failure receipt.
3. Render post-feedback receipts from the feedback-time snapshot, and clearly label it if the current page conditions have changed.
4. Make `用同一条件重新取证` rerun the feedback-time query/scope/mode instead of the current page state.
5. Extend `tools/verify-memory-search-feedback-e2e.mjs` to mutate the route/query after a successful feedback write and verify the rerun still uses the feedback-time conditions.
6. Update `docs/features/memory_system.md` with a concise note.

## Validation

- `node --check tools/verify-memory-search-feedback-e2e.mjs`
- `npm start -- --progress`, wait for first successful compile, then stop
- `npm run verify:memory-search-feedback:e2e`
- `git diff --check -- src/modals/components/SearchResultPage.vue tools/verify-memory-search-feedback-e2e.mjs docs/features/memory_system.md .planning/.active_plan .planning/2026-07-05-automation-memory-search-feedback-condition-snapshot/plan.md`
