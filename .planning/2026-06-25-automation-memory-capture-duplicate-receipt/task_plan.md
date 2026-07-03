# Memory Capture Duplicate Receipt Plan

## Goal

Improve whole-page Memory Capture duplicate-save receipts so users can tell whether the current action created/updated a source-memory capsule or only found an existing saved capsule.

## Current Phase

Complete

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | complete | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, memory guidance, feature index, and stale root planning files |
| 2 | complete | Randomly select a non-recent feature and inspect its docs, source, current diffs, Reminders state, and verification paths |
| 3 | complete | Run a small external product/paper scan for web clipping, read-it-later capture, duplicate/re-find behavior, and PIM context |
| 4 | complete | Implement duplicate-specific receipt wording for Memory Capture toasts and update docs |
| 5 | complete | Extend targeted verifier/E2E coverage for duplicate no-note receipts |
| 6 | complete | Run Memory Capture verification ladder and scoped diff checks |
| 7 | complete | Update automation memory and summarize outcome |

## Decisions

| Decision | Rationale |
| --- | --- |
| Target `Memory Capture -> 整页资料保存` | Corrected random sample picked this feature after excluding the freshest exact families from automation memory |
| Do not add an undo button to duplicate auto-save receipts | A duplicate can point to an older intentionally saved capsule; undoing it from an automatic duplicate notice would be a destructive surprise |
| Add duplicate-specific receipt formatting in the content script | The backend `writeReceipt` describes current capsule recall state, but duplicate/no-note user feedback also needs to state that this action did not create a new capsule or update content |
| Keep docs update compact | `memory_capture.md` is already current; only the duplicate no-new-write boundary needs a short note |

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` is stale from a Scheduled Messages run | Initial planning skill restore | Created this isolated dated `.planning/` folder and left the root plan content unchanged |
| `git status` is extremely dirty | Discovery | Scope edits to Memory Capture files and this run's planning/automation files only |
| Reminders list `Personal AI` is absent | AppleScript list scan | Stop Reminder branch; no item can be completed |
