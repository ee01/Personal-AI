# Google Slides Analyzer skipped-field recovery visibility

## Target

- Feature index row: `Slides partial success skipped reasons`
- Canonical doc: `docs/features/google_slides_analyzer.md`
- Main surface: `src/modals/slides-analysis.tsx`

## Context checked

- `docs/progressing/to-verify.md` is empty.
- Automation memory was checked; this is not one of the freshest exact June 28 sweep targets.
- Local Reminders list names are readable, but there is no `Personal AI` list, so no Reminder item is linked or completed.
- External scan: Gemini in Slides, Copilot in PowerPoint, Google Slides `batchUpdate`, NB2Slides, Slide4N, DraftMarks, and mixed-initiative visual analytics all point toward human-reviewed, source-visible slide automation with explicit non-effect boundaries.

## Improvement plan

1. Keep the existing partial-success matching and reselect behavior unchanged.
2. Make each skipped handoff row show whether it is eligible for local reselect or needs manual checking.
3. Update the feature doc and E2E assertions for the row-level recovery label.
4. Verify with the existing Google Slides Analyzer targeted script, first successful `npm start` compile, extension E2E, i18n, and scoped diff check.

## Decision

This is a presentation-layer trust fix. It does not change Google Slides API payload construction, skipped-reason matching, field selection semantics, Jira reads, or Memory Service behavior.
