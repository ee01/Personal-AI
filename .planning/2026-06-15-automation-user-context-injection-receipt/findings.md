# User Context Injection Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`; no carry-over verification item overrides random selection.
- Random sample selected `用户上下文注入` under Prompt Config from `docs/index.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no local Reminder feedback can be incorporated or completed for this feature.
- Existing dirty worktree is broad and predates this run. Preserve unrelated modifications.

## Code And UX Findings

- `docs/features/custom_prompts.md` is mostly current for `用户上下文注入`: it describes source toggles, saved-vs-draft baseline receipts, low-priority `user_context` wrapping, message/project scope trimming, injection receipts, copy audit receipts, and local version history.
- Core helper path is `src/services/userConfigPreview.ts`. `buildUserContextPreferenceSection()` and `buildCustomPromptPreferenceSection()` are shared by the config preview and real `src/agentThinking.ts` prompt construction, so the preview and runtime path do not drift for the injected text boundary.
- Existing tests cover the important contract: `tools/verify-custom-prompts.ts` checks low-priority `data_kind="user_context"`, tag escaping, message/project scope trimming, scope-aware receipts, empty-state causes, and section-level receipts. `tools/verify-custom-prompts-e2e.mjs` checks the extension page for the same scope switch and paused-source UI.
- UX gap: section-level user-context receipts inside the personal/team/work/communication/analysis tabs are not tied to the current preview range. The analysis tab can say message and project signals are "注入" even while the active preview is only "消息" or only "项目", so the user must mentally reconcile the tab receipt with the global preview receipt.
- Low-decision implementation slice: make `buildUserContextSectionReceipt(s)` preview-scope-aware. Base context sections should explicitly say they enter the current preview range; the analysis section should say which message/project signals are included now and which are excluded from the current preview range, using `不在范围` only when this tab has signals but none enter the active preview.

## External Reference Findings

- OpenAI Custom Instructions / personalization settings expose a direct on/off control and editable user-provided instructions, supporting this feature's visible source toggles and saved-vs-draft receipts: https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions
- Claude Code memory docs expose a `/memory` surface plus a project setting and environment override for auto memory, reinforcing that memory/context injection needs a visible scope and disable path: https://code.claude.com/docs/en/memory
- Anthropic Projects highlight per-project custom instructions, which maps to this repo's scope-specific message/project prompt controls rather than one global prompt blob: https://www.anthropic.com/news/projects
- LaMP shows that personalization improves when the system retrieves relevant profile/context entries for the current task, not when it injects a full profile indiscriminately. This supports keeping message/project context receipts explicit: https://arxiv.org/abs/2304.11406
- OWASP LLM01 treats prompt injection as a top GenAI risk caused by user input altering model behavior, supporting the current low-priority data boundary and the planned receipt clarity for what is data vs active instruction: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
