# Findings

## Repo State

- `docs/progressing/to-verify.md` says `暂无。`
- Worktree has broad pre-existing dirty state across docs, source, tools, planning, generated files, and automation memory. This run is scoped to Ask active-answer time-basis changes only.
- Recent automation memory covered Native Join, Memory Lens site controls, Meeting Panorama, memory search/timeline safe links, Rehearsal list cards, and Message Analysis refresh; this run rerolled away from Storyline because that family was also fresh.

## Selected Feature

- Random sample produced Storyline first, then several viable candidates. Selected `Ask 活答案记忆` because it is not the freshest exact automation target and has strong existing API/UI verification.
- Source doc: `docs/features/ask.md`.
- Main implementation: `memory-service/src/core/AnswerMemoryService.ts`, `memory-service/src/routes/ask.ts`, `src/modals/components/SearchResultPage.vue`.
- Existing checks: `memory-service/src/__tests__/api-ask.test.ts`, `tools/verify-ask-clarification-e2e.mjs`, `npm start`.

## Reminder Check

- AppleScript lists many reminder lists but not `Personal AI`.
- EventKit returned `granted=true`, found `Personal AI`, `PERSONAL_AI_TOTAL=4`, `PERSONAL_AI_INCOMPLETE=0`.
- No Reminder item needs implementation or completion.

## Product / Research Scan

- Slack AI answers appear at the top of search results and include citations to source messages/files, with sharing requiring review.
- Notion Enterprise Search cites sources for answers and lets users narrow search to specific sources/connectors.
- OpenAI company knowledge gives app-context answers with citations back to originals and respects user/admin permissions.
- CONQRR rewrites conversational questions into standalone retrieval queries, matching Ask's topic-lock/continuation design.
- STALE shows stale and updated memories can coexist without adjudication; active answers should not hide freshness/review boundaries.
- IBM RAG trust/transparency research suggests confidence alone is not enough; source transparency and user control matter.

## UX Gap

Ask already exposes current evidence, prior count, AuthorityGate decision, and non-effects. The remaining gap is that stale or previously verified answer-memory priors do not carry an explicit review time basis into the first-screen UI, even though the thread stores `lastVerifiedAt` and `staleAfter`.

## Decision

Add `lastVerifiedAt` and `staleAfter` to answer-memory receipts where a prior/thread is involved, then show compact metrics in Search Result's Ask status rail and active-answer receipt. Keep the change presentation-only.
