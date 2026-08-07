# Memory Lens Hover Peek Provenance Plan

## Target

Random feature selected from `docs/index.md`: `记忆提示 Hover Peek` under `Memory Lens`.

## Findings

- `docs/features/memory_lens.md` already describes the high-level Hover Peek contract: strength label, why chips, one-line title, short summary, and a footer with source, recorded time, and readable source title.
- The reusable helper `buildContextRecallPeekFooterItems()` currently omits timestamp and may spend all three footer slots on source-memory metadata before freshness appears.
- The live content script builds Hover Peek footer text separately from that helper, so helper tests can pass while the real preview drifts.
- Local Reminders access works, but there is no `Personal AI` Reminders list on this Mac, so no Reminder item is attached to this run.

## Industry Notes

- Slack AI Search and Notion Enterprise Search both foreground source citations and source previews/scopes, which supports making provenance visible before the user opens a full card.
- Chrome `activeTab` guidance reinforces user-gesture and temporary-access mental models; Hover Peek should remain non-interactive and low-authority until the user intentionally opens the card.
- RAGAS separates context relevance from answer quality, and peripheral-display research emphasizes abstraction plus notification level, supporting a concise source/freshness footer instead of a larger preview.

## Implementation Plan

1. Extend `buildContextRecallPeekFooterItems()` so Hover Peek metadata includes a readable timestamp before secondary reason/evidence chips.
2. Use the same helper in `contentScriptWebIntelligence.ts` for the live Hover Peek footer instead of maintaining a separate ad hoc formatter.
3. Add focused assertions in `tools/verify-webpage-memory-detection.ts`.
4. Update `docs/features/memory_lens.md` to state the footer ordering and helper source of truth.
5. Validate with the Memory Lens helper verifier, first successful `npm start` compile, and `git diff --check` for touched files.
