# Memory Search Feedback Button Boundary Plan

## Selected Feature

- Feature: `搜索结果有用/不相关反馈`
- Source docs: `docs/features/memory_system.md`, `docs/features/index.md`
- Primary code: `src/modals/components/SearchResultPage.vue`
- Verification: `tools/verify-memory-search-feedback-e2e.mjs`, `npm run verify:memory-search-feedback:e2e`

## Reminder Check

EventKit read the local `Personal AI` Reminders list. It contains 4 total items and 0 incomplete items. The completed items are historical Doubao / notification / test feedback and are unrelated to Memory Exploring search feedback, relevance correction, or recall-quality training, so this run will not mark any Reminder item done.

## External Scan

- OpenAI Memory Sources expose source-level relevant / not relevant feedback as a personalization control, but the feedback is scoped to the user's own ChatGPT experience rather than a public share surface.
- Microsoft Recall documentation emphasizes local search over remembered snapshots with privacy controls and management boundaries, which reinforces that memory-search actions should show what stays local and what does not mutate source systems.
- Search-result explanation research finds explanations are most useful for complex or trust-sensitive tasks and when users can contest or correct results; noisy obvious explanations add less value.
- Classic relevance-feedback work treats positive and negative judgments as signals for future retrieval quality, not as deletion, fact confirmation, or immediate page re-ranking.

## Improvement Plan

1. Add button-level `title` / `aria-label` boundaries for `有用`, `不相关`, and `撤销` feedback actions.
2. Include the current surface, scope, target type, query/result position, and non-effects directly in the button text.
3. Add a boundary to `用同一条件重新取证`, clarifying that it reruns the feedback-time query/scope without writing another feedback marker.
4. Extend the existing E2E to assert these labels before click, after state changes, after condition drift, and after a failed feedback submission.
5. Update concise docs and the feature-index row.

## Non-Goals

- Do not change `/feedback` request schema.
- Do not change Memory Service relevance patching, salience deltas, or recall ranking.
- Do not change current-page reordering, source-link safety, Ask answer logic, or Reminder state.
