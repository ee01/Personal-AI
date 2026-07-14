# Prompt Config Operation Receipt Findings

## Local Context

- `docs/progressing/to-verify.md` currently says `暂无。`, so no carry-over item takes precedence.
- Random feature sample included several recently touched areas; selected `自定义消息分析提示词` because the recent automation memory focused on Memory Lens Hover Peek and other July 2/3 surfaces, not this exact Prompt Config operation boundary.
- Reminders: AppleScript did not list `Personal AI`; EventKit found `Personal AI` with 4 items, all completed and related to Doubao / Weekly Dream Digest / notification sync. No Reminder item is relevant or needs marking done.
- The repository has broad unrelated dirty state before this run. Keep edits scoped to Prompt Config source, docs, verifier/E2E, and this planning directory.

## Code And UX Findings

- `docs/features/custom_prompts.md` is mostly current: it documents scope-aware preview, low-priority data wrappers, risk/sensitive hints, baseline receipts, copy receipts, history restore, reset, and example-draft receipts.
- `src/modals/prompt-config.tsx` currently uses one `isSaving` boolean for both saving local config and fusing user context into the profile.
- When the user clicks `融合到用户画像`, the header save button can show `保存中...`, and the page has no explicit in-flight receipt for the fusion request. That makes a profile mutation request look like generic config saving.
- This is a trust-state gap, not a backend gap. The narrow fix is presentation/state-only.

## External Reference Findings

- OpenAI ChatGPT Memory controls emphasize user review, source visibility, disabling memory, and that personalization sources may be visible without showing every factor.
- Claude memory emphasizes optional memory, project-scoped boundaries, editable memory summaries, incognito/no-memory chats, and import/export migration.
- Claude Code memory docs separate user-written instructions from auto memory and note that memories/instructions are context, not hard enforcement.
- LangSmith prompt management treats prompts as versioned artifacts with environments, commit history, tags, and rollback, reinforcing the need to show what version/state is actually active.
- LaMP shows personalization benefits from retrieving relevant profile items rather than indiscriminately injecting full user history.
- VortexPIA and related prompt-injection work show that false memories and injected persistent context can drive privacy extraction, supporting explicit pending/complete boundaries around profile-affecting actions.

