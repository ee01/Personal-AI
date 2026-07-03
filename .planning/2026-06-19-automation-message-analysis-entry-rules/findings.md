# Message Analysis Entry Rules Findings

## Initial Findings

- Randomly selected feature from `docs/features/index.md`: `记忆入口规则`.
- Feature owner/capability: Message Analysis.
- Source document: `docs/features/message_analysis.md`.
- Index description: 手动规则与系统观察规则的统一运行时视图.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has many unrelated dirty files from prior work. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/message_analysis.md` is current on the core architecture: manual `concernedItems`, runtime system observations, `analysisRules`, final scope validation, import/export receipts, empty/stale system observation receipts, and XML import normalization are already documented.
- The rule page (`src/modals/topic-modal.tsx`) has strong receipts for save/import/export/system-observation paths, but the `立即分析最近 ... 小时消息` command is still only a toolbar button.
- `handleSendToLLM()` opens or finds RingCentral, reads messages from the configured `MESSAGE_CONTEXT_WINDOW`, and calls `analyzeMessages(...)` as a one-time manual scan.
- `analyzeMessages(...)` can proceed into memory ingestion and downstream notification, digest, auto-reply, follow-thread, and RuntimeAction planning based on matched rules. Manual scans are not blocked by the background task enabled flag because `isScheduledTask=false`.
- UX gap: before clicking, the user cannot see that this is a one-time historical-window scan, not the background capture toggle, and that successful matches can write or trigger configured side effects.

## External Reference Findings

- Slack Workflow Builder's keyword-triggered workflow docs require choosing channels and keyword conditions before publishing a message-triggered workflow. This supports a visible trigger/scope receipt before running message analysis.
- Zapier filter/path docs describe conditions as gates that decide whether later workflow actions continue. This supports explaining final scope validation and downstream actions before a manual run.
- Trigger-action programming research shows users struggle with mental models of triggers, conditions, and action consequences. This supports making the manual analysis button's read/write/action effects explicit.
- Attention-sensitive alerting research frames notifications as a tradeoff between alert value and interruption cost. This supports surfacing whether matched rules can notify immediately, digest later, or stay silent.
