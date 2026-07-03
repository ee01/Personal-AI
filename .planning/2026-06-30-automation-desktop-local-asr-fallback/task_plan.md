# Desktop Local ASR / Whisper Fallback Improvement Plan

Goal: improve the randomly selected `Desktop Local ASR / Whisper fallback` slice of Meeting Pilot by checking docs against current code, grounding one bounded UX improvement in current product/research references, implementing it, and validating through the repo's Meeting Pilot harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory state, carry-over queue, feature index, Reminders list state, memory notes, and prior ASR planning context |
| 2 | completed | Inspect Meeting Pilot ASR docs, desktop local ASR implementation, Speech panel UI, and existing tests/E2E |
| 3 | completed | Research comparable local/cloud transcription and fallback UX references |
| 4 | completed | Write the concrete improvement plan and choose one low-decision implementation slice |
| 5 | completed | Implement scoped code/docs/test changes |
| 6 | completed | Run targeted tests, first successful `npm start`, feature E2E/browser proof where practical, and scoped `git diff --check` |
| 7 | completed | Update automation memory and report Reminder status |

## Decisions

- Carry-over: `docs/progressing/to-verify.md` says `暂无。`; no pending verification item supersedes a fresh random selection.
- Random selection: `Desktop Local ASR / Whisper fallback` under `Meeting Pilot`, documented in `docs/features/meeting_pilot.md`.
- Reminder branch: local Reminders are readable, but there is no visible `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Existing worktree is broadly dirty from other work. Keep edits scoped to Meeting Pilot ASR files, docs, verification scripts/tests, this planning directory, and automation memory.
- Prior nearby ASR sweeps already covered cloud endpoint detail, chunk-stream warnings, first-transcript watchdog, final-only real-time status, and probe trail. This run should not duplicate those surfaces.
- Current bounded UX gap: when Desktop Local ASR is unavailable because the desktop app is disconnected, models are downloading, final engines are not ready, or Whisper binary setup is incomplete, the Speech panel mostly shows raw probe reasons or generic No ASR recovery. A user in a live meeting needs the exact local setup state and next action without opening Options first.
- Implementation slice: enrich Desktop Local ASR availability reasons, translate local readiness failures into a `本地准备` row and specific `恢复动作` in `SpeechTab`, extend targeted unit/E2E coverage, and update `docs/features/meeting_pilot.md`.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Missing automation memory at `$CODEX_HOME/automations/automation/memory.md` | Initial read | Treat as absent for this run and create it before final response |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion |
| Focused ASR test expected exact `final_model_not_ready` | First unit-test run after enriching reasons | Updated the assertion to require the enriched reason prefix and missing-model detail |
| Scene2 E2E expected raw `desktop_app_not_running` in probe trail | First E2E run after translating local reasons | Updated the assertion to expect user-facing copy and changed cloud fallback next-step copy to avoid raw local readiness code |
