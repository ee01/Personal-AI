# Memory Lens Expanded Card Boundary Plan

Goal: improve the selected `记忆提示 Expanded Card` feature by checking that docs match current code, incorporating current product/research references, then implementing a focused UX fix that makes the card's read-only action boundary visible inside the expanded state itself.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, prior memory guidance, root planning files, and current worktree state |
| 2 | completed | Randomly select a non-recent feature and check local Reminder list existence |
| 3 | completed | Inspect Memory Lens docs, implementation, and existing verifier/E2E entry points |
| 4 | completed | Scan comparable products and papers for memory/search source, control, trust, and explanation patterns |
| 5 | completed | Implement a bounded Expanded Card UX improvement and update canonical docs |
| 6 | completed | Run targeted verify, dev compile, relevant E2E, and diff checks |
| 7 | in_progress | Update automation memory, handle Reminder completion if possible, archive the session, and summarize |

## Decisions

- Selected feature: `记忆提示 Expanded Card` under Memory Lens.
- Source doc: `docs/features/memory_lens.md`.
- Recent automation targets avoided: Compose Assist, Meeting Pilot, Scheduled Messages, Rehearsal, Project Dashboard, Quick Ask / Doubao Bridge, Skill Foundry, Google Slides Analyzer, and Notification Center.
- Local Reminders is reachable, but it has no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Worktree is already broadly dirty. Keep edits scoped to Memory Lens source, its verifier, docs, and this planning directory.
- Implementation slice: add a compact action-boundary receipt to the Expanded Card footer so direct-open users see that Lens is read-only and does not write, insert, send, save, or call external AI depending on the card variant.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root planning files describe an old Scheduled Messages run | Planning restore | Use this isolated `.planning/2026-06-19-automation-memory-lens-expanded-card-boundary/` directory |
| No `Personal AI` Reminder list | AppleScript bounded list scan | Record absence and skip Reminder item completion |
