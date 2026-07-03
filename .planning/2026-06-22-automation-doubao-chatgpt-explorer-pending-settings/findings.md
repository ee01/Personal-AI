# Findings

## Repo And UX

- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory shows many recent exact targets; this run keeps the initial random target because it exercises a distinct Desktop App input ingestion path rather than the recent Quick Ask voice output path.
- Local Reminders lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`. No `Personal AI` list was available.
- Current source cards already show saved-state pipeline receipts, manual-run completion receipts, transport fallback copy, and revoke scope receipts.
- UX gap: after the user edits source enablement, lookback days, interval, default scope, ChatGPT max conversations, or daily-browser transport, the visible pipeline receipt still describes the saved state until the user clicks Save/Login/Run. A user can easily mistake the edited form values for background-effective settings.
- Implementation target: render a pending settings receipt based on unsaved form values and saved settings, and keep manual run behavior unchanged: Save pending settings first, then run.

## External References

- OpenAI ChatGPT Memory FAQ: memory sources and controls are surfaced as user-facing explainability, but sources may not fully explain every factor. Explorer should expose source and scope state without overclaiming precision.
- OpenAI ChatGPT data export: official export remains a user-controlled history retrieval path. Explorer should distinguish live reading/cache from durable import/write.
- Anthropic Claude memory import/export: import is an explicit user flow and experimental enough to require clear transfer boundaries.
- Gemini Privacy Hub and Gemini import-memory pages: chat/activity saving, temporary chats, deletion, and import are separate controls. Explorer should not collapse read/cache/extract/write/delete into one success state.
- Mem0: long-term memory systems benefit from extracting and consolidating salient conversational facts instead of carrying full chat histories.
- LongMemEval: long-term memory quality depends on extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. This supports visible skipped/low-signal and provenance state in the input pipeline.
