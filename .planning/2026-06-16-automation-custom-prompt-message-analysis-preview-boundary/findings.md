# Prompt Config Message Analysis Preview Boundary Findings

## 2026-06-16 Initial Findings

- Randomly selected feature after recent-family exclusion: `自定义消息分析提示词`.
- Feature owner/capability: Prompt Config.
- Source document: `docs/features/custom_prompts.md`.
- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over item to continue.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder item can be incorporated, marked done, or annotated.
- Current worktree has many unrelated modified/untracked files from prior work. Treat those as user/automation-owned and do not revert them.

## Inspection Notes

- `docs/features/custom_prompts.md` is broadly current: it documents source switches, scope-aware previews, baseline receipt, change impact, copy receipt, local history, and low-priority `user_preference_data` boundaries.
- Main UI file: `src/modals/prompt-config.tsx`.
- Shared logic: `src/services/userConfigPreview.ts`, `src/services/userConfigSanitizer.ts`, and `src/services/UserConfigStore.ts`.
- Targeted verifiers: `tools/verify-custom-prompts.ts` and `tools/verify-custom-prompts-e2e.mjs`.
- Existing history restore path (`restoreHistoryEntry`) loads the selected version into the editor, sets `hasUnsavedChanges`, changes `syncSource`, and shows a short toast: `已恢复历史版本，保存后生效`.
- UX gap: after the toast disappears, the page does not keep a restore-specific receipt near the baseline/sync area. Users can infer draft state from the generic baseline note, but not which historical version was loaded or that the restored version has not replaced the active runtime baseline or memory-service backup.
- Selected implementation slice: add a persistent "history restore draft" receipt that appears after restore and clears after manual edit, reset, reload, or save.

## External Reference Notes

- OpenAI ChatGPT memory controls and Temporary Chat guidance emphasize that personalization sources need user-visible controls and a way to avoid using stored preferences.
- Claude Code memory docs separate persistent written instructions from automatically accumulated memory, supporting explicit source labeling for durable context.
- LangSmith prompt management docs and current prompt-versioning product guidance frame prompts as versioned assets that should support rollback and production-impact clarity.
- LaMP and RUMS personalization papers support selecting only task-relevant user memory/profile items instead of blindly injecting every preference.
- OWASP prompt injection guidance and recent PCFI research support treating user-provided prompt/config text as lower-priority structured data, not executable authority over system/developer rules.
