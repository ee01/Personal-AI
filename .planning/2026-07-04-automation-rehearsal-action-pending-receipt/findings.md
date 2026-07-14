# Findings

## Repository Context

- `docs/progressing/to-verify.md` says there is no carry-over item.
- The worktree is broadly dirty from prior automation runs; this run should avoid unrelated files.
- `docs/features/rehearsal.md` already describes Rehearsal as a future-scene cue/action memory layer and the management page as an audit/repair surface, not the primary consumption path.
- `src/modals/components/RehearsalsPage.vue` already has list scope, empty filter, deep-link failure, scenario readiness, action success, and action failure receipts.

## Current Gap

- When a user clicks pause/restore/reactivate/used/irrelevant/archive, the UI disables action buttons while waiting for Memory Service, but it does not immediately show a receipt that the write is still unconfirmed.
- This creates a short but real ambiguity: the user can see disabled controls and may infer the state already changed, even though the old status is still authoritative until the request returns.

## Reminder State

- AppleScript listed many local Reminders lists but not `Personal AI`.
- EventKit found `Personal AI` and 4 reminders; all were completed historical Doubao / Weekly Dream Digest / sync feedback, unrelated to Rehearsal.
- No Reminder item should be marked done for this run.

## External Scan

- Apple Reminders supports time, location, and messaging-person cues, reinforcing that cue/action reminders need clear trigger context and recoverability.
- ChatGPT Scheduled Tasks has centralized management, pause/resume/edit/delete, monitoring tasks, limits, and paused-state recovery; this supports keeping Rehearsal management actions visibly pending until confirmed.
- Context-aware reminder research shows natural language reminder intent is ambiguous and benefits from structured executable representations.
- Prospective-memory implementation-intention research supports making the cue/action binding visible, because the future action depends on the environmental cue being recognized.
