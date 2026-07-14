# Memory Search Keyboard Open Receipt

## Target

- Feature: `记忆搜索结果页` under Memory Exploring.
- Source of truth: `docs/features/memory_system.md` and `docs/features/index.md`.
- User feedback: local `Personal AI` Reminders had 4 total items and 0 incomplete items; none related to Memory Search.

## Plan

1. Keep the current search recall, filtering, feedback, and safe-link semantics unchanged.
2. Add an explicit keyboard-focusable `打开结果` action on each search result card.
3. Reuse the existing safe open priority: memory route, safe source URL, details fallback, blocked receipt, unavailable receipt.
4. Make the action label state the no-write boundary so keyboard users get the same trust contract as mouse users.
5. Update focused static and E2E verifiers, then run dev build plus targeted E2E.

## Research Notes

- Glean and Google Agent Search both keep filters/facets next to result lists so users can narrow search without losing context.
- Faceted-search research emphasizes result counts, previews, easy reversal, and avoiding lostness in exploratory search.
- Enterprise-search feedback research supports binding feedback or opening behavior to the visible query/result context rather than treating it as a global mutation.

## Validation Target

- `npm run verify:memory-search-results`
- `npm start -- --progress`, stopped after first successful compile
- `npm run verify:memory-search-feedback:e2e`
- scoped `git diff --check`
