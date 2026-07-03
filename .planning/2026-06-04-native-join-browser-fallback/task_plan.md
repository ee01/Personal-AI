# Native Join Browser Fallback Improvement Plan

Goal: improve the randomly selected `NC 加会浏览器回退` feature by checking current docs/code, incorporating relevant external product and research references plus local Reminder feedback when available, then implementing a focused low-decision fix with strong validation.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory state, `AGENT.md`, feature index, existing planning files, local Reminder list state, and randomly select the target feature |
| 2 | completed | Inspect Native Join docs, parsing/fallback code, content-script entry points, tests, and current dirty worktree scope |
| 3 | completed | Search current product docs and papers for browser/app join fallback and deep-link failure/security patterns |
| 4 | completed | Write the concrete improvement plan and select the smallest no-extra-decision implementation slice |
| 5 | completed | Implement the selected code/docs/UX changes while preserving unrelated dirty files |
| 6 | completed | Run targeted unit/E2E/build verification and visual/layout proof where practical |
| 7 | completed | Update Reminders if applicable, write automation memory, and summarize outcome |

## Decisions

- Randomly selected feature: `NC 加会浏览器回退`.
- Source doc: `docs/features/meeting_native_join.md`.
- Current Reminders scan shows no visible list named `Personal AI`, so no Reminder feedback can be incorporated or completed unless another source appears during this run.
- Existing dirty worktree is broad but has no Native Join diff; keep edits scoped to Native Join files plus this planning/automation bookkeeping.
- Selected implementation slice: when the browser page remains active after native handoff, switch the fallback title/body into explicit recovery copy, and clear any previous fallback's timers before mounting a replacement panel.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Missing `$CODEX_HOME/automations/automation/memory.md` | Initial automation-memory read | Treat as first automation-memory run and create/update the file before final response |
| Existing root planning files describe a prior Scheduled Messages run | Planning restore | Create an isolated `.planning/2026-06-04-native-join-browser-fallback` plan instead of overwriting the root files |
| `session-catchup.py` was accidentally run with `sh` | First catchup attempt | Re-ran it with `python3`; it produced no unsynced-context output |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark any Reminder items done |
| `rg` was given tool names as paths | Test-script search | Re-ran inspection via package scripts and direct test files instead of using those names as paths |
