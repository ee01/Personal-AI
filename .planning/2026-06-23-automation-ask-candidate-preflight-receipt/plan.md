# Ask Candidate Preflight Receipt

## Target

- Random feature: `Ask 短问句话题锁定`
- Canonical doc: `docs/features/ask.md`
- Runtime surface: `memory-exploring.html#/search` Ask answer area

## Current State

- `docs/features/ask.md` already describes the current ambiguous-topic behavior, candidate buttons, candidate-number carryover, and active-answer write boundary.
- `SearchResultPage.vue` already renders `Ask 本轮状态` before the answer body and shows candidate buttons when `contextMatch.state = ambiguous`.
- Local Reminders was reachable, but there is no `Personal AI` list on this Mac, so no Reminder item was included or completed.

## External Scan

- OpenAI Memory FAQ: memory controls distinguish saved memories from chat-history reference and emphasize user control over remembered context.
- Claude chat search and memory: prior chat search is visible as RAG/tool activity, with project/incognito boundaries.
- Claude API memory tool: memory retrieval should be just-in-time and controlled by the application storage boundary.
- Apple QReCC and CONQRR: ambiguous conversational questions need context-aware rewriting or topic recovery before retrieval; wrong recovery can bias downstream answers.

## Improvement Plan

1. Add a pre-click `候选选择回执` inside the Ask clarification panel, before candidate buttons.
2. State that candidate selection only binds the short Ask to a retrieval topic and continues Ask.
3. Explicitly say it does not confirm facts, write active-answer observation/thread state, or create external verification actions.
4. Keep the backend Ask contract unchanged; consume existing `contextMatch.candidates`.
5. Update `docs/features/ask.md` and the existing Ask clarification E2E.

## Verification Plan

- `npm --prefix memory-service test -- --run src/__tests__/api-ask.test.ts`
- `node --check tools/verify-ask-clarification-e2e.mjs`
- `npm start` until first successful dev compile, then stop the watcher
- `node tools/verify-ask-clarification-e2e.mjs`
- `npm run eval:validate`
- Scoped `git diff --check`
