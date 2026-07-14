# Google Slides skipped handoff copy receipt

## Target

- Feature: `Slides partial success skipped reasons`
- Source doc: `docs/features/google_slides_analyzer.md`
- Main UI: `src/modals/slides-analysis.tsx`
- E2E: `tools/verify-google-slides-analyzer-e2e.mjs`

## Current state

- `docs/progressing/to-verify.md` has no carry-over.
- EventKit found the local `Personal AI` Reminder list with 4 total items and 0 incomplete items, so no Reminder item is related or markable this run.
- The result page already preserves partial-success skipped reasons, matched/unmatched handoff items, reselectable skipped fields, and copyable handoff packets.
- Gap: copying the skipped/failure handoff currently leaves only a transient toast. The page does not keep a durable receipt saying what was copied, how many items were reselectable vs manual-only, and that copying is only a local clipboard handoff.

## External signals

- Google Slides API documents `batchUpdate` as atomically validated: an invalid subrequest can make the whole batch fail.
- Gemini in Slides and Copilot-style presentation assistants keep generated content as editable draft with source/context awareness.
- Human-AI collaboration and provenance work supports keeping source, edit, and handoff provenance visible after the immediate action.

## Plan

1. Add a persistent `跳过清单复制回执` / `失败清单复制回执` after handoff-copy actions.
2. Keep copy receipts presentation-only: no writeback, no retry, no field reselection, no Memory Service / Jira side effects.
3. Include matched/reselectable and unmatched/manual counts for partial-success skipped handoffs.
4. Cover both partial-success skipped handoff and full-failure handoff in the existing Slides Analyzer E2E.
5. Update the canonical feature doc and index row concisely.
6. Verify with `verify:google-slides-analyzer`, `npm start` first compile, `verify:google-slides-analyzer:e2e`, scoped `git diff --check`, and a process check.
