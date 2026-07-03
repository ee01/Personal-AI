# Meeting Pilot Local ASR Live-Ready Final Boundary

## Target

- Feature: `Desktop Local ASR / Whisper fallback`
- Canonical doc: `docs/features/meeting_pilot.md`
- Scope: make the Speech panel distinguish a Desktop App state where the local live engine is ready but FunASR / Whisper final fallback is not ready yet.

## External Scan

- Microsoft Teams and Zoom make live captions, saved transcripts, recap readiness, and admin/host controls visible instead of collapsing them into one transcription state.
- Whisper and whisper.cpp support local final transcription as a privacy-friendly fallback, but they do not guarantee live partial preview.
- ASR trust and live caption research suggests users need to see freshness, stability, and correction/fallback boundaries, not only a badge saying an ASR layer is running.

## Plan

1. Keep the desktop app session contract unchanged: `/asr/session/start` still requires a final engine or Whisper fallback.
2. Add a structured provider readiness reason for `liveReady=true` and `finalReady=false`.
3. Translate that reason in the Speech panel as `本地准备`, with clear local-only and Auto / Cloud recovery guidance.
4. Cover the provider reason and panel receipt in focused tests.
5. Update the Meeting Pilot feature doc with the user-visible boundary.

## Validation

- `node --check desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs`
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/asr/__tests__/desktopLocalAsrProvider.test.ts src/meeting-shell/asr/__tests__/orchestrator.test.ts`
- `npm start -- --progress`, stopped after first successful compile
- `npm run test:meeting-pilot-scene1`
- `npm --prefix desktop-app run test:meeting-pilot-scene2-runtime`
- scoped `git diff --check`
