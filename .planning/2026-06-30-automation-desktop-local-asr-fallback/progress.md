# Desktop Local ASR / Whisper Fallback Progress

## 2026-06-30

- Read `AGENT.md`, planning skill instructions, stale root planning files, memory registry hints, reusable random-feature workflow notes, and `docs/progressing/to-verify.md`.
- Checked local Reminders via AppleScript; the app is readable, but no `Personal AI` list is visible.
- Randomly selected `Desktop Local ASR / Whisper fallback` under Meeting Pilot and reviewed prior adjacent Meeting Pilot ASR plan files to avoid duplicating already completed receipt work.
- Created this isolated planning directory for the current automation run.
- Inspected `desktopLocalAsrProvider`, `ASROrchestrator`, `SpeechTab`, protocol types, background readiness checks, desktop app ASR routes, Options Desktop ASR panel, existing ASR unit tests, and Scene2 runtime E2E.
- Reviewed current external references for Teams/Zoom transcript state visibility, Whisper/local ASR readiness, and ASR confidence/error-detection research.
- Chosen plan: enrich Local ASR unavailable reasons with setup progress/details and render them as readable `本地准备` / `恢复动作` rows in the Speech ASR receipt.
- Implemented enriched Desktop Local ASR readiness reasons for model download progress, install failures, Whisper binary install/missing states, and final-engine readiness.
- Updated `SpeechTab` so local ASR probe failures are translated in `探测路径`, surfaced in a `本地准备` receipt row, used for No ASR `恢复动作`, and no longer leak raw local readiness codes through the fallback next-step path.
- Added a provider unit test for model download progress and extended Scene2 E2E with a No ASR local setup receipt assertion.
- Updated `docs/features/meeting_pilot.md` with the new Local ASR readiness receipt behavior.
- Validation passed:
  - `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/asr/__tests__/desktopLocalAsrProvider.test.ts src/meeting-shell/asr/__tests__/orchestrator.test.ts`
  - `npm start` first successful webpack dev compile, then stopped with Ctrl-C
  - `npm --prefix desktop-app run test:meeting-pilot-scene2`
  - `npm run test:meeting-pilot`
  - `git diff --check -- src/meeting-shell/asr/desktopLocalAsrProvider.ts src/meeting-shell/SpeechTab.tsx src/meeting-shell/asr/__tests__/desktopLocalAsrProvider.test.ts desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs docs/features/meeting_pilot.md .planning/2026-06-30-automation-desktop-local-asr-fallback/task_plan.md .planning/2026-06-30-automation-desktop-local-asr-fallback/findings.md .planning/2026-06-30-automation-desktop-local-asr-fallback/progress.md`
- Appended this run to `/Users/Esone/.codex/automations/automation/memory.md`.
