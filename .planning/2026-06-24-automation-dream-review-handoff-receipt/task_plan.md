# Dream Replay Review Handoff Receipt Plan

Goal: improve the selected `梦境重放` feature by keeping docs current, using current product/research context, and adding one bounded UX improvement that makes the review handoff from a dream card to Reflection safer and clearer.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, memory guidance, feature index, stale root planning files, worktree status, and Reminder list names |
| 2 | completed | Inspect Dream Replay docs, `DreamInsights.vue`, Reflection handoff code, existing E2E, and current dirty diff |
| 3 | completed | Search current product and research references for AI memory, reflection, and replay patterns |
| 4 | completed | Implement a small review-handoff receipt beside the expanded dream card action |
| 5 | completed | Update feature docs and E2E assertions |
| 6 | completed | Run targeted E2E, development compile, scoped whitespace checks, and process cleanup |
| 7 | completed | Update automation memory and summarize closeout |

## Decisions

- Selected feature: `梦境重放` under Memory Service.
- Source doc: `docs/memory_system.md`.
- Main UI file: `src/modals/components/DreamInsights.vue`.
- Existing E2E: `tools/verify-memory-dreams-e2e.mjs`.
- Local Reminders is reachable, but there is no `Personal AI` list; no Reminder item will be inspected, completed, or annotated.
- Existing root `task_plan.md` is stale Scheduled Messages work from 2026-06-04; use this isolated `.planning` directory only.
- Current worktree is broadly dirty with many pre-existing changes, including existing Dream Replay edits. Keep this run scoped to the handoff receipt, docs note, E2E assertion, and automation memory.

## Planned UX Change

Add a compact `复核交接回执` next to `复核这个主题` inside each expanded dream card. It should state the target Reflection search, dream source file, evidence readiness, risk/relationship counts, and the boundary that opening Reflection only carries a review filter. It must not imply that risks, relationships, profile facts, Rehearsal cues, notifications, external actions, or Memory Service writes are confirmed.

## Implementation Summary

- Added `dreamReviewHandoffReceipt()` in `DreamInsights.vue`.
- Rendered the receipt inside the expanded dream-card review action area.
- Updated `tools/verify-memory-dreams-e2e.mjs` to assert target, source, evidence, and boundary text.
- Updated `docs/memory_system.md` to describe the review handoff without expanding low-level implementation detail.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `/Users/Esone/.codex/memories/phase2_workspace_diff.md` missing | Memory-summary tip read | Treat as unavailable and continue with `MEMORY.md` plus random-loop skill guidance |
| No `Personal AI` Reminders list | Bounded AppleScript list scan | Record absence and stop Reminder branch |
| E2E strict-mode duplicate match on `风险 1` | First Dream Replay E2E run after adding handoff receipt | Narrowed the existing badge assertion to exact text; rerun passed |
