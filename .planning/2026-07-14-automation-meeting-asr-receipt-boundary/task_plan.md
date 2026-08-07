# Meeting Pilot ASR Receipt Boundary Plan

## Target

- Selected feature: `Desktop Local ASR / Whisper fallback`
- Canonical docs: `docs/features/meeting_pilot.md` and the matching `docs/index.md` row
- Scope: Speech panel ASR receipt card boundary. This does not change ASR provider ordering, Desktop App bridge behavior, cloud upload behavior, capture start/stop, transcript parsing, action item generation, or meeting archive writes.

## Current Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent runs already covered Snooze, Timeline, Skill Foundry, Relationship Radar, Message Analysis, Memory Capture, Jira Import, Scheduled Messages, Today Pilot, and AR Data, so this run uses a different Meeting Pilot ASR slice.
- EventKit read the local `Personal AI` Reminders list: 4 total items, 0 incomplete items. No Reminder item is related to Meeting Pilot ASR, Desktop Local ASR, Whisper fallback, or Speech panel receipts.
- The worktree is broadly dirty before this run. This run should only own the new planning directory, `.planning/.active_plan`, Meeting Pilot ASR receipt UI/test/doc updates, and automation memory.

## External Scan

- Microsoft Teams Copilot exposes whether transcription is required, when Copilot starts/stops with transcription, and whether after-meeting Copilot can use transcript data.
- Microsoft Teams admin docs distinguish live captions from saved transcripts and make transcript storage/governance explicit.
- Google Meet transcripts show Drive/storage, host/co-host control, meeting-visible transcript icon, and start/stop state.
- Google Meet "take notes for me" exposes supported languages, organizer recap delivery, "Summary so far", and optional participant consent gates.
- OpenAI Whisper and the Whisper paper support robust local/final transcript fallback, but not hiding real-time/final readiness differences.
- Live-caption stability and ASR-confidence research both argue that users need freshness/stability/source cues, not just "ASR is running".

## Gap

The Speech panel already renders rich ASR receipt rows, including mode, current layer, probe trail, upload boundary, freshness, local readiness, stream warnings, and recovery actions. However, the receipt container itself only has a static `aria-label="ASR 链路回执"` and no hover title. As a user, I can still miss the high-level consequence boundary before interacting with the card or reading each row: viewing this card does not start/stop capture, switch ASR mode, upload audio, request RingCentral to save/download transcript, send notes, or create tasks.

## Implementation Steps

1. Add a small `buildASRReceiptBoundaryLabel()` helper in `src/meeting-shell/SpeechTab.tsx`.
   - Include mode, current ASR layer, upload boundary, latest result/freshness, and next-step/restoration row when available.
   - Explicitly state that the card is a current-session read-only ASR snapshot.
   - Explicitly state non-effects: no capture start/stop, no ASR mode switch, no extra audio upload, no platform transcript save/download, no meeting note send, no external task write.
2. Attach the label to `.speech-asr-receipt` as both `title` and `aria-label`, and set `role="group"` so assistive tech gets a meaningful receipt group boundary.
3. Extend `desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs` to assert the card-level boundary for a local final-only state and an RC transcript state.
4. Update `docs/features/meeting_pilot.md` and the `Desktop Local ASR / Whisper fallback` row in `docs/index.md` concisely.
5. Verify:
   - `node --check desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs`
   - `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-meeting-pilot-asr-preflight.ts`
   - `npm start -- --progress`, stop after first successful compile
   - `npm --prefix desktop-app run test:meeting-pilot-scene2`
   - scoped `git diff --check`

