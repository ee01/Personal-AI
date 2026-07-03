# Prompt Config Baseline Receipt Plan

## Selected Feature

- Feature index row: `用户上下文注入`
- Source doc: `docs/features/custom_prompts.md`
- Main implementation: `src/modals/prompt-config.tsx`, `src/services/userConfigPreview.ts`, `src/agentThinking.ts`

## Context

`docs/progressing/to-verify.md` is clear. Local Reminders are reachable, but there is no list named `Personal AI`, so no Reminder item is included or completed in this run.

The current worktree already contains uncommitted Prompt Config improvements for scope-aware previews, draft receipts, low-priority `user_context` boundaries, and section receipts. This plan keeps those changes intact and adds one remaining state-clarity layer.

## External Signals

- ChatGPT Memory and custom instructions emphasize user controls, temporary/private bypasses, and manage/delete surfaces: https://help.openai.com/en/articles/8590148-memory-faq
- Claude memory exposes enable/disable controls and separates remembered context by product boundaries: https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context
- LangSmith prompt management treats prompt versions, environments, and access control as part of prompt operations: https://docs.langchain.com/langsmith/manage-prompts
- LaMP and newer personalization work show that user profile/context selection matters; more profile data is not automatically better: https://aclanthology.org/2024.acl-long.399/ and https://arxiv.org/abs/2601.12078
- OWASP prompt injection guidance reinforces separating user-controlled data from higher-priority instructions: https://genai.owasp.org/llmrisk/llm01-prompt-injection/

## Problem

The page now distinguishes saved preview from draft preview, but the saved baseline source and freshness are still mostly a transient load/save toast. After the toast disappears, a user can see that a preview is from the saved configuration, but not whether that saved configuration came from defaults, local storage, memory-service backup, or a local save whose backup failed.

## Implementation Plan

1. Add a persistent baseline/source receipt in `prompt-config.html` page chrome.
2. Track source label, saved timestamp, load timestamp, and storage boundary status after load and save.
3. Keep unsaved drafts honest: the receipt should say real analysis still reads the saved baseline until save.
4. Avoid backend/data-model changes; this is UI state and verification only.
5. Update `tools/verify-custom-prompts.ts` and `tools/verify-custom-prompts-e2e.mjs`.
6. Update `docs/features/custom_prompts.md` with the new source/freshness receipt behavior and current limitation wording.

## Validation

- `npm run verify:custom-prompts`
- `npm run verify:custom-prompts:e2e`
- `npm start` until first successful compile, then stop
- `git diff --check -- src/modals/prompt-config.tsx tools/verify-custom-prompts.ts tools/verify-custom-prompts-e2e.mjs docs/features/custom_prompts.md .planning/2026-06-13-automation-prompt-config-baseline-receipt/plan.md`
