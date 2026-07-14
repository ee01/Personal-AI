# Google Slides Partial Success Reselect Plan

## Target

- Feature: `Slides partial success skipped reasons`
- Source doc: `docs/features/google_slides_analyzer.md`
- Main UI: `src/modals/slides-analysis.tsx`
- E2E: `tools/verify-google-slides-analyzer-e2e.mjs`

## Plan

1. Confirm current code and docs for partial-success skipped-field handling.
2. Add a visible post-apply selection receipt so old Google Slides confirmation stays separated from newly reselected local fields.
3. Update E2E to prove `重选跳过字段` shows the previous-batch boundary and current local reselect scope.
4. Update concise feature docs/index text.
5. Verify with the Google Slides analyzer E2E, `npm start` first compile, and scoped diff checks.

## External Signals

- Google Slides API `batchUpdate` validates each subrequest and applies the batch atomically; UI must not imply local skipped/reselected fields were already written.
- Gemini in Google Slides keeps generated suggestions behind preview/insert/copy controls, which supports explicit user-controlled handoff rather than silent writeback.
- NB2Slides / Slide4N research emphasizes human-AI collaboration and further editing rather than full automation for slide creation workflows.
