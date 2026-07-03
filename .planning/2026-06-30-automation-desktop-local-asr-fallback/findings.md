# Desktop Local ASR / Whisper Fallback Findings

## Initial Context

- `docs/progressing/to-verify.md` is empty.
- Random selection attempts: first hit `场景记忆自动驾驶 eval` under Memory Lens / Compose Assist, second hit `Desktop Local ASR / Whisper fallback` under Meeting Pilot; the second is the selected non-recent exact target.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be used or completed for this run.
- Prior Meeting Pilot ASR plans already implemented: cloud endpoint receipt, local chunk stream warning, Web Speech first-transcript watchdog, final-only real-time state, and ASR probe trail.

## Code And UX Findings

- `docs/features/meeting_pilot.md` is current for the broad ASR behavior: it documents Local ASR final-only, chunk stream warning, cloud endpoint receipt, probe trail, and stale transcript boundaries.
- `src/meeting-shell/asr/desktopLocalAsrProvider.ts` accepts final-only Whisper fallback and triggers model ensure, but `isAvailable()` returns coarse reasons such as `asr_model_downloading` or `final_model_not_ready` without progress/target detail.
- `desktop-app/src/asr/asrRoutes.ts` already exposes richer `/asr/status` state: `downloadInProgress`, `downloadProgress`, `downloadTarget`, `lastDownloadError`, `whisperBinaryInstallInProgress`, and `whisperBinaryInstallProgress`.
- `src/meeting-shell/SpeechTab.tsx` translates active Local ASR chain detail and stream warnings well, but local-unavailable probe reasons still reach the user as raw terms inside the probe trail and generic No ASR recovery copy.
- Existing browser proof path: `desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs` already drives the Speech panel and asserts ASR receipt rows. It is the right place to add a local setup/readiness receipt assertion.

## External Reference Findings

- Microsoft Teams support docs separate live captions from live transcript and expose start/stop/download transcript states. This supports explicitly distinguishing "live preview available" from "saved/final transcript available".
- Zoom support docs for automated captions/transcription treat caption enablement and transcript availability as visible meeting controls rather than hidden fallback effects.
- OpenAI Whisper and whisper.cpp show local speech recognition is a practical privacy-friendly final transcript path, but it depends on local model/binary readiness; setup state is therefore product-facing, not just implementation detail.
- ASR confidence/error-detection research warns that users cannot judge transcript reliability from a single running/available state. Meeting Pilot should show readiness, freshness, and recovery instructions close to the live transcript surface.
