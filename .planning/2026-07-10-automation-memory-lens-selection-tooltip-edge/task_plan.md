# Selection Memory Search Tooltip Edge Plan

## Target

- Feature: `划词查找关联记忆`
- Canonical doc: `docs/features/memory_lens.md`
- Runtime surface: `src/contentScriptWebIntelligence.ts`

## Research Notes

- Chrome `activeTab` frames user-invoked tab access as temporary and page-bounded, which supports keeping selection search scoped to the user's explicit text selection.
- Microsoft Edge Copilot context clues separate current page/open-tab context from generic suggestions, reinforcing the need to distinguish selected text from background page context.
- Slack AI search and RAG transparency research both emphasize visible source/control context near AI retrieval results, not hidden behind logs.

## Plan

1. Keep Selection Memory Search behavior unchanged: no recall payload, ranking, save, insert, send, feedback, or site-control changes.
2. Place the selection-search tooltip below the icon when the selected text is near the viewport top, so the no-save/no-send boundary remains visible.
3. Add source-level and Playwright E2E assertions for the below-icon placement.
4. Update concise feature docs and index wording, then run the Memory Lens verifier, dev compile, E2E, and scoped diff check.
