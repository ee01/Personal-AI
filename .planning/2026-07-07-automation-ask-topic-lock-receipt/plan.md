# Ask Topic Lock Receipt Plan

Goal: improve `Ask 短问句话题锁定` by making the automatic topic-lock boundary visible before the Ask answer, while keeping the backend recall/write contract unchanged.

## Selected Feature

- Feature row: `Ask 短问句话题锁定`
- Capability: Memory Service / Ask
- Source document: `docs/features/ask.md`
- Reminder state: EventKit found the `Personal AI` list with 4 total items and 0 incomplete items. No open Reminder item is related to Ask, topic lock, conversational search, or answer evidence boundaries.

## External Reference Findings

- Slack AI answers appear above search results and include citations to source messages/files, with source preview/open affordances.
- Notion Enterprise Search emphasizes answers with verified content and citations from chosen sources.
- CONQRR and Apple Question Rewriting both support converting context-dependent short questions into standalone or context-complete retrieval queries.
- IBM CHI 2025 RAG trust/transparency research supports source transparency and user control over source documents; confidence alone is not enough.

## Improvement Plan

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, feature index, automation memory, stale root planning files, Reminders, and current Ask docs/code |
| 2 | completed | Implement a pre-answer `Ask 话题锁定回执` in `SearchResultPage.vue` for `contextMatch.state = locked` |
| 3 | completed | Extend `tools/verify-ask-clarification-e2e.mjs` with a direct locked-topic case |
| 4 | completed | Update `docs/features/ask.md` and `docs/index.md` concisely |
| 5 | completed | Run focused backend/UI/E2E verification and scoped whitespace checks |
| 6 | completed | Update automation memory with current runtime and Reminder outcome |

## Decisions

- Keep the change presentation-first: no changes to `MemoryContextMatchService`, `/ask`, active recall, answer memory, evidence watch, or eval scoring.
- The receipt should sit before answer body alongside existing Ask status receipts.
- The receipt must say topic lock is only a retrieval anchor and does not confirm facts, write active answer memory, create external verification actions, send messages, or write external systems.
- Existing broad dirty worktree is not owned by this run; only the new Ask topic-lock receipt, verifier assertions, docs/index note, active-plan pointer, and this plan are owned.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| AppleScript did not list `Personal AI` Reminders | Reminder probe | EventKit did find the list and showed 0 incomplete items |
| Root `task_plan.md` is stale Scheduled Messages work | Planning restore | Created an isolated dated `.planning` plan and switched `.planning/.active_plan` |
