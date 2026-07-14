# Source Memory Card Action Boundary Plan

## Target

- Feature: `Source Memory 召回卡片`
- Canonical docs: `docs/features/memory_capture.md`, `docs/features/index.md`
- Main runtime surface: `src/contentScriptWebIntelligence.ts`
- Main browser proof: `desktop-app/scripts/webpage-memory-detection-check.mjs`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Random selection landed on `Source Memory 召回卡片`; immediately recent Scheduled Messages targets were skipped.
- EventKit found the local `Personal AI` Reminders list with 4 completed items and 0 incomplete items; none related to Source Memory recall cards.

## Research Signal

- NotebookLM sources, Readwise Reader, Obsidian Web Clipper, and RAG trust/transparency research all reinforce that saved-source recall should expose provenance, source limits, review paths, and control boundaries at the action point.
- The existing card already had a visible `资料回执`; the remaining gap was that the actual detail/source links still used generic or missing hover/reader labels.

## Plan

1. Add source-memory-specific `title` / `aria-label` copy to the `在记忆中查看` detail link.
2. Add source-memory-specific `title` / `aria-label` copy to safe original-source links.
3. Keep URL sanitization, click handling, source-open receipts, feedback traces, and write behavior unchanged.
4. Update canonical docs and index with concise button-level boundary wording.
5. Verify through helper syntax, targeted verifier, first successful dev compile, existing webpage-memory E2E, and scoped `git diff --check`.

## Boundary

This is presentation/accessibility only. It does not change `/context-recall`, source-memory ranking, source URL filtering, Memory Exploring routes, capsule creation/dismissal/note APIs, feedback writes, or Reminder state.
