# Memory Timeline Stale Refresh Receipt Plan

Goal: improve the randomly selected `记忆时间轴` feature by keeping docs current, using a small product/research scan, fixing one low-decision UX gap, and validating the user-visible path.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory registry hints, feature index, carry-over list, Reminder list names, and current worktree state |
| 2 | completed | Select `记忆时间轴` from `docs/index.md` while avoiding the freshest automation-memory feature families |
| 3 | completed | Inspect timeline docs, source files, targeted verifier, and Playwright E2E |
| 4 | completed | Implement the scoped stale-refresh UX boundary and update docs/verifiers |
| 5 | completed | Run targeted verify, first successful `npm start` compile, E2E, and scoped diff checks |
| 6 | completed | Update automation memory, attempt archive, and summarize outcome |

## Decisions

- Selected feature: `记忆时间轴` / Memory Exploring.
- Source doc: `docs/memory_system.md`.
- Implementation slice: preserve the last successful timeline snapshot when a refresh fails for the same scope and range, and show an explicit stale-snapshot receipt instead of clearing the list.
- First-load failure should remain a true error/empty state, because there is no prior data to preserve.
- Scope/range changes should not reuse a previous snapshot after failure; wrong-scope stale data is worse than an empty failure state.
- Local Reminders did not expose a `Personal AI` list, so no Reminder item is incorporated or marked done.

## External Reference Direction

- Google My Activity and Google Photos Memories emphasize review/manage timelines, filtering, and user control around personal history.
- ChatGPT Memory controls emphasize visibility and control over saved/reference memories rather than opaque recall.
- Personal information management and re-finding research emphasizes contextual cues, time cues, and recoverable paths for finding previously seen information.
- Recent LLM memory papers emphasize explicit temporal/episodic structures for long-term agents, which supports clear freshness and snapshot boundaries in a memory timeline UI.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` existed from an older Scheduled Messages run | Planning setup | Treat root plan as stale data and create this isolated `.planning` folder |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip item-level Reminder completion |
