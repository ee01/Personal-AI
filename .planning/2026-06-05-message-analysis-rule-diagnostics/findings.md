# Message Analysis Manual Rule Diagnostics Findings

## Current State

- `docs/features/message_analysis.md` already documents manual rules, system observation rules, scope validation, action delivery, and prior UX improvements such as when/then summaries.
- Runtime matching is centered in `src/watchRules.ts`; final scope filtering is already applied in `reviewMessageByLLMAndSendToBot`.
- `tools/verify-memory-entry-runtime.ts` confirms multi-scope matching, token-aware short-scope matching, and final rejection of out-of-scope hallucinated rule refs.
- `tools/verify-memory-entry-message-flow.ts` already has an out-of-scope hallucination case that asserts no ingest and no notification.
- Rule UI in `src/modals/topic-modal.tsx` already has scope guidance and safety summary, but it does not show recent runtime scope rejections that would explain why a rule did not fire.

## Reminder State

- Apple Reminders lists visible locally: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` list, so there are no related Reminder items to incorporate or complete.

## External Signals

- Slack Workflow Builder message triggers require explicit keyword conditions and channels; this supports keeping rule scope visible at the top of the UI.
- Zapier filters show pass/fail test feedback and warn when a condition would always continue; this supports exposing rejected runtime attempts, not only saved config.
- Trigger-action language research reports that trigger wording and order influence users' mental models; keeping `当 -> 则` and adding concrete recent examples should improve predictability.
- EUDebug research argues that end-user trigger/action systems need problem explanations and simulation/debugging support; a lightweight local rejection log is the smallest useful step for Personal AI.
- 2026-06-06 refresh: Zapier filter docs still emphasize explicit AND/OR criteria plus a test result that tells users whether a workflow would continue; Slack keyword workflow docs still require selecting channels and keyword conditions before publishing.
- 2026-06-06 refresh: Trigger-action debugging papers continue to support problem explanations and step-by-step simulation, while attention-sensitive alerting supports keeping rejection diagnostics non-interruptive instead of creating a new notification lane.

## Chosen Improvement

Store a privacy-local, capped diagnostic when a model-returned manual rule ref fails final sender/group scope validation. Show the newest diagnostic on the corresponding rule card as `最近拦截`, including the reason, sender/group context, and time. The resumed 2026-06-06 pass extended this from the ordinary filter path to Agent Thinking and Agent Workflow so the `消息入库与通知分发` behavior is consistent across all three analysis modes.
