# Desktop Local ASR / Whisper Fallback Improvement Plan

Goal: improve the selected Meeting Pilot `Desktop Local ASR / Whisper fallback` feature by checking current docs/code, incorporating current product and research signals, then implementing one bounded UX/code fix with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, carry-over file, feature index, local Reminder list state, and current worktree state |
| 2 | completed | Inspect Meeting Pilot docs, desktop/local ASR code paths, UI states, and existing verifiers |
| 3 | completed | Search current adjacent product docs and speech/ASR papers for fallback and trust-boundary patterns |
| 4 | completed | Decide the smallest no-extra-decision improvement and document the implementation plan |
| 5 | completed | Implement scoped code/docs/test changes without reverting unrelated dirty work |
| 6 | completed | Run targeted tests plus dev build and the strongest practical E2E proof |
| 7 | completed | Update automation memory, handle Reminders if applicable, and summarize results |

## Initial Decisions

- Selected feature: `Desktop Local ASR / Whisper fallback`.
- Feature family: Meeting Pilot.
- Source doc: `docs/features/meeting_pilot.md`.
- Reminder branch: local Reminders is readable, but no visible list named `Personal AI` exists, so no Reminder item can be incorporated or marked done.
- Worktree state: broad pre-existing dirty tree; keep edits scoped to Meeting Pilot / desktop ASR files and this planning directory.
- Implementation slice: improve `SpeechTab` ASR chain receipt so local final-only / Whisper fallback and local stream warning states are explicit.
- Validation target: focused ASR/Speech tests, the desktop Scene 2 runtime check that already asserts the ASR receipt, `npm start` first successful compile, and `git diff --check` on owned files.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `timeout` command missing on macOS | First Reminder probe | Used a Ruby wrapper with a 12s deadline around AppleScript instead |
| Apparent duplicate `className` in `SpeechTab` | First unnumbered range view | Reopened numbered source; the real file has one attribute, so no code change is needed there |
| Direct ASR node test command failed before execution | `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/asr/...` | Node 24 / ts-node did not resolve extensionless local imports like `../orchestrator`; switch to fresh webpack compile and extension E2E for this UI path |
