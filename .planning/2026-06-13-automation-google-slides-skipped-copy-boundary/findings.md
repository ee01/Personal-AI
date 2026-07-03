# Google Slides Skipped-Reason Copy Boundary Findings

## Context

- Selected feature: `Slides partial success skipped reasons`.
- Source doc: `docs/features/google_slides_analyzer.md`.
- Primary code: `src/modals/slides-analysis.tsx`, `src/contentScriptGoogleSlide.tsx`, `src/slide.ts`.
- Primary validation: `tools/verify-google-slides-analyzer.ts`, `tools/verify-google-slides-analyzer-e2e.mjs`.

## Local Feedback

- Reminders returned lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible list named `Personal AI`; no Reminder idea can be incorporated or completed.

## Current Product/Code Notes

- The feature doc says partial success keeps skipped reasons and a copyable manual handoff checklist, and that local preflight skipped items never enter the Google Slides API batch.
- `slides-analysis.tsx` already renders a success-warning panel when `lastApplyResult.skippedCount > 0`, including submitted-field receipts, skipped reasons, and an on-screen `人工接管清单`.
- Existing E2E already checks the success warning, skipped reason title, first skipped handoff item, and the existence of `#copy-apply-skipped-handoff`.
- Initial likely gap: the E2E does not yet assert the copied partial-success handoff text itself. If the copy packet omits confirmed-write vs skipped-vs-not-sent boundaries, the user loses the receipt when handing off outside the UI.

## External Reference Notes

- Google Slides API `batchUpdate` validates each request before applying it and applies all subrequests atomically; if one request is invalid, the entire update fails. This supports keeping API failures separate from local preflight skip success.
- Gemini in Google Slides supports generating, editing, summarizing, and inserting content from the side panel, with explicit Insert/Edit actions rather than silent writeback.
- Google Workspace Gemini source controls let users constrain what sources Gemini can consult, reinforcing that source/scope boundaries should survive copied handoffs.
- Copilot in PowerPoint frames generated decks as drafts that users continue to edit/refine, and says AI-generated output should be human-reviewed.
- NB2Slides found users questioned full automation and preferred human-AI collaboration, supporting a partial-success handoff that helps manual completion instead of hiding skipped fields.

## Prior Memory Notes

- Prior Google Slides Analyzer partial-success work made invalid writeback positions field-specific rather than project-level.
- Later runs added atomic batch failure receipts, exact field targets, copyable failure handoffs, and writeback decision receipt copy coverage.
