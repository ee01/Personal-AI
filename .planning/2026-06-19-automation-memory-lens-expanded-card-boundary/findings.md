# Memory Lens Expanded Card Boundary Findings

## Repo And Reminder Findings

- `docs/progressing/to-verify.md` currently says `暂无。`, so there is no carry-over feature to continue.
- Random selected feature: `记忆提示 Expanded Card` in `docs/index.md`.
- Reminder list scan returned `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; no `Personal AI` list is present.
- The worktree has many unrelated dirty files. Current run should not revert or stage unrelated changes.

## Code And UX Findings

- `docs/features/memory_lens.md` is current and already documents source receipts, source status, stale-source review prompts, personal-memory warnings, feedback failure visibility, and site-control boundary receipts.
- Core Expanded Card implementation is in `src/contentScriptWebIntelligence.ts`, especially `buildMatchView()` and `renderCard()`.
- Existing static verifier `tools/verify-webpage-memory-detection.ts` already checks source receipts, source status receipts, feedback drawer behavior, personal-memory warning, stale-source prompts, and site-control receipts.
- UX gap: Hover Peek discloses `只读提示 · 点击查看详情，不写入/插入/发送`, but direct-open users can bypass Peek and land in an Expanded Card whose footer says `我应该做什么` while showing only feedback/pager controls. The expanded state should carry its own compact action-boundary receipt.

## External Reference Findings

- OpenAI ChatGPT memory docs emphasize user control over saved memories and chat-history reference settings, including that disabling memory does not delete existing saved memories.
- Notion Enterprise Search says answers cite sources and lets users change search scope to specific sources or integrations, supporting visible provenance and scope controls.
- Slack AI search says answers use only data the user already has access to and lists included sources, reinforcing permission/scope clarity at answer time.
- IBM CHI 2025 RAG transparency research reports that source attribution/highlighting and user control improved trust more than confidence scores alone.
- ECIR 2026 RAG trust research reports that explanations help users choose higher-quality responses, but clarity and actionability also affect trust judgments. This supports adding a small, action-facing boundary receipt instead of more confidence-style labeling.
