# Storyline Entry Receipt Improvement Plan

Goal: improve the randomly selected `Storyline 会前提示` feature by checking code and docs against current behavior, incorporating relevant product and research references, then implementing a focused low-decision UX/code improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, prior memory hints, stale planning files, `to-verify`, feature index, worktree state, and Reminders list state |
| 2 | completed | Inspect Storyline / Today Pilot docs, Video Home rendering, server opportunity validation, and existing verification scripts |
| 3 | completed | Search current product/docs and research references for AI meeting prep, narrative brief generation, and trust/grounding receipts |
| 4 | completed | Decide the smallest no-extra-user-decision implementation slice and update this plan with concrete edits |
| 5 | completed | Implement code/docs/test changes while preserving unrelated dirty files |
| 6 | completed | Run focused tests, first `npm start` compile, relevant E2E, and scoped whitespace checks |
| 7 | completed | Update Reminders if applicable, write automation memory, archive the Codex session, and summarize outcome |

## Decisions

- Selected feature: `Storyline 会前提示` under Today Pilot / Memory Storyline Builder.
- Source docs: `docs/features/today_pilot.md` and `docs/features/memory_storyline_builder.md`.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`, so there is no unfinished verification item to resume.
- Reminder state: local Reminders are readable, but there is no visible list named `Personal AI`; no Reminder item can be incorporated or marked done unless a later probe exposes the list.
- Dirty worktree: broad unrelated modifications already exist. Keep ownership scoped to Storyline / Today Pilot files, the matching verifier(s), this plan folder, automation memory, and `.planning/.active_plan`.
- Selected implementation slice: make the existing `Storyline 入口回执` honest when the LLM-reported evidence cluster count differs from actual `prep.evidenceRefs`, and derive source labels from real evidence refs when cluster `sourceKinds` are incomplete. Update the Video Home E2E and docs to preserve this contract.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` was unset | Initial automation-memory read | Used the repo's normal fallback at `/Users/Esone/.codex/automations/automation/memory.md` |
| Stale root `task_plan.md` / `findings.md` / `progress.md` from an older Scheduled Messages run | Planning skill context restore | Created an isolated `.planning/2026-06-14-automation-storyline-entry-receipt/` plan set and made it active |
| No visible `Personal AI` Reminders list | AppleScript Reminders list scan | Record absence and do not mark any Reminder item done |
