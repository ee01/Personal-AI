# Custom Prompt Preview Copy Receipt

## Context

- Selected feature: `docs/features/custom_prompts.md`
- Carry-over check: `docs/progressing/to-verify.md` is empty.
- Reminder check: local Reminders is readable, but there is no `Personal AI` list, so no Reminder item can be incorporated or completed.
- External references: current AI personalization and prompt-management products emphasize editable instructions, scoped memory/project context, prompt versions, and inspectable prompt artifacts. Personal AI already has scope, baseline, draft, and save-impact receipts; the remaining bounded gap is exporting the exact sanitized preview for audit without implying it has been saved or used.

## Improvement Plan

1. Add a current-scope "copy preview" action beside the effective preview metadata.
2. Copy the sanitized preview text that the page already renders, including low-priority `user_preference_data` boundaries.
3. Show a receipt that names the preview scope and whether the copied text is draft or saved-baseline, and states that copying does not save config, trigger analysis, or write memory-service backup.
4. Extend targeted verifier and E2E assertions for the UI control and receipt.
5. Update the canonical feature doc with the user-visible behavior.
6. Verify with `verify:custom-prompts`, `npm start` first successful compile, `verify:custom-prompts:e2e`, and `git diff --check`.
