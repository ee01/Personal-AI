# Ask ambiguous topic confirmation buttons

## Target

- Feature: `Ask 主动问答`
- Source doc: `docs/features/ask.md`
- Selected from `docs/index.md` after avoiding recent automation targets.

## Context

- `docs/progressing/to-verify.md`: `暂无。`
- Local Reminders was readable, but no `Personal AI` list was present, so no Reminder item was incorporated or completed.
- Existing Ask backend already returns `contextMatch.ambiguous`, candidate topics, `answerMemory.skipped`, and candidate-number continuation.

## External reference direction

- ChatGPT and Claude memory surfaces emphasize controllable memory, visible sources, and explicit boundaries around what previous context can influence.
- Raycast-style quick ask patterns keep lightweight follow-up paths close to the answer instead of sending users to a separate management page.
- Conversational query rewriting work such as CONQRR and QReCC supports turning short follow-up replies into standalone retrievable queries before retrieval.

## Plan

1. Preserve `contextMatch` in the extension client/store so Search Result can consume backend ambiguity metadata instead of scraping markdown.
2. Add a compact Search Result Ask clarification panel with candidate buttons and a boundary note.
3. On candidate click, send the candidate number with the previous `User:` / `Assistant:` candidate-list context so the backend can resolve the selected topic.
4. Update Ask docs and add a narrow extension E2E for the Search Result continuation path.

## Validation

- `npm --prefix memory-service test -- --run src/__tests__/answerMemoryService.test.ts src/__tests__/api-ask.test.ts`
- `npm start` first successful webpack dev compile, then stopped watch.
- `node tools/verify-ask-clarification-e2e.mjs`
- Scoped `git diff --check` and new-script whitespace check.
- Process check confirmed no webpack watch remained.
