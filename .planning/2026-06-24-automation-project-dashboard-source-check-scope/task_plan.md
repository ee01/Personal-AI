# Project Dashboard Source Check Scope Plan

Goal: improve the randomly selected `项目数据源检查` feature by checking current docs and code, incorporating relevant product/research references, then implementing one bounded Project Dashboard UX/code improvement with matching docs and verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, memory guidance, `docs/progressing/to-verify.md`, feature index, root planning files, worktree status, and Reminders list state |
| 2 | completed | Inspect Project Dashboard docs, source files, and existing verify/E2E coverage for the selected data-source-check feature |
| 3 | completed | Search comparable product docs and papers for data-source health, provenance, and dashboard trust patterns |
| 4 | completed | Write the concrete improvement slice before editing |
| 5 | completed | Implement the scoped code/docs/UX change while preserving unrelated dirty files |
| 6 | completed | Run targeted verification, first successful dev compile, E2E/browser proof where practical, and whitespace checks |
| 7 | completed | Update automation memory, handle Reminder completion if applicable, and summarize outcome |

## Decisions

- Selected feature: `项目数据源检查` under Project Dashboard.
- Source doc: `docs/features/brain_like_project_analysis_system.md`.
- Reminder branch: local Reminders is reachable, but no `Personal AI` list exists, so there are no related Reminder items to incorporate or mark done.
- Worktree is already broadly dirty. This run must stay scoped to Project Dashboard source-check files, docs, verification scripts, planning files, and automation memory.
- Implementation slice: data-source sync top status now uses success / warning / error. Memory Service read limits or local evidence gaps surface as warning with source-scope and local-evidence headlines.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` belongs to an old Scheduled Messages run | Planning startup | Created this isolated `.planning` directory and pointed `.planning/.active_plan` at it |
| No `Personal AI` Reminders list | Bounded AppleScript list scan | Record absence and stop the Reminder branch |
| `node --check` does not support `.tsx` directly | Pre-verification syntax probe | Used repo verifier, webpack dev compile, and E2E as the real TSX validation path |
