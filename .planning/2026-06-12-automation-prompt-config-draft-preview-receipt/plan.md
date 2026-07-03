# Prompt Config Draft Preview Receipt Plan

## Target

- Random feature: `自定义消息分析提示词`
- Canonical doc: `docs/features/custom_prompts.md`
- Runtime surfaces: `prompt-config.html`, `src/services/userConfigPreview.ts`, `src/modals/prompt-config.tsx`

## Carry-Over And Reminder Check

- `docs/progressing/to-verify.md`: `暂无。`
- Local Reminders were readable, but there is no `Personal AI` list, so no Reminder item is related or markable for this run.

## External Scan

- OpenAI Memory controls emphasize editable personalization, separate on/off controls, and saved memory history/restore.
- Claude Code memory docs emphasize inspectable loaded context and troubleshooting when instructions are not actually active.
- Prompt versioning/product docs emphasize visible change history, rollback, comparison, and traceability.
- Personalized-agent safety research warns that long-term context can legitimize risky intent, so user-editable preferences should keep data-vs-instruction and active-vs-draft boundaries visible.

## Problem

Prompt Config already has scope-aware preview, save-impact receipts, and low-priority data boundaries. The remaining UX gap is that `生效预览` renders the current draft immediately, while real message/project analysis still reads the last saved config until the user saves. The existing `保存影响` helper also misses same-size prompt body edits if token count, risk count, enabled scopes, context count, and receipt state stay the same.

## Plan

1. Add a shared `buildPreferenceDraftPreviewReceipt` helper that labels the preview as saved-active, unsaved-draft, or unsaved-but-current-scope-unchanged.
2. Update `buildPreferenceChangeImpact` to compare the sanitized preview body, not only counts/receipts, so same-size prompt text edits are still visible.
3. Render the receipt directly above the injection receipt and preview body in `prompt-config.html`.
4. Extend `tools/verify-custom-prompts.ts` for helper behavior and same-size edit detection.
5. Extend `tools/verify-custom-prompts-e2e.mjs` for draft-only and saved-active UI states.
6. Update `docs/features/custom_prompts.md` with the new user-facing boundary.

## Validation Target

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-custom-prompts.ts`
- `npm start` first successful dev compile, then stop watcher.
- `node tools/verify-custom-prompts-e2e.mjs`
- `git diff --check`
