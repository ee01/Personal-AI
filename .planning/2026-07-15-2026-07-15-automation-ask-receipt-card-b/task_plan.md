# Ask Receipt Card Boundary Plan

Goal: improve the selected `Ask 主动问答` feature by checking current docs/code, incorporating relevant outside references and Reminder state, then implementing one bounded UX improvement with thorough verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, feature index, `docs/progressing/to-verify.md`, automation memory, memory guidance, worktree status, and planning-skill instructions |
| 2 | completed | Select a non-recent random feature from `docs/index.md` and inspect its docs, source, and verifiers |
| 3 | completed | Check local Reminders via AppleScript and EventKit |
| 4 | completed | Search current product/research references for Ask / AI search / RAG trust patterns |
| 5 | completed | Implement the selected low-decision UX improvement |
| 6 | completed | Update concise feature docs and index row |
| 7 | completed | Run targeted tests, first successful dev build, E2E, and scoped diff check |
| 8 | completed | Update automation memory and close out Reminder state if applicable |

## Decisions

- Selected feature: `Ask 主动问答`.
- Source doc: `docs/features/ask.md`; index row: `Ask 主动问答` in `docs/index.md`.
- Primary UI/source target: `src/modals/components/SearchResultPage.vue`.
- Existing verifier target: `tools/verify-ask-clarification-e2e.mjs`; backend guard: `memory-service/src/__tests__/api-ask.test.ts`.
- Scope: Ask answer receipt cards in Search Result should expose their own hover/read-screen boundaries. Do not change `/ask`, `MemoryContextMatchService`, `RecallEngine`, answer-memory persistence, Evidence Watch contracts, external action creation, or Memory Service deployment.
- Reminder state: AppleScript did not list `Personal AI`; EventKit found it with 4 total items and 0 incomplete. All completed items are Doubao/Notification related, so none apply to Ask.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Planning skill path under `.codex/skills` missing | First skill read | Read the actual skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| AppleScript did not list `Personal AI` Reminders | Reminder list scan | Used EventKit fallback; list exists but has 0 incomplete items |
| Missing `verify:ask-clarification:e2e` npm script | First E2E command | Use the actual verifier file directly with `node tools/verify-ask-clarification-e2e.mjs` |
