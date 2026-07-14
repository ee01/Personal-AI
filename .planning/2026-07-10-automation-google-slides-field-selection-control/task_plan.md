# Google Slides Analyzer Field Selection Control Receipts

## Target

- Feature: `Google Slides 项目分析器`
- Source doc: `docs/features/google_slides_analyzer.md`
- Focus: make checkbox-level selection consequences visible before users assume a field was already written.

## Plan

1. Inspect the current analyzer result page, docs, verify scripts, local Reminder state, and current product/research references.
2. Add field-level `aria-label` / `title` receipts to result-page update checkboxes and review-queue checkboxes.
3. Add project-level `aria-label` / `title` receipts to the per-card select-all checkbox.
4. Update Google Slides Analyzer E2E assertions so default, review, queue, and select-all controls prove the local-only selection boundary.
5. Update canonical feature docs and index with a concise description of the control-point receipt.
6. Verify with the targeted Google Slides analyzer verifier, first successful `npm start` compile, extension E2E, and scoped diff checks.

## External Reference Notes

- Gemini in Slides and Workspace AI docs emphasize previewing and checking generated content before using it.
- Google Slides API documents `batchUpdate` as an atomic request where invalid subrequests fail the whole update.
- NB2Slides and Slide4N position slide generation/editing as human-AI collaboration, which supports keeping field-level selection and writeback decisions inspectable.

## Reminder Notes

- EventKit found the local `Personal AI` Reminder list with 4 total items and 0 incomplete items.
- Existing completed items are historical Doubao / notification / test feedback and unrelated to Google Slides Analyzer, so no Reminder item was incorporated or marked done.
