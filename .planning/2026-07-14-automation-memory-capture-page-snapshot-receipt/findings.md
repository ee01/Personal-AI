# Findings & Decisions

## Requirements
- Pick one feature from `docs/features/index.md`.
- Confirm docs match code at useful granularity.
- Search comparable products and research.
- Implement low-decision improvements directly, update docs, and verify.
- Check local Reminders list `Personal AI` and mark completed items done only when incorporated.

## Selected Feature
- Feature: `整页资料保存`
- Capability: `Memory Capture`
- Source doc: `docs/features/memory_capture.md`
- Scope: whole-page suggestion/review/auto-save receipts in `src/contentScriptWebIntelligence.ts`.

## Reminder Findings
- EventKit access granted.
- `Personal AI` list exists with 4 total reminders, 0 incomplete, 4 completed.
- Completed reminders are historical Doubao / Notification items, not related to whole-page Memory Capture.
- No Reminder item will be marked done in this run.

## Research Findings
- Notion Web Clipper exposes clipping as an explicit page save, with destination and notes as first-class controls.
- Obsidian Web Clipper supports full pages, selected text, main content, and templates/metadata, reinforcing that source metadata matters at save time.
- Readwise Reader-style clipping/highlighting patterns emphasize preserving saved source material and later review.
- Keeping Found Things Found / PIM research frames web saving around later re-finding, so the saved snapshot and reason for saving should remain visible.
- AI memory systems such as Mem0, Letta archival memory, and ChatGPT Memory controls reinforce layered memory, retrieval boundaries, and deletion/review controls.

## Technical Findings
- `docs/features/memory_capture.md` already documents whole-page suggestion, review, auto-save pending, success, failure, view, and undo flows.
- Current code has structured write/no-write receipts and auto-save pending receipts, but whole-page entry and pending/success/failure text do not consistently expose a concise page snapshot basis or the auto trigger basis.
- Existing verifier coverage is `tools/verify-webpage-memory-detection.ts` and E2E is `desktop-app/scripts/webpage-memory-detection-check.mjs`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add helper text in `src/contentScriptWebIntelligence.ts` | Keeps snapshot/trigger basis consistent across chip, review, pending, success, and failure states. |
| Assert phrases in static verifier first | Fast guard for presentation copy before full extension E2E. |
| Use existing E2E harness | It already drives whole-page and source-memory capture flows. |

## Resources
- https://www.notion.com/web-clipper
- https://www.notion.com/help/web-clipper
- https://obsidian.md/help/web-clipper
- https://dl.acm.org/doi/10.1145/502585.502607
- https://docs.mem0.ai/core-concepts/memory-types
- https://docs.letta.com/guides/core-concepts/memory/archival-memory/
- https://help.openai.com/articles/8590148-memory-faq
- https://arxiv.org/abs/2512.13564
