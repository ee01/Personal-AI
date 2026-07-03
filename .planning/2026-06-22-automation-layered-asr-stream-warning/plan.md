# Automation Plan: Layered ASR Stream Warning

## Target

- Feature index row: `分层 ASR`
- Capability: Meeting Pilot
- Source doc: `docs/features/meeting_pilot.md`

## Improvement Plan

1. Keep the scope on Speech panel ASR status, not ASR provider architecture.
2. Clarify the local chunk stream warning receipt so users understand that live partial preview may pause, existing final/history transcript remains visible, audio is still local-only during the warning, and fallback happens only after continued failure.
3. Add E2E coverage in the existing Meeting Pilot Scene 2 runtime check.
4. Update the canonical feature doc with the new user-facing boundary.

## External Scan Notes

- Zoom AI Companion and Microsoft Teams Intelligent Recap both make transcription/start state visible before AI recap features.
- Whisper research supports robust ASR as a useful fallback, but live meeting UX still needs freshness and failure boundaries.
- Meeting action-item research depends on transcript quality, so stale or partial transcript state should be visible before downstream action extraction.
