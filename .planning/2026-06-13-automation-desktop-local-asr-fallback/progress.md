# Desktop Local ASR / Whisper Fallback Progress

## 2026-06-13

- Read automation memory, `AGENT.md`, memory registry hints, `docs/progressing/to-verify.md`, and `docs/features/index.md`.
- Confirmed Reminders is readable but has no visible `Personal AI` list.
- Selected `Desktop Local ASR / Whisper fallback` under Meeting Pilot after avoiding the freshly repeated Compose Assist/Agent Workflow surfaces.
- Created scoped planning files under `.planning/2026-06-13-automation-desktop-local-asr-fallback/`.
- Inspected `docs/features/meeting_pilot.md`, `src/meeting-shell/asr/desktopLocalAsrProvider.ts`, `src/meeting-shell/asr/orchestrator.ts`, `src/meeting-shell/SpeechTab.tsx`, `src/meeting-shell/components/TierBadge.tsx`, and existing ASR / Meeting Pilot verifiers.
- Reviewed current Zoom, Microsoft Teams, Whisper, and speech privacy references.
- Chosen implementation slice: make the Speech tab ASR receipt explicitly describe local final-only / Whisper fallback and local stream warning states.
- Reopened numbered `SpeechTab` source and confirmed the apparent duplicate transcript-card `className` was not present in the real file.
- Implemented `SpeechTab` local ASR receipt parsing for `Local ASR · no live → Whisper` and `Local ASR stream warning (n/m): ...`.
- Extended `desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs` to assert the rendered final-only Local ASR receipt and local upload boundary.
- Updated `docs/features/meeting_pilot.md` to describe final-only and chunk-stream warning receipt behavior.
- Tried the focused ASR node tests, but the command failed before execution because Node 24 / ts-node did not resolve extensionless local imports in the ASR test files.
- Fixed `src/meeting-shell/background.ts` so `MEETING_PILOT_TIER_STATUS_UPDATE` is included in the handled message type allowlist.
- Validation passed:
  - `npm start` first successful webpack dev compile, then stopped watch.
  - `npm --prefix desktop-app run test:meeting-pilot-scene2`.
  - `git diff --check -- src/meeting-shell/SpeechTab.tsx src/meeting-shell/background.ts desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs docs/features/meeting_pilot.md .planning/2026-06-13-automation-desktop-local-asr-fallback/plan.md .planning/2026-06-13-automation-desktop-local-asr-fallback/findings.md .planning/2026-06-13-automation-desktop-local-asr-fallback/progress.md`.
- Reminder completion: skipped because the local Reminders app has no visible `Personal AI` list.
