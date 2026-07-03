# Ask Answer Memory Unverified Prior Findings

## Repo Findings

- `docs/progressing/to-verify.md` currently says there is nothing pending.
- Random selector chose `Ask 活答案记忆`; this is not the freshest automation target family.
- `docs/features/ask.md` is largely current with code: it documents context lock, active-answer observations/promotions, AuthorityGate decisions, Search Result status rail, follow-up receipts, and validation commands.
- Backend active-answer logic in `memory-service/src/core/AnswerMemoryService.ts` already separates current authority evidence, supporting/derived/query evidence, and old prior evidence. It suppresses updates when the same evidence only changes wording, and waits for new authority evidence when a state flip appears under the same evidence.
- `/ask` merges a prior hit plus no current evidence into a warning `活答案未复核` diagnostic. The UI already renders that receipt below the answer body.
- UX gap: the first `Ask 本轮状态` rail can be more explicit when `answerMemory.skipReason = no_evidence` and there are prior refs. This matters because the status rail appears before the answer body and is the earliest place to prevent old prior confusion.

## Reminder Findings

- Reminders list names returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No `Personal AI` list exists in this local Reminders database, so no related reminder item was incorporated or completed.

## External Reference Findings

- OpenAI's memory docs emphasize that users control saved memories and can delete or disable them; this supports visible source/control boundaries around reused memory.
- Claude's current memory/chat-search docs describe RAG-style previous-chat search as visible tool use and user-controllable memory; this supports showing when prior context is being reused rather than silently treating it as fact.
- The 2026 STALE paper argues that agents can retrieve new evidence and still accept outdated assumptions; this supports highlighting old-prior versus current-evidence state before the answer.
- CONQRR and related conversational query-rewriting work show why short follow-up questions need context recovery before retrieval; Ask's topic-lock and candidate-confirmation path matches that pattern.

## Decision

Implement a narrow Search Result UI improvement: if Ask active-answer state is skipped because `no_evidence` after a prior hit, show `旧答案未复核` in the status rail and use a warning detail that explicitly says the old active answer is not confirmed by this run.
