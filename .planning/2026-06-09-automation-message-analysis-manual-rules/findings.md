# Findings

## Local State

- `docs/progressing/to-verify.md` has no carry-over work.
- Reminders lists are visible, but `Personal AI` is absent.
- The selected feature doc is `docs/features/message_analysis.md`; it already documents manual rules, system observations, scope checks, delivery receipts, safety summaries, digest-only behavior, diagnostics, and multiple recent runtime fixes.
- Relevant files inspected: `src/watchRules.ts`, `src/modals/topic-modal.tsx`, `src/modals/topic-rule-safety.ts`, `src/messageAnalysisRuleDiagnostics.ts`, `src/messageDealing.ts`, `tools/verify-memory-entry-runtime.ts`, and `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`.

## Product And Research Signals

- Slack keyword workflows require users to choose the message trigger, channels, and include/exclude keyword conditions before publish, which supports showing trigger scope before effects.
- Zapier filters/paths keep conditional logic explicit and state that no later action runs when a filter stops an item.
- Trigger-action programming research reports user mental-model errors when rule behavior, event timing, and action consequences are implicit.
- Attention-sensitive alerting research supports separating high-interruption alerts from low-interruption digest/storage behavior.

## Implementation Opportunity

- The rule page already has scope, safety, and delivery receipts, but the delivery receipt is lane-oriented (`即时通知`, `每日摘要`, `静默入库`, `关注后续`). It does not consolidate all side effects when a rule also has auto reply or linked action automation.
- A compact boundary receipt can make the “then” side easier to trust without adding a modal or new decision: memory write path, interruption lane, auto-reply review mode, linked-action execution/approval state, and audit/recovery location.
