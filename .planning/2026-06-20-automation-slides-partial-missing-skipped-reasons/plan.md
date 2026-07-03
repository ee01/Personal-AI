# Google Slides partial-success missing skipped reasons plan

## Target

- Feature index row: `Slides partial success skipped reasons`
- Feature doc: `docs/features/google_slides_analyzer.md`
- Primary UI: `src/modals/slides-analysis.tsx`
- E2E: `tools/verify-google-slides-analyzer-e2e.mjs`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders returned `NO_PERSONAL_AI_LIST`, so no Reminder feedback item applies.
- Recent automation memory had many receipt-oriented runs; this pass avoids a broad redesign and stays on the selected Google Slides Analyzer partial-success path.

## Research takeaways

- Google Slides `batchUpdate` validates subrequests and applies them atomically, so field-level confirmation must not imply a skipped or unmatched field was written.
- Gemini in Slides and Copilot in PowerPoint both keep generated slide work in an editable/reviewable flow with source/feedback affordances.
- Human-AI presentation research such as Slide4N supports keeping user intervention, refinement, and provenance visible instead of hiding uncertain generated or writeback state.

## Implementation steps

1. Detect `UPDATE_SUCCESS` count mismatches where `updatedCount + returned skipped reasons` is lower than the submitted selected field count.
2. Add an explicit unmatched skipped reason for that gap and count it in the success receipt.
3. Keep field-level confirmed-writeback lists hidden when unmatched skipped reasons exist, so the page only confirms the aggregate API count.
4. Update the copyable skipped-field handoff and feature doc to describe the missing-reason path.
5. Extend the Google Slides Analyzer E2E with a partial success that returns a lower `updatedCount` and no skipped reasons.

## Verification plan

1. `npm run verify:google-slides-analyzer`
2. `npm start` until first successful development compile, then stop it.
3. `npm run verify:google-slides-analyzer:e2e`
4. `git diff --check -- docs/features/google_slides_analyzer.md src/modals/slides-analysis.tsx tools/verify-google-slides-analyzer-e2e.mjs .planning/2026-06-20-automation-slides-partial-missing-skipped-reasons/plan.md`
5. Check for leftover webpack watcher processes.
