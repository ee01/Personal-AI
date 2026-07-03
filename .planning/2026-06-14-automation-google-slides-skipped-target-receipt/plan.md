# Google Slides Analyzer skipped-target receipt plan

## Target

- Random feature: `Slides partial success skipped reasons`
- Canonical doc: `docs/features/google_slides_analyzer.md`
- Main UI: `src/modals/slides-analysis.tsx`
- Existing proof path: `verify:google-slides-analyzer`, `verify:google-slides-analyzer:e2e`

## Context

- `docs/progressing/to-verify.md` has no carry-over work.
- Local Reminders are reachable, but there is no `Personal AI` list, so no Reminder item can be folded in or completed.
- The worktree is already heavily dirty. Keep this run scoped to Slides Analyzer files and this planning folder.

## External signals

- Google Slides API `batchUpdate` validates requests before applying them; one invalid subrequest can fail the whole batch, so the UI must keep atomic-batch boundaries visible.
- Google Workspace Gemini and Copilot-style slide features frame generated slide content as editable draft material that needs source/range review before insertion.
- NB2Slides and Slide4N both support a human-AI collaboration pattern for slide work, which fits a field-level review and handoff flow rather than silent writes.

## Gap

The result page already preserves submitted fields, target cells, skipped reasons, failure receipts, and copyable handoff checklists. The weak point is matching a skipped reason back to the submitted field: the current matcher requires project context plus a recognizable field label. If a reason only carries target location, an English field name, or a looser row/table/slide phrase, the UI degrades to an unmatched skip receipt even though the selected-field preview already knows the exact target.

## Plan

1. Strengthen skipped-reason matching in `slides-analysis.tsx`:
   - Keep existing project + field matching.
   - Add field aliases for English API-ish labels.
   - Add target-location matching against slide/table/row/column text from the selected preview.
   - Prefer a unique project+target match when field text is absent.
2. Extend `verify-google-slides-analyzer-e2e.mjs` with a partial-success skip reason that does not use the Chinese field label but still names the target location.
3. Update `docs/features/google_slides_analyzer.md` to summarize the stronger target-location matching without over-documenting internals.
4. Verify with targeted Slides checks, first successful `npm start` compile, the Slides Analyzer E2E, and `git diff --check` scoped to touched files.
