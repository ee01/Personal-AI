# Meeting Pilot Layered ASR Findings

## Initial Context

- `docs/progressing/to-verify.md` says `暂无。`.
- Recent automation memory covered Google Slides skipped reasons, Agent Thinking approval retry receipts, Memory Service `/events` identity receipts, and Scheduled Messages target-filter receipts.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be used or completed for this run.
- Random selection from `docs/features/index.md`: `分层 ASR` under Meeting Pilot, documented in `docs/features/meeting_pilot.md`.

## Code And UX Findings

- `docs/features/meeting_pilot.md` is current for the broad layered ASR behavior: RingCentral Transcript, Desktop Local ASR / Whisper fallback, Cloud ASR, local-only, auto, cloud-only, and `ASR 链路回执`.
- `src/meeting-shell/SpeechTab.tsx` already renders `ASR 链路回执` with mode, current tier, upload boundary, recent result, fallback/recovery explanation, and last error.
- `src/meeting-shell/asr/orchestrator.ts` currently writes provider `status.detail` into `lastTransitionReason`; this lets Local ASR detail show up, but it can blur why the tier changed versus what the current tier is doing.
- `src/meeting-shell/asr/cloudASRProvider.ts` knows `MEETING_TRANSCRIBE_API_STYLE`, model, language, and endpoint labels through `requestMeetingTranscription(...)`, but the Speech receipt only says audio is sent to configured Cloud ASR.
- `src/options.tsx` already exposes `Transcribe API Style` and explains `/v1/audio/transcriptions` versus `chat/completions + input_audio`; the in-meeting Speech panel should carry the same boundary when cloud ASR is active.
- Existing E2E coverage in `desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs` already asserts the ASR receipt for cloud fallback and local final-only fallback, so it is the right browser-level proof path.

## External Reference Findings

- Zoom AI Companion and Teams live transcription both make transcription/AI meeting status explicit rather than hidden background behavior.
- OpenAI's current audio docs distinguish the transcription API from chat/audio input patterns; endpoint style is therefore a real operational/debug boundary, not implementation trivia.
- Privacy-preserving speech transcription research, including Prεεch, frames speech processing as a privacy/utility tradeoff with user-visible control knobs. Meeting Pilot should keep local/cloud endpoint and upload boundaries visible in the meeting surface.
- Constructive direction: do not add a new review queue or modal. Add a compact cloud endpoint receipt row in the existing Speech ASR receipt, while preserving fallback reason and no-cloud/local-only semantics.
