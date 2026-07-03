# Message Analysis Ingress Distribution Receipt Findings

## Context

- Random target from `docs/features/index.md`: `消息入库与通知分发`.
- Capability: Message Analysis.
- Source document: `docs/features/message_analysis.md`.
- Reminder scan returned list names including `We`, `Next actions`, `Tasks`, and several Chinese personal lists, but no `Personal AI` list.
- Worktree is already broadly dirty. Keep all edits scoped to Message Analysis files, verifiers, docs, this planning directory, and automation memory.

## Code And UX Findings

- `docs/features/message_analysis.md` is broadly current for the unified runtime model: manual rules and system watch rules share `analysisRules`; valid matches can write memory and then fan out to notification, auto-reply, follow-thread, digest, and automation planning.
- Runtime has three entry paths: normal filter (`reviewMessageByLLMAndSendToBot`), `agentThinking`, and `agentWorkflow`.
- Normal filter ingests first and skips downstream distribution when memory-service reports `duplicate`; this is a strong user-facing boundary but currently only appears in logs.
- Agent Thinking currently counts `shouldStore` / `shouldNotify` before actual memory write and notification attempts; storage failures are swallowed to avoid missing notifications.
- The rules page already shows rule-level scope, delivery, import/export, and stale system-observation receipts. It does not show a durable run-level receipt after `ollamaAnalysisProgress` is removed on completion.
- Existing verifiers already cover multi-rule digest + immediate notification selection, out-of-scope rejection, expired rule rejection, Agent Workflow storage review, and message-analysis rule diagnostics E2E.

## External Reference Findings

- Slack keyword-triggered workflows require a message trigger, keyword conditions, and selected channels; the important product pattern is explicit trigger scope before the workflow starts.
- Zapier filters explicitly stop later actions when data does not meet conditions; this supports showing skip/stopped counts as first-class outcomes rather than hiding them in logs.
- CHI 2019 Trigger-Action Programming bug research identifies control-flow, timing, and user-interpretation bug classes; message-analysis users need to see whether a run produced immediate action, delayed queue work, or no-op.
- Attention-sensitive alerting research frames notification delivery as a tradeoff between interruption cost and deferral cost; digest vs immediate notification should remain visible as different outcomes.

## Implementation Direction

Create aggregate delivery accounting that can be updated by existing runtime calls without changing the LLM prompt or rule semantics. Persist the final receipt in local storage and render it near the manual analysis controls as a compact, local-only outcome receipt.
