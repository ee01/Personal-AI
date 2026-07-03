# Findings

## Repository
- Target feature: `规则范围校验` in `docs/features/message_analysis.md`.
- Runtime code in `src/watchRules.ts` already normalizes sender/group candidates, supports OR semantics for comma/semicolon-separated candidates, filters before LLM, and revalidates `matched_rule_refs` before write/notify/action paths.
- UI code in `src/modals/topic-modal.tsx` already shows action and safety summaries, but the scope interpretation is split across chips and guidance text. It does not put the full execution contract in one first-row receipt.
- Existing focused tests: `tools/verify-memory-entry-runtime.ts`, `tools/verify-memory-entry-message-flow.ts`, `tools/verify-memory-entry-agent-thinking.ts`, `tools/verify-memory-entry-agent-workflow.ts`, `src/modals/__tests__/topicRuleSafety.test.ts`, and `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`.

## Reminders
- Local Reminders is reachable.
- The list names do not include `Personal AI`; no related Reminder item can be inspected or marked done.

## External References
- Slack keyword-triggered workflows require a message trigger plus keyword conditions and chosen channels.
- Zapier filters/paths make conditions the gate before later actions continue.
- Trigger-action debugging research highlights that users struggle to debug automations when trigger, condition, and action consequences are not explicit.
- Human-centered proactive-agent work emphasizes reducing intrusive proactive behavior by foregrounding user expectations and control.

## Implementation Direction
- Add a reusable `getRuleScopeExecutionReceipt()` helper.
- Receipt should state: candidate selection uses sender/group scope before semantic matching; multiple candidates use OR per dimension and AND across dimensions; final dispatch/writeback rechecks sender/group/time/system-observation scope; empty scope is global; manual rule edits never import system observations or analyze history by themselves.
