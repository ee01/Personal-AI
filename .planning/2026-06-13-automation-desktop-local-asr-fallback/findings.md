# Desktop Local ASR / Whisper Fallback Findings

## Initial Context

- Carry-over check: `docs/progressing/to-verify.md` says `暂无。`.
- Last automation run worked on Compose Assist source exclusion, so this run avoided repeating Compose Assist.
- Random eligible feature selected from `docs/index.md`: `Desktop Local ASR / Whisper fallback`.
- Local Reminder lists visible: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` Reminders list exists on this machine.

## Code And UX Findings

- `docs/features/meeting_pilot.md` already documents the layered ASR architecture, transcription modes, `ASR 链路回执`, and Desktop Local ASR / Whisper fallback setup.
- `DesktopLocalAsrProvider` accepts final-only local ASR when the desktop app reports `finalReady`, starts a session with live auto + FunASR final + Whisper fallback, and emits `Local ASR · no live → Whisper`-style status details.
- Repeated desktop chunk failures are already promoted to a fatal ASR error after three attempts, so the orchestrator can fall back to the next allowed tier.
- `SpeechTab` shows an ASR receipt with mode, current layer, upload boundary, recent result, and next step, but local final-only / stream-warning details are still buried in raw English transition strings instead of being turned into a clear user-facing boundary.
- An initial unnumbered range view appeared to show a duplicate `className`, but the numbered source confirmed the real file has only one attribute.
- The Scene 2 verifier exposed a runtime contract bug: `MEETING_PILOT_TIER_STATUS_UPDATE` had a switch handler but was missing from `handledMeetingPilotTypes`, so explicit ASR tier updates were silently ignored and the UI could only infer from transcript source.

## External Reference Findings

- Zoom AI Companion support docs expose meeting AI start/stop and transcript-retention controls in the meeting UI, supporting visible ASR/capture state instead of hidden background inference.
- Microsoft Teams live transcription docs describe real-time transcript text with speaker names and timestamps, while Teams Intelligent Recap docs make transcription/recording prerequisites explicit.
- Whisper research shows robust multilingual ASR is a good fallback candidate, but it does not remove the product need to show whether the active engine is live partial, final-only, local, or cloud.
- Speech privacy research emphasizes that speech contains sensitive biometric and textual information; Meeting Pilot should keep the local-vs-cloud upload boundary visible and not hide final-only fallback behavior.
