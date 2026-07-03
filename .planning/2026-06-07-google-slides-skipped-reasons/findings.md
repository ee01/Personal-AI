# Google Slides Skipped Reasons Findings

## Initial Context

- Randomly selected feature: `Slides partial success skipped reasons`.
- Capability: Google Slides Analyzer.
- Source document: `docs/features/google_slides_analyzer.md`.
- Feature index row: `跳过原因保留`.
- Carry-over check: `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no local Reminder feedback can be incorporated or completed in this run.
- Worktree is already broadly dirty. Treat unrelated changes as pre-existing and avoid reverting or staging them.

## Research Findings

- Google Gemini in Slides supports generated slides/text/images, Drive file references, preview/insert actions, retry/refine, and feedback. This supports keeping Personal AI writeback as a reviewed insert/apply flow rather than silent modification.
- Microsoft 365 Copilot release notes emphasize adjustable length, tone, style, and visual controls in PowerPoint. This supports visible controls and receipts around what will change, not just a generated answer.
- NB2Slides links generated slides back to notebook context and reports that users questioned full automation, preferring human-AI collaboration. This supports field-level provenance and manual takeover for skipped fields.
- Slide4N frames slide creation as interactive human-AI collaboration with refinement/customization, outperforming fully manual or fully automatic approaches in its study. This supports recoverable partial success and user-editable handoff.
- SlideBot highlights reliability through retrieval and practicality through iterative feedback. This maps to source-backed suggestions and explicit follow-up items when writeback cannot be completed.

## Code And UX Findings

- `docs/features/google_slides_analyzer.md` is mostly current and already describes skipped reasons, submitted field receipts, and manual takeover after partial success.
- `src/modals/slides-analysis.tsx` builds field-level submitted receipts and tries to match skipped errors back to selected fields by project and field label.
- `src/slide.ts` uses field-specific errors for missing writable columns, but invalid `slideId` / `tableId` / `rowIndex` creates only one project-level error: `缺少或无效更新位置信息`.
- Because invalid-location errors lack a field label, the completion panel can fall back to `未匹配到提交字段`, losing the exact field suggestion and evidence even when the submitted receipt contains it.
- Existing E2E already proves missing-column handoff; it should also prove invalid-location handoff with field-level matching.

## Implementation Plan

1. Add a helper in `src/slide.ts` that emits one invalid-location skipped reason per selected field, using the same field labels as the handoff matcher.
2. Keep the no-field fallback generic for defensive compatibility.
3. Update deterministic verifier expectations for invalid row failures.
4. Extend the Google Slides Analyzer E2E fixture with an invalid-location partial-success reason and assert it matches the submitted owner field and location-specific next step.
5. Update the feature doc to state that invalid row/table/slide positioning is preserved as field-level skipped reasons for manual takeover.

## Validation Findings

- `npm run verify:google-slides-analyzer` passed.
- `npm start` compiled the development extension successfully in 14419 ms and the watcher was stopped with Ctrl-C after first compile.
- `npm run verify:google-slides-analyzer:e2e` passed.
- `git diff --check` passed for the full dirty worktree.
