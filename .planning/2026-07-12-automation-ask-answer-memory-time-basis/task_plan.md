# Ask Answer Memory Time Basis Plan

## Goal

Random feature sweep target: `Ask 活答案记忆` from `docs/index.md` / `docs/features/ask.md`.

Improve the user-facing Ask active-answer path so stale or previously verified answer-memory priors show a concrete review time basis instead of only abstract gate labels.

## Plan

1. [complete] Gather repo instructions, automation memory, `to-verify`, worktree state, Reminders, random feature sample, existing Ask docs/code/tests, and external product/research context.
2. [complete] Implement a scoped API/UI improvement: carry answer-memory `lastVerifiedAt` / `staleAfter` into receipts and surface those time-basis metrics in Search Result Ask status/receipt UI.
3. [complete] Update focused Ask docs and index with the concise behavior note.
4. [complete] Extend existing API and E2E coverage for verified active-answer time-basis display.
5. [complete] Run targeted Ask tests, `npm start` first successful compile, Ask E2E, scoped diff checks, and process cleanup.

## External Signals

- Slack AI, Notion Enterprise Search, and OpenAI company knowledge all emphasize answer citations/source trace near the answer.
- CONQRR and related query rewriting research support making short conversational questions standalone before retrieval.
- STALE and RAG trust/transparency research reinforce that old memory/prior state needs explicit current-evidence and freshness boundaries.

## Reminder Result

AppleScript did not list `Personal AI`, but EventKit found it with 4 total items and 0 incomplete items. No Reminder feedback applies to Ask this run.

## Scope Boundary

This run should not change Ask retrieval, context matching, answer generation, evidence-watch scheduling, active-answer promotion/update rules, or memory-service write semantics. The intended change is receipt/time-basis presentation plus tests/docs.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Planning skill path under `.codex/skills` was absent | Read `/Users/Esone/.codex/skills/planning-with-files/SKILL.md` | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
| Process probe matched its own `rg` command | First process check returned only the probe command | Re-ran with an exclusion; no watcher/E2E process remained |
