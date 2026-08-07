# Meeting Pilot RC Transcript Boundary Plan

## Selected Feature

- Feature: `分层 ASR`
- Source: `docs/index.md` -> `docs/features/meeting_pilot.md`
- Why this slice: the first viable random sample was Meeting Pilot layered ASR. Recent runs already covered Web Speech first-transcript waiting, Local ASR readiness, local stream warnings, and cloud fallback freshness, so this run should avoid provider changes and improve the remaining platform-transcript boundary.

## External Scan

- Microsoft Teams separates live captions from transcript: captions are real-time and not saved, while transcript must be explicitly turned on for a downloadable record.
- Microsoft Teams recording/transcription controls notify participants and separate stop recording from stop transcription.
- Zoom My Notes describes visible transcription activation, then post-meeting summaries, key takeaways, and action items.
- Google live-caption stability research shows live ASR text can flicker or change and should be presented with stability/freshness context.
- ASR reliability research shows streaming ASR quality varies by vendor, speaker, language, and live conditions.

## Finding

When Meeting Pilot uses `RC Transcript`, the Speech panel already says it reads the meeting page transcript and does not upload extra audio. The missing bit is the platform boundary: users can still misread `RC 转写` as either "Personal AI is not capturing anything" or "RingCentral has saved a complete transcript". The UI should make the split explicit:

- Personal AI is only reading the currently visible RingCentral caption/transcript text.
- Local/cloud ASR is skipped while that platform transcript is active.
- This does not request RingCentral to save/download a full transcript or notify participants.
- The already-read text can still feed this meeting's live summary, action-item extraction, timeline, and later local archive.

## Implementation Plan

1. Add a `平台转写` row in the existing ASR chain receipt when `activeTier` or badge is `ringcentral_transcript` / `RC Transcript`.
2. Keep this presentation-only; do not change `meetingOffscreen`, ASR provider ordering, transcript ingestion, capture start/stop, upload logic, or platform controls.
3. Extend `desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs` with an RC Transcript fixture assertion.
4. Update `docs/features/meeting_pilot.md` and the `分层 ASR` row in `docs/index.md` concisely.
5. Verify with ASR syntax/unit checks, first successful `npm start` compile, scene2 E2E, and scoped `git diff --check`.

