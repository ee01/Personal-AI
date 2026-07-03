# Meeting Pilot ASR First Transcript Watchdog

## Target

- Feature: `分层 ASR` in `docs/features/meeting_pilot.md`
- User path: open Meeting Pilot side panel during a live meeting, switch to `发言`, and decide whether ASR is actually hearing the meeting.

## Research Signals

- Microsoft Teams separates live captions from saved live transcripts and shows transcript state, speaker, and timestamp explicitly.
- Zoom exposes automated caption enablement as a host/admin meeting setting instead of making captions an invisible background assumption.
- MDN marks `SpeechRecognition` as limited availability, so Chrome On-Device / Web Speech needs a visible degradation boundary.
- ASR confidence and live-caption stability research both point to showing freshness/stability cues instead of implying that a running recognizer means usable text is arriving.

## Improvement Plan

1. Expose the Web Speech first-transcript watchdog as a `tier.lastStatusDetail`, not only a capture log line.
2. Render that detail in the Speech panel `ASR 链路回执` as a first-screen waiting state.
3. Make the receipt say that empty transcript is not proof nobody is speaking, and that timeout will fallback according to the current mode.
4. Update Meeting Pilot docs with the new ASR receipt behavior and reference direction.
5. Prove the contract with the ASR orchestrator unit test, the existing Meeting Pilot scene2 E2E, first successful webpack dev compile, and scoped whitespace check.

## Boundary

This run does not add a new ASR provider, change upload policy, or alter cloud/local mode selection. It only makes an existing watchdog state user-visible and verifiable.
