# Meeting Local ASR Preflight Receipt

## Target

- Feature: `Desktop Local ASR / Whisper fallback`
- Source doc: `docs/features/meeting_pilot.md`
- Runtime focus: Meeting Pilot readiness before capture starts

## Plan

1. Preserve `/asr/status` detail in the Meeting Pilot preflight path instead of collapsing it to `available/liveReady`.
2. Show specific recoverable Local ASR states in readiness summaries: Desktop App disconnected, model downloading/install failed, Whisper binary installing/missing, live-ready/final-not-ready, and final-only ready.
3. Keep ASR behavior unchanged: tier selection, model download, audio upload, and transcript generation stay as-is.
4. Update the feature doc with the concise preflight behavior.
5. Verify with a focused formatter/preflight script, existing Local ASR provider tests, dev webpack compile, Meeting Pilot ASR E2E, and scoped whitespace checks.

## External Signals

- Apple Speech permission docs and macOS Speech Recognition controls support explicit permission/recovery state.
- Whisper docs/paper support local final transcript fallback, while streaming/correction research supports separating live preview from final transcript.
- Raycast Dictation and Microsoft Voice Typing emphasize visible live feedback and correction/recovery rather than silent dictation failure.
