# Memory Capture Receipt Path Improvement Plan

Goal: improve the randomly selected `记忆捕捉` feature by checking docs against current code, grounding the UX choice in product/research references, implementing one focused low-decision fix, updating the canonical feature doc, and verifying the user-visible path.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, legacy planning files, `docs/progressing/to-verify.md`, feature index, dirty worktree state, and local Reminder list state |
| 2 | completed | Inspect Memory Capture docs, code paths, existing tests, and identify a concrete UX/code gap |
| 3 | completed | Search current product and paper references for comparable capture/save UX patterns |
| 4 | completed | Finalize the improvement slice and implementation plan |
| 5 | completed | Implement scoped code, test, and docs changes |
| 6 | completed | Run targeted verification, first successful extension compile, E2E if applicable, and whitespace checks |
| 7 | completed | Update automation memory and summarize Reminder/archive status |

## Decisions

- Selected feature: `记忆捕捉` under Memory Capture.
- Source doc: `docs/features/memory_capture.md`.
- Carry-over check: `docs/progressing/to-verify.md` says `暂无。`.
- Reminder check: local Reminders lists are readable, but there is no `Personal AI` list, so no Reminder items can be incorporated or marked done.
- Worktree is already broadly dirty; keep changes scoped to Memory Capture and this isolated planning directory.
- Improvement slice: make selected-text review show the same source/scope/write boundary as whole-page review, and make manual save failures say that no source-memory capsule or search signal was written while the retry entry remains available.
- Tool discovery did not expose a current Codex session archive control, so this run cannot programmatically mark the session archived.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `timeout` command missing on macOS shell | Initial Reminder list probe | Re-ran the probe through a Perl alarm wrapper and got the list names |
| Codex session archive control unavailable | Tool discovery for archive/session controls | Record the limitation; no programmatic archive action was possible |
