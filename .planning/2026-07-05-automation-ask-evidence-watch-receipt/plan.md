# Ask evidence watch receipt

Run time: 2026-07-05T19:08:05+0800

## Target

- Randomly selected feature: `Ask 主动问答` in `docs/features/ask.md`.
- Scope: Search Result Ask answer presentation only. Do not change recall, answer generation, answer-memory writes, Evidence Watch contracts, or action queue semantics.

## Findings

- `docs/progressing/to-verify.md` has no carry-over work.
- Local Reminders `Personal AI` is readable through EventKit; it has 4 total items, 0 incomplete items, and no Ask-related open feedback.
- Ask already surfaces `Ask 本轮状态`, candidate clarification, continuation, answer-memory gate, and follow-up/missing-info receipts.
- The service response and docs already include `evidenceWatch`, but the Search Result Ask answer UI did not show it as a first-screen receipt. Users could miss that a watch contract is only a future verification/deduplication state, not a confirmed fact update.

## External scan

- Slack AI answers and Notion Enterprise Search put sources or citations next to AI search answers, reinforcing visible provenance before users trust the answer.
- RAG trust/transparency research emphasizes source transparency and user controls; mixed-initiative conversational search research supports clarifying ambiguous questions instead of guessing.

## Plan

1. Add `evidenceWatch` pass-through to the client/store Ask result shape.
2. Render an `Ask 证据守望回执` before the answer body when `askResult.evidenceWatch` is present.
3. Add evidence-watch metrics to `Ask 本轮状态`, including watch state and confirm-request presence.
4. Extend the Ask clarification E2E fixture and assertions for the watch receipt.
5. Update `docs/features/ask.md` and `docs/features/index.md`.
6. Verify with targeted Ask tests, a first successful dev build, Ask E2E, and scoped `git diff --check`.

## Non-goals

- No service-side Evidence Watch behavior changes.
- No answer-memory authority changes.
- No new page, queue, or management UI.
