# Memory Search Real-Failure Receipt Plan

## Selected feature

- Randomized index target: `记忆搜索结果页` / Memory Exploring search results.
- Source of truth: `docs/memory_system.md`.
- Primary UI: `src/modals/components/SearchResultPage.vue`.
- Primary state path: `src/modals/memory-store.ts`.

## Local carry-over and Reminder check

- `docs/progressing/to-verify.md`: `暂无。`
- Local Reminders is reachable, but there is no list named `Personal AI`; no related Reminder item can be folded in or marked done.
- Automation memory path had no existing file for this automation id.

## Research signals

- Glean records result-view/click feedback against search results to improve search quality, so Personal AI should keep real result identity and query context rather than replacing failures with sample cards.
- Microsoft Search emphasizes user-specific permissions and result metadata; this supports making failed backend reads explicit instead of showing plausible but unauthoritative content.
- Search-result explanation research shows even simple explanations can improve transparency, trust, and efficiency; a failure receipt is part of that explanation layer.
- Personal Information Management research frames refinding as mapping personal information back to real user needs, which makes fabricated memories especially damaging.

## Problem

`performEntityVectorSearch` and the older `vectorSearchEntities` path fell back to generated mock vector-search results when `SEARCH_ENTITIES` failed. The result cards used realistic names, projects, and topics, so a user could interpret backend failure as real personal memory evidence.

## Implementation steps

1. Add a `searchFailureReceipt` state object to the memory store that records mode, query, scope, source, backend message, and timestamp.
2. Remove generated vector-search mock fallback from search paths; failed searches must set `entities=[]` and expose the receipt.
3. Render a distinct failed-search state in `SearchResultPage.vue`, before the normal empty state, with retry and broaden-scope recovery actions.
4. Delete the now-unused generated vector-search mock function so future code cannot accidentally reconnect it.
5. Update `docs/memory_system.md` to state that search never fabricates result cards on backend failure.
6. Extend verification to cover the real-failure state and run focused search checks plus extension compile.
