# Action Queue Stale Refresh Receipt Plan

Goal: improve the randomly selected `动作队列` feature by checking docs and code, incorporating current product/research references, then implementing a focused UX fix that makes refresh failures preserve the last known queue snapshot instead of looking like an empty or current queue.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, existing planning files, feature index, to-verify doc, worktree status, and Reminder list names |
| 2 | completed | Select `动作队列`, inspect `memory_system.md`, `ActionQueue.vue`, the MemoryServiceClient surface, and `verify-action-queue-e2e` |
| 3 | completed | Search current industry/product and paper references for agent action queues, HITL approval, persisted status, and debugging visibility |
| 4 | completed | Implement stale-refresh receipt in Action Queue UI and update the existing E2E fixture/assertions |
| 5 | completed | Update canonical docs for the user-visible behavior |
| 6 | completed | Run targeted E2E, first successful `npm start` compile, and scoped `git diff --check` |
| 7 | completed | Update automation memory, attempt archive honestly, and summarize the result |

## Decisions

- Selected feature: `动作队列` from `docs/index.md`.
- Source doc: `docs/memory_system.md`.
- Main implementation: `src/modals/components/ActionQueue.vue`.
- Existing verifier: `tools/verify-action-queue-e2e.mjs`.
- Local Reminders was readable but there is no visible list named `Personal AI`; no Reminder item is available to incorporate or mark done.
- The worktree is already broadly dirty. Keep owned edits scoped to Action Queue docs/code/verifier plus this planning directory and automation memory.
- Implementation slice: when a non-initial refresh or silent polling request fails after a successful load, retain the last action list, show a clear stale snapshot receipt, and avoid presenting the summary as freshly confirmed.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Stale root planning files from 2026-06-04 exist | Planning setup | Read them for context, then created this isolated `.planning` directory instead of overwriting root files |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder incorporation/completion |
| Browser MCP cannot open extension/file URLs from the exposed navigation tool | Post-frontend-change browser check | Used the existing Playwright unpacked-extension E2E against freshly built `dist/` as the browser-level proof |
