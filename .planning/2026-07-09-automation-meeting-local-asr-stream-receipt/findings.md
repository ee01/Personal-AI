# Findings

## Repo Context

- `docs/progressing/to-verify.md` says there are no pending verification items.
- Automation memory shows the latest exact targets were Coverage quality score, multi-user isolation, Topic defer, selected-text Memory Capture, Prompt Config injection, Agent Workflow deletion, and several other receipt surfaces. The random sampler selected `Desktop Local ASR / Whisper fallback` under Meeting Pilot.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. Completed items are historical Doubao / Notification / test feedback, unrelated to Local ASR, Whisper, or Meeting Pilot transcription.
- The working tree had broad unrelated dirty state before this run. Keep this run narrow and report owned files clearly.

## Current Implementation

- `docs/features/meeting_pilot.md` is current and already describes Local ASR final-only, Whisper fallback, local readiness, and chunk stream warnings.
- `DesktopLocalAsrProvider` already emits `Local ASR stream warning (n/3): ...` status after chunk send failures and escalates to fatal after 3 consecutive failures.
- `SpeechTab` already parses that warning and includes it in current layer / realtime state / next step, but the main receipt does not separate retry progress, remaining attempts, local-only boundary, and fallback consequence into an easily scannable row.

## External Research

- Microsoft Teams distinguishes saved transcription from live captions, and stores transcripts with speaker/timestamp metadata after meetings. It also surfaces disabled transcription reasons through tooltips and remediation steps. Source: https://learn.microsoft.com/en-us/microsoftteams/meeting-transcription-captions and https://support.microsoft.com/en-us/teams/meetings/i-can-t-transcribe-a-meeting-in-microsoft-teams
- Otter presents live transcription, desktop recording without a meeting bot, summaries, decisions, and action items as one meeting workflow. Source: https://otter.ai/
- OpenAI Whisper is robust multilingual ASR trained at scale, but its 30-second chunk architecture and offline/open-source use still require clear UX around latency, final transcript timing, and model/runtime limits. Source: https://openai.com/index/whisper/
- ASR confidence/error-detection research shows confidence signals alone are not enough for users to find transcript errors reliably. Applied here: show operational state and recovery path, not just a badge or generic confidence. Source: https://arxiv.org/abs/2503.15124
- Google live-caption stability work emphasizes that unstable text harms reading experience. Applied here: make live partial instability explicit and preserve final/historical transcript boundary. Source: https://research.google/blog/modeling-and-improving-text-stability-in-live-captions/
- Privacy-preserving ASR work frames voice as both acoustic and textual sensitive data, and recommends explicit privacy/utility control surfaces. Applied here: keep the local-only vs cloud fallback boundary visible during stream retry. Source: https://www.usenix.org/conference/usenixsecurity20/presentation/ahmed-shimaa
- Privacy-focused meeting transcription products emphasize local processing, consent, and data-sovereignty positioning. Applied here: local stream retry should keep saying the current audio still goes only to the Desktop App until the actual tier changes. Source: https://meetily.ai/blog/best-privacy-focused-meeting-transcription-tools-2025

## Decision

Implement a presentation-only `本地流状态` receipt row for active Local ASR stream warnings. It should say:

- current retry count and remaining attempts before fatal fallback,
- live partial preview may pause while final/historical transcript is preserved,
- current audio remains local to Desktop App,
- continuing failures will trigger the next tier according to mode,
- the original reason is included but truncated.
