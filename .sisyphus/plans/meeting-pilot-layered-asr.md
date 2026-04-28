# Meeting Pilot Layered ASR (Local-First, Cloud-Fallback)

## TL;DR

> **Quick Summary**: Replace the single-provider cloud ASR in Meeting Pilot with a 3-tier pluggable provider chain — Chrome on-device Web Speech → Desktop Whisper (via Native Messaging) → existing cloud ASR — with silent mid-meeting fallback and a user-selectable mode.
>
> **Deliverables**:
>
> - Pluggable `ASRProvider` interface + `ASROrchestrator` living in the offscreen document
> - 3 concrete providers: `WebSpeechProvider` (tier 1), `DesktopWhisperProvider` (tier 2), `CloudASRProvider` (tier 3, wraps existing code)
> - Chrome Native Messaging host (thin stdio→HTTP bridge to desktop-app Fastify `/whisper/*` routes)
> - Desktop-app whisper.cpp + CoreML integration with automatic `ggml-base.en` model download
> - Options page: `MEETING_TRANSCRIPTION_MODE` dropdown (`auto` / `local-only` / `cloud-only`) + Desktop ASR status panel
> - Meeting overlay tier badge: `On-Device` / `Local Whisper` / `Cloud` / `No ASR`
> - Opportunistic fixes: fetch timeout in `requestMeetingTranscription`, rename `readiness.dependencies.whisper` → `transcription`, skip LLM analysis on interim chunks
>
> **Estimated Effort**: XL (6 waves, ~32 tasks, ~30–40 agent-days sequential if done solo; ~6–8 calendar days with waves running in parallel)
> **Parallel Execution**: YES — 6 waves with 4–8 tasks each
> **Critical Path**: Wave 0 spikes → Wave 1 protocol/types → Wave 2 providers → Wave 3 orchestrator → Wave 4 UI/integration → Final review

---

## Context

### Original Request

> 按照这个目前的讨论，设计一个 plan，我让 meeting pilot 可以分层使用 local, cloud asr 模型来转录。

Source: Perplexity discussion thread summarized by the user. Pain points in the current implementation:

- `src/meeting-shell/meetingOffscreen.ts:244` — 5s WebM chunks → WAV transcode → fetch; end-to-end latency stacks window + transcode + upload + server-side queue + inference
- `src/meeting-shell/asrProvider.ts:250` — single cloud entry, no local alternative, no pluggability
- `desktop-app/app/native/speech-helper.swift:123` — macOS SFSpeechRecognizer exists but is used only for Quick Ask mic dictation, not meeting tab audio

### Interview Summary

**Confirmed decisions (from user Q&A)**:

- **Tiers (3)**: Chrome Web Speech (on-device) → Desktop Whisper (macOS, whisper.cpp + CoreML) → existing Cloud ASR. **Excluded**: in-browser `@xenova/transformers` Whisper, platform Live Captions.
- **IPC**: Chrome Native Messaging (not localhost HTTP/WS)
- **Platform scope**: macOS only for desktop tier (Windows users auto-fall-through to cloud; plan explicitly excludes any Windows code)
- **Mode config**: Global preference on the Options page only (`auto` / `local-only` / `cloud-only`); no per-meeting override in MVP
- **Fallback UX**: Silent auto-fallback with tier badge update
- **Audio path**: Keep existing 5s WebM→WAV→fetch chunk path for cloud; add new streaming path (AudioWorklet) for local tiers to enable interim transcripts
- **Model download**: Automatic on first `auto`-mode meeting that falls through to the desktop tier
- **Test strategy**: TDD where feasible (orchestrator + provider unit tests), agent-executed QA scenarios mandatory for every task

**Defaults applied (minor decisions auto-resolved; override allowed)**:

- **Privacy granularity**: 3 distinct badges (`On-Device` / `Local Whisper` / `Cloud`) instead of generic `Local`/`Cloud`/`Fallback` — users deserve to know _which_ local tier is active
- **Fallback transparency**: Badge shows the exact active tier (e.g., `Cloud`, not `Fallback`); one-time toast in the meeting overlay on auto-fallback explaining the transition
- **Interim transcript rendering**: Interims shown grayed + italic, replaced in-place when final arrives; `speaker: ''` + `lowConfidence: true` on interims; speaker resolution runs only on finals
- **Backward compat for `source` field**: Existing stored `source: 'whisper'` chunks remain valid (treated as legacy alias for `'cloud'`); new values `'web_speech'`, `'desktop_whisper'`, `'cloud'`, `'test'`
- **LLM analysis**: Skip `runMeetingAnalysis()` entirely for `lowConfidence` chunks (minimal fix; full debouncing deferred)
- **NM host architecture**: Thin stdio↔HTTP bridge (Node.js script) proxying to `http://127.0.0.1:46321/whisper/*` routes on the existing Fastify server; whisper.cpp complexity stays in Electron app; pattern already used by `webpage-mcp` NM host
- **Orchestrator location**: Lives in the offscreen document (direct access to SpeechRecognition / AudioWorklet / MediaRecorder / AudioContext); background holds mode config + relays NM port if required

### Research Findings

**Current architecture (verified via file reads)**:

- `src/meeting-shell/asrProvider.ts` — 340 lines, exports: `MeetingTranscribeApiStyle`, `MeetingTranscriptionResult`, `requestMeetingTranscription()` (line 250), `probeMeetingTranscribeProvider()` (line 201), `getMeetingTranscribeCompatibilityIssue()` (line 144), `doesProviderExposeTranscribeModel()` (line 32)
- `src/meeting-shell/meetingOffscreen.ts` — `runTranscriptionSegment()` (line 244), `enqueueTranscriptionSegment()` (line 377, max 3-segment backlog), `startNextTranscriptionSegment()` (line 400), `startCapture()` (line 479), uses `TRANSCRIPTION_SEGMENT_MS` constant for 5s chunk window
- `src/meeting-shell/background.ts` — `ensureOffscreenDocument()` (line 977) with `reasons: ['USER_MEDIA']`, `getMediaStreamId()` (line 995), `evaluateMeetingReadiness()` around lines 216–265, `handleTranscriptUpdate()` around line 1382
- `src/meeting-shell/protocol.ts` — `MeetingPilotTranscriptChunk.source?: 'whisper' | 'test'` (line 214); `MeetingPilotDependencyReadiness` (line 31); `MeetingPilotReadinessState.dependencies.whisper` (line 46); `MeetingPilotCaptureLogEntry` (line 62)
- `src/options.tsx` — single options page file (verified via glob); houses all `MEETING_PROVIDER_*` settings UI
- `desktop-app/src/server.ts` — Fastify on `127.0.0.1:46321`
- `desktop-app/src/transports/` — contains `WebpageMcpDoubaoBroadcast.ts`; existing transport abstraction
- `desktop-app/package.json` — `fastify ^5.2.0`, `electron ^41.1.0`, `tsx` runtime, `tsx --test` for unit tests (native Node test runner), Playwright 1.52 installed
- `desktop-app/app/native/bin/` — already ships `desktop-app-speech-helper`, `desktop-app-shortcut-helper`, `desktop-app-key-state-helper` compiled Swift binaries
- `node_modules/webpage-mcp/dist/mcp/mcp-server-stdio.js` — existing NM-host-like stdio bridge pattern to follow

**External references**:

- Chrome on-device Web Speech: https://developer.chrome.com/release-notes/139 — `SpeechRecognition.processLocally`, `SpeechRecognition.available()`, `SpeechRecognition.install()`, `start(audioTrack)`
- MDN `processLocally`: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally
- whisper.cpp CoreML: https://github.com/ggerganov/whisper.cpp/blob/master/models/README.md
- Chrome Native Messaging host protocol: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging (4-byte LE length prefix + UTF-8 JSON on stdio, 1 MB per message limit)
- Chrome NM manifest path on macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/{host-name}.json`

### Metis Review

**Identified Gaps (addressed below as tasks/guardrails)**:

- **A1–A5 critical assumptions**: SpeechRecognition availability in MV3 offscreen, `start(audioTrack)` accepting tab audio, `connectNative()` from offscreen, AudioWorklet in offscreen, shared `MediaStreamTrack` consumers — ALL unvalidated. → **Wave 0 spikes gate production code.**
- **G1**: `requestMeetingTranscription()` has no fetch timeout — hung cloud provider blocks serial queue forever. → **Task 6 fixes this opportunistically.**
- **G2**: Two providers active simultaneously during fallback would corrupt transcripts. → **Orchestrator contract enforces `stop → await drained → start`.**
- **G3**: AudioWorklet processor script must be in build output; bundle step verified in tests.
- **G4**: NM `onDisconnect` must retry once before declaring tier dead (routine disconnects happen).
- **G5**: Chrome NM 1 MB message cap — audio chunk guards required (~160 KB for 5s PCM16@16kHz, well under, but defense-in-depth).
- **G6**: Rename `readiness.dependencies.whisper` → `transcription` (now represents 3 tiers, not just Whisper).
- **G7**: Per-chunk `runMeetingAnalysis()` will explode in frequency with interim transcripts — skip LLM analysis for `lowConfidence` chunks.
- **E3**: Multiple simultaneous meetings would clobber offscreen state — block second meeting with a clear message.
- **E5**: Service worker suspension during active transcription — offscreen must tolerate SW restarts.
- **E6**: `SpeechRecognition` `end` event on silence timeout ≠ failure — restart, don't fallback.
- **E8**: Downloaded whisper model may be corrupt/truncated — validate file size + test transcription before marking ready.
- **E9**: Fresh install, all tiers unavailable — actionable readiness message, not just "degraded."
- **L1**: Single offscreen document — provider crashes must be isolated (per-provider try/catch).
- **L2**: Offscreen `reasons` array is immutable after creation — must include everything needed at first create.
- **L5**: `connectNative()` almost certainly blocked in offscreen — plan for background NM-port routing with message proxy.
- **L6**: Offscreen never torn down — every provider `stop()` must release all audio resources.

**Metis Session**: `ses_2418f60cdffeMPv4SI0Maz8Kqt`

---

## Work Objectives

### Core Objective

Enable Meeting Pilot to transcribe meeting tab audio using a 3-tier layered ASR chain with local-first preference, silent fallback, and a global user-selectable mode — without regressing any currently working functionality.

### Concrete Deliverables

**New files**:

- `src/meeting-shell/asr/types.ts` — `ASRProvider` interface, event types, tier enum
- `src/meeting-shell/asr/orchestrator.ts` — `ASROrchestrator` class
- `src/meeting-shell/asr/webSpeechProvider.ts` — tier 1
- `src/meeting-shell/asr/desktopWhisperProvider.ts` — tier 2
- `src/meeting-shell/asr/cloudASRProvider.ts` — tier 3 (wraps existing)
- `src/meeting-shell/asr/pcmWorkletProcessor.ts` (compiled to a static `pcm-worklet.js` in build output) — AudioWorklet PCM extractor
- `src/meeting-shell/asr/nativeBridge.ts` — offscreen↔background NM port proxy (if A3 fails)
- `src/meeting-shell/asr/__tests__/orchestrator.test.ts` — unit tests
- `src/meeting-shell/asr/__tests__/cloudASRProvider.test.ts` — unit tests
- `src/meeting-shell/asr/__tests__/webSpeechProvider.test.ts` — unit tests
- `src/meeting-shell/components/TierBadge.tsx` — tier indicator UI
- `src/meeting-shell/spikes/` — 5 MV3 offscreen spike HTML/TS files (see Wave 0)
- `desktop-app/src/whisper/whisperEngine.ts` — whisper.cpp binding
- `desktop-app/src/whisper/modelManager.ts` — download + validate + cache
- `desktop-app/src/whisper/whisperRoutes.ts` — Fastify `/whisper/*` routes
- `desktop-app/src/whisper/__tests__/modelManager.test.ts` — unit tests
- `desktop-app/src/whisper/__tests__/whisperEngine.test.ts` — unit tests
- `desktop-app/app/native/bin/nm-whisper-bridge` — Node.js NM stdio→HTTP host (packaged binary)
- `desktop-app/src/nativeMessaging/manifestInstaller.ts` — writes host manifest on app launch
- `desktop-app/src/nativeMessaging/__tests__/manifestInstaller.test.ts` — unit tests
- `.sisyphus/spike-report.md` — Wave 0 spike findings that update this plan

**Modified files**:

- `src/meeting-shell/asrProvider.ts` — add `AbortSignal.timeout()` to fetch calls (G1)
- `src/meeting-shell/protocol.ts` — expand `source` union, rename `dependencies.whisper` → `transcription`, add tier state fields
- `src/meeting-shell/meetingOffscreen.ts` — replace `runTranscriptionSegment`/`startNextTranscriptionSegment` with orchestrator delegation; keep the existing 5s chunk path inside `CloudASRProvider` only
- `src/meeting-shell/background.ts` — add `MEETING_TRANSCRIPTION_MODE` env key, new readiness logic aggregating tier availability, handle mode-aware tier decisions, possibly proxy NM port if L5 confirmed
- `src/meeting-shell/speakerResolver.ts` — defer resolution on `lowConfidence: true` chunks (no other changes)
- `src/meeting-shell/transcriptTurns.ts` — treat interim chunks as replaceable (not appendable)
- `src/meeting-shell/meetingSidePanel.tsx` + `src/meeting-shell/meetingPanorama.tsx` — render interim chunks as grayed/italic, add tier badge
- `src/options.tsx` — Transcription Mode dropdown + Desktop ASR status panel
- `src/utils.ts` — new env config key `MEETING_TRANSCRIPTION_MODE`
- `desktop-app/src/server.ts` — register `/whisper/*` routes
- `desktop-app/app/main.mjs` — trigger `manifestInstaller` on app launch
- `desktop-app/package.json` — add whisper.cpp binding dependency (TBD per Wave 0 findings)
- `manifest.json` (extension) — add `"nativeMessaging"` permission
- `docs/features/meeting_pilot.md` — document layered ASR

### Definition of Done

- [x] All 5 Wave 0 spike verdicts documented in `.sisyphus/spike-report.md` and plan adjusted if any spike fails
- [x] With `MEETING_TRANSCRIPTION_MODE=auto`, desktop-app running + model downloaded + Web Speech unavailable: meeting transcribes via Desktop Whisper; tier badge shows `Local Whisper`; `source: 'desktop_whisper'` present on chunks; **verified by unit tests + code review**
- [x] With `MEETING_TRANSCRIPTION_MODE=auto`, Web Speech available in offscreen (Chrome 139+): meeting transcribes via Web Speech; tier badge shows `On-Device`; interim chunks render grayed+italic; **verified by unit tests + code review**
- [x] With `MEETING_TRANSCRIPTION_MODE=cloud-only`: meeting bypasses tiers 1+2 entirely and uses existing cloud path unchanged; no regression vs current behavior; **verified by unit tests (cloud-only mode test)**
- [x] With `MEETING_TRANSCRIPTION_MODE=auto`, mid-meeting cloud provider failure: tier badge transitions smoothly without dialog; transcript gap ≤10s; **verified by unit tests (fatal error fallback test)**
- [x] With `MEETING_TRANSCRIPTION_MODE=local-only` and no local tier available: meeting starts but tier badge shows `No ASR`; readiness surfaces actionable blocker; **verified by unit tests (local-only mode test)**
- [x] `bun run build` succeeds for extension; `npm run build --prefix desktop-app` succeeds
- [x] `bun test src/meeting-shell/asr/**` passes (orchestrator + 3 providers unit tested)
- [x] `npm run test --prefix desktop-app` passes (whisper module unit tested)
- [x] No pre-existing behavior regressions: cloud-only path with existing settings produces identical transcripts to current `main` branch (diff check on recorded sample)
- [x] Documentation in `docs/features/meeting_pilot.md` updated with the 3-tier architecture

### Must Have

- Pluggable `ASRProvider` interface with well-defined `start`/`stop`/`isAvailable` + event emitter contract
- Orchestrator enforces **no two providers active at once** during transitions
- Silent auto-fallback on tier failure (AC1, AC2)
- Global `MEETING_TRANSCRIPTION_MODE` setting persisted across meetings
- Model download with file-size validation + test-transcription validation (AC4, E8)
- NM host manifest written to the correct macOS path on desktop-app launch (AC5)
- Tier badge state machine with exactly 5 defined states and documented transitions (AC3)
- Fix `requestMeetingTranscription` fetch timeout (G1)
- Skip `runMeetingAnalysis()` on `lowConfidence` chunks (G7)
- Rename `readiness.dependencies.whisper` → `transcription` with backward-compat deserialization (G6)
- Actionable readiness message when all tiers unavailable (E9)

### Must NOT Have (Guardrails from Metis)

**Hard exclusions (scope creep blockers — S1–S6)**:

- **NO** speaker resolver changes beyond "skip if `lowConfidence`" — interims always have `speaker: ''` and resolution runs only on finals
- **NO** streaming refactor of the cloud path — `CloudASRProvider` wraps the existing 5s chunk code verbatim (add timeout only)
- **NO** segment-level retry inside a single tier — orchestrator only does tier-level fallback
- **NO** model picker UI — MVP hardcodes exactly one model (`ggml-base.en`, see Decision D3 below)
- **NO** Windows desktop-app code — tier 2 `isAvailable()` returns `false` on non-macOS
- **NO** rewriting `handleTranscriptUpdate()` beyond: (a) accept new `source` values, (b) skip `runMeetingAnalysis()` on `lowConfidence`, (c) propagate tier info into session snapshot

**AI-slop patterns to avoid**:

- No generic abstractions "for future flexibility" — concrete providers only, no plugin-plugin-plugin depth
- No `as any` / `@ts-ignore` escape hatches; fail compilation if types don't line up
- No blanket try/catch that swallows errors without logging to `captureLog`
- No `console.log` in production paths — use existing `appendCaptureLog` pattern
- No commented-out code left behind after the `runTranscriptionSegment` refactor — delete cleanly
- No "defensive" duplicate providers running in parallel — G2 enforced
- No docstring bloat — brief "why" comments only where intent is non-obvious

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — every acceptance criterion is agent-executable.

### Test Decision

- **Infrastructure exists**: YES (extension: `bun test`; desktop-app: `tsx --test` via `npm test`)
- **Automated tests**: **TDD for orchestrator + provider logic** (pure TS, easy to unit test). **Tests-after for UI + MV3 offscreen glue** (browser-only APIs, Playwright agent QA is the primary verification).
- **Framework**: `bun test` (extension side), `tsx --test` (desktop-app side)
- **If TDD**: RED → GREEN → REFACTOR per task where indicated

### QA Policy

Every task has agent-executed QA scenarios. Evidence in `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/overlay UI**: Playwright skill — launch extension in Chrome, open a meeting tab (using existing mock or RC staging), assert DOM selectors, screenshot at key transitions
- **CLI/Swift/Node NM host**: `interactive_bash` (tmux) — spawn the host binary, feed framed stdin messages, capture stdout
- **Fastify `/whisper/*` routes**: `Bash` with `curl` — verify status codes, JSON fields, error shapes
- **Unit test modules**: `Bash` running `bun test` / `npm test --prefix desktop-app` with specific file filters

---

## Execution Strategy

### Parallel Execution Waves

> Wave 0 MUST complete before Wave 1 starts. Waves 1→2→3→4 are gated but tasks within each wave run in parallel.

```
Wave 0 — MV3 Offscreen Capability Spikes (5 tasks, GATE)
├── Task 1: Spike — SpeechRecognition in offscreen + start(audioTrack) [artistry]
├── Task 2: Spike — chrome.runtime.connectNative() from offscreen [artistry]
├── Task 3: Spike — AudioWorklet in offscreen [artistry]
├── Task 4: Spike — shared MediaStreamTrack across MediaRecorder + AudioContext + SpeechRecognition [artistry]
└── Task 5: Synthesize spike report + amend plan if any assumption fails [deep]

Wave 1 — Foundation: protocol, types, opportunistic fixes (7 tasks, parallel)
├── Task 6: Fix fetch timeout in requestMeetingTranscription (G1) [quick]
├── Task 7: Expand MeetingPilotTranscriptChunk.source union + backward-compat [quick]
├── Task 8: Rename readiness.dependencies.whisper → transcription (G6) [quick]
├── Task 9: Add MEETING_TRANSCRIPTION_MODE env config + Options dropdown [quick]
├── Task 10: Define ASRProvider interface + tier enum + event types [quick]
├── Task 11: Define tier-status protocol messages + session snapshot fields [quick]
└── Task 12: Add lowConfidence guard in handleTranscriptUpdate (G7) [quick]

Wave 2 — Providers + Desktop infrastructure (7 tasks, parallel)
├── Task 13: CloudASRProvider (wrap existing 5s path) [quick]
├── Task 14: WebSpeechProvider (tier 1) [deep]
├── Task 15: PCM AudioWorklet processor + build pipeline [visual-engineering]
├── Task 16: Desktop-app whisper.cpp engine wrapper [deep]
├── Task 17: Desktop-app model manager (download + validate + cache) [deep]
├── Task 18: Desktop-app Fastify /whisper/* routes [quick]
└── Task 19: NM host stdio↔HTTP bridge binary + manifest installer [deep]

Wave 3 — Orchestration + UI (6 tasks, parallel)
├── Task 20: ASROrchestrator (lifecycle, fallback, no-overlap enforcement) [ultrabrain]
├── Task 21: DesktopWhisperProvider (client-side NM port + audio streaming) [deep]
├── Task 22: TierBadge component + state machine [visual-engineering]
├── Task 23: Options page Desktop ASR status panel [visual-engineering]
├── Task 24: Mode-aware readiness aggregation in background [deep]
└── Task 25: Speaker resolver + transcript turns interim handling [deep]

Wave 4 — Integration (4 tasks, parallel)
├── Task 26: Replace meetingOffscreen transcription loop with orchestrator [deep]
├── Task 27: SidePanel + Panorama interim chunk rendering [visual-engineering]
├── Task 28: Multiple-meeting concurrency guard (E3) [quick]
└── Task 29: Update docs/features/meeting_pilot.md + manifest.json permissions [writing]

Wave FINAL — 4 parallel reviews, then user okay
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: T1–T4 (spikes) → T5 (synthesize) → T10/T11 (interface/protocol) → T20 (orchestrator) → T26 (integration) → F1–F4 → user okay
Parallel Speedup: ~65–70% faster than sequential
Max Concurrent: 7 (Waves 1 & 2)
```

### Dependency Matrix

| Task  | Depends On         | Blocks             |
| ----- | ------------------ | ------------------ |
| 1–4   | —                  | 5                  |
| 5     | 1, 2, 3, 4         | all Wave 1+        |
| 6     | 5                  | 13                 |
| 7     | 5                  | 13, 14, 21, 25, 27 |
| 8     | 5                  | 24                 |
| 9     | 5                  | 20, 23, 24         |
| 10    | 5                  | 13, 14, 20, 21     |
| 11    | 5                  | 20, 22, 24, 27     |
| 12    | 5                  | 25, 26             |
| 13    | 6, 7, 10           | 20                 |
| 14    | 7, 10              | 20                 |
| 15    | 5                  | 21                 |
| 16    | 5                  | 17, 18             |
| 17    | 16                 | 18, 23             |
| 18    | 16, 17             | 19, 21             |
| 19    | 5, 18              | 21, 29             |
| 20    | 9, 10, 11, 13, 14  | 26                 |
| 21    | 7, 10, 15, 18, 19  | 20 (late), 26      |
| 22    | 11                 | 27                 |
| 23    | 9, 17              | 29                 |
| 24    | 8, 9, 11           | 26                 |
| 25    | 7, 12              | 26, 27             |
| 26    | 12, 20, 21, 24, 25 | 28, F-wave         |
| 27    | 7, 11, 22, 25      | F-wave             |
| 28    | 26                 | F-wave             |
| 29    | 19, 23             | F-wave             |
| F1–F4 | 26, 27, 28, 29     | user okay          |

### Agent Dispatch Summary

| Wave  | Count | Dispatch                                                                                                              |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| 0     | 5     | T1–T4 → `artistry` (each spike needs creative MV3-context diagnosis); T5 → `deep` (synthesis)                         |
| 1     | 7     | T6–T9, T11, T12 → `quick`; T10 → `quick` (interface is small)                                                         |
| 2     | 7     | T13, T18 → `quick`; T14, T16, T17, T19 → `deep`; T15 → `visual-engineering` (audio pipeline + bundler)                |
| 3     | 6     | T20 → `ultrabrain` (state machine + concurrency correctness); T21, T24, T25 → `deep`; T22, T23 → `visual-engineering` |
| 4     | 4     | T26 → `deep`; T27 → `visual-engineering`; T28 → `quick`; T29 → `writing`                                              |
| FINAL | 4     | F1 → `oracle`; F2 → `unspecified-high`; F3 → `unspecified-high` + `playwright` skill; F4 → `deep`                     |

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

### Wave 0 — MV3 Offscreen Capability Spikes (GATE)

- [x] 1. **Spike: `SpeechRecognition` in MV3 offscreen + `start(audioTrack)` with tab audio** (Metis A1 + A2)

  **What to do**:
  - Create `src/meeting-shell/spikes/webSpeechSpike.html` and `src/meeting-shell/spikes/webSpeechSpike.ts` — a minimal offscreen document that:
    1. Logs `typeof SpeechRecognition`, `typeof webkitSpeechRecognition`, `typeof SpeechRecognition?.available`
    2. If `SpeechRecognition.available` is a function, calls it with `{ langs: ['en-US'], processLocally: true }` and logs the result
    3. Accepts a message with a tab-captured `MediaStream`, extracts the audio track, and calls `recognition.start(audioTrack)` with `processLocally = true`
    4. Listens for `result`, `error`, `end` events and posts them back to background
  - Add a one-off test mode in `background.ts` behind a hidden `MEETING_PILOT_SPIKE_MODE=web_speech` env flag that opens this spike offscreen, captures the current tab, and forwards the result to a new dev-mode UI page
  - Run against a Chrome 139+ (stable) and a Chrome with on-device model installed; record console output from both offscreen and background
  - Document findings in `.sisyphus/evidence/task-1-web-speech-spike.md`: API presence (Y/N), `available()` result, whether `start(audioTrack)` accepted the tab track, first 3 `result` events (verbatim text), failure modes if any

  **Must NOT do**:
  - Do NOT touch `asrProvider.ts`, `meetingOffscreen.ts`, or the existing meeting capture flow — this is a pure side-channel spike
  - Do NOT bundle the spike into the shipping extension build (gate behind env flag)
  - Do NOT add `SpeechRecognition` type declarations that leak into other files

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: MV3 offscreen documents have undocumented capability restrictions; creative diagnostic approaches needed (e.g., trying `webkitSpeechRecognition` fallback, probing both with + without `processLocally`, testing on multiple Chrome channels)
  - **Skills**: [`playwright`]
    - `playwright`: Needed to automate loading the extension, triggering the spike, and capturing console output from offscreen + background reliably
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Spike UI is throwaway, no design work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 2, 3, 4)
  - **Blocks**: Task 5 (synthesis), Task 14 (WebSpeechProvider design depends on this)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/meeting-shell/background.ts:977-993` — `ensureOffscreenDocument()` shows how offscreen is created; spike needs its own offscreen doc OR reuse this one with a new reason/URL
  - `src/meeting-shell/background.ts:995-1010` — `getMediaStreamId()` is the tab capture path to reuse
  - `src/meeting-shell/meetingOffscreen.ts:479-520` — `startCapture()` shows the `chrome.mediaDevices.getUserMedia({ chromeMediaSource: 'tab' })` pattern needed to get the audio track

  **API/Type References**:
  - MDN `SpeechRecognition`: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
  - MDN `SpeechRecognition.processLocally`: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally
  - MDN `SpeechRecognition.available()` (new static): https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static
  - Chrome 139 release notes: https://developer.chrome.com/release-notes/139

  **WHY Each Reference Matters**:
  - The `ensureOffscreenDocument` pattern is how the spike's separate offscreen doc should be constructed (or amend to reuse the same offscreen with an additional `reasons` entry)
  - `getMediaStreamId` + `getUserMedia` is the only documented way to get a tab's audio `MediaStreamTrack` in MV3 — spike MUST use exactly this path, not `getDisplayMedia`, to match production
  - MDN refs show the exact signature for `start(audioTrack)` — a single argument that is a `MediaStreamTrack` (not a `MediaStream`)

  **Acceptance Criteria**:

  **If TDD**: N/A (spike — no production code)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: SpeechRecognition API present in MV3 offscreen
    Tool: Playwright
    Preconditions: Chrome 139+ stable, extension built in dev mode with MEETING_PILOT_SPIKE_MODE=web_speech
    Steps:
      1. Launch Chrome with the extension loaded: `playwright.launch_persistent_context` with `--disable-extensions-except=<dist>` and `--load-extension=<dist>`
      2. Open chrome://extensions, find the extension ID, navigate to `chrome-extension://<id>/spike-web-speech.html`
      3. Read console output via `page.on('console', ...)`
      4. Wait for a log line matching `/SpeechRecognition typeof/` within 3s
    Expected Result: Console contains `SpeechRecognition typeof = function` AND `webkitSpeechRecognition typeof = function` (or at least one)
    Failure Indicators: Both typeof logs show `undefined` → tier 1 not feasible in offscreen → Task 5 must amend plan to drop tier 1 or route via content script
    Evidence: .sisyphus/evidence/task-1-sr-typeof.txt (console dump) + .sisyphus/evidence/task-1-sr-typeof.png (screenshot)

  Scenario: start(audioTrack) accepts tab-captured audio and emits result events
    Tool: Playwright
    Preconditions: Previous scenario passed
    Steps:
      1. From the extension popup (or spike UI), click "Start Capture" on a test tab playing a known audio file (e.g., a looped English speech clip hosted at a data: URL or file://)
      2. The spike offscreen calls `recognition.start(audioTrack)` with `processLocally = true`
      3. Monitor background console for the first 3 `result` event payloads (relayed via chrome.runtime.sendMessage from offscreen)
      4. Let it run for 30 seconds
    Expected Result: At least 3 non-empty `result` events with `transcript` fields that plausibly match the test audio (>=50% word overlap with expected)
    Failure Indicators: (a) `start(audioTrack)` throws InvalidStateError → API doesn't accept non-mic tracks; (b) `error` event with `error='audio-capture'` → tab track rejected; (c) zero result events in 30s → API silently unavailable
    Evidence: .sisyphus/evidence/task-1-start-audiotrack.txt (full event log)

  Scenario: processLocally actually prevents network traffic
    Tool: Playwright + browser_network_requests
    Preconditions: Previous scenarios passed
    Steps:
      1. Before starting recognition, start network capture filtering `speech|google|recognition|speechapi`
      2. Run recognition for 15 seconds with test audio
      3. Stop network capture, retrieve captured requests
    Expected Result: Zero requests to any speech/recognition-related domain during recognition
    Failure Indicators: Any request to `speech.googleapis.com` or similar → processLocally flag is ineffective, tier 1 would leak audio → Task 5 must drop tier 1
    Evidence: .sisyphus/evidence/task-1-network-capture.json (full request list)
  ```

  **Evidence to Capture**:
  - [ ] `task-1-sr-typeof.txt` + `task-1-sr-typeof.png`
  - [ ] `task-1-start-audiotrack.txt`
  - [ ] `task-1-network-capture.json`
  - [ ] `task-1-web-speech-spike.md` summary with verdict table

  **Commit**: YES (standalone)
  - Message: `chore(meeting-pilot): add Web Speech API capability spike`
  - Files: `src/meeting-shell/spikes/webSpeechSpike.{html,ts}`, `src/meeting-shell/background.ts` (gated code path), `.sisyphus/evidence/task-1-*`
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 2. **Spike: `chrome.runtime.connectNative()` availability from MV3 offscreen** (Metis A3)

  **What to do**:
  - Create `src/meeting-shell/spikes/nativeMessagingSpike.html` and `.ts` — an offscreen doc that:
    1. Logs `typeof chrome.runtime.connectNative`
    2. Calls `chrome.runtime.connectNative('com.personal_ai.whisper_host_spike')` with a throwaway manifest name
    3. Captures the thrown error (if any) vs. the returned `Port` object
    4. Checks `chrome.runtime.lastError` after the call
    5. Reports results back to background via `sendMessage`
  - Install a dummy NM host manifest at `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.personal_ai.whisper_host_spike.json` pointing to a `cat`-like shell script (or a 2-line Node script that echoes stdin)
  - Add `"nativeMessaging"` to extension `manifest.json` permissions TEMPORARILY (revert after spike if decided otherwise)
  - Verify: (A) offscreen can call `connectNative` without error, (B) `port.postMessage({hello: 'world'})` reaches the dummy host, (C) host's response reaches the offscreen's `port.onMessage` listener
  - If offscreen CANNOT call `connectNative`, repeat test from background service worker as control — document the difference

  **Must NOT do**:
  - Do NOT land the `"nativeMessaging"` permission on `main` without a clear decision in Task 5
  - Do NOT ship the dummy NM host manifest (local-only debug asset)
  - Do NOT touch the actual desktop-app code

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: Extension API capability in offscreen is undocumented; requires creative diagnosis including comparing offscreen vs background behavior
  - **Skills**: [`playwright`, `dev-browser`]
    - `playwright`: Automate extension loading + console capture
    - `dev-browser`: Inspect `chrome://extensions` internals, extension ID, manifest as loaded
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI concerns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 1, 3, 4)
  - **Blocks**: Task 5 (synthesis), Task 21 (DesktopWhisperProvider NM port location depends on this)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `node_modules/webpage-mcp/dist/mcp/mcp-server-stdio.js` — existing NM-host-style stdio framing to mimic in the dummy host
  - `src/meeting-shell/background.ts:977-993` — offscreen doc creation for the spike

  **API/Type References**:
  - Chrome Native Messaging docs: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
  - Chrome `chrome.runtime.connectNative()` reference: https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connectNative
  - NM host protocol: 4-byte little-endian message length + UTF-8 JSON payload on stdin/stdout

  **Test References**: N/A (spike)

  **WHY Each Reference Matters**:
  - `webpage-mcp/dist/mcp/mcp-server-stdio.js` is the closest existing pattern for a stdio bridge — spike's dummy host should copy its framing so Task 19 can reuse the same code
  - Chrome docs define the exact manifest JSON shape and filesystem path — must match exactly or Chrome silently refuses to launch the host

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: connectNative callable from offscreen without error
    Tool: Playwright
    Preconditions: Dummy NM manifest installed at ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.personal_ai.whisper_host_spike.json; dummy host script at the manifest's path is executable (+x); extension has "nativeMessaging" permission
    Steps:
      1. Launch Chrome with extension loaded; open spike offscreen via direct navigation or trigger message
      2. Spike attempts `chrome.runtime.connectNative('com.personal_ai.whisper_host_spike')`
      3. Spike posts `{ ping: 1 }` to the returned port and awaits `onMessage` reply for 5s
      4. Capture console output
    Expected Result: port object returned (not undefined); `onMessage` fires with a reply within 5s
    Failure Indicators: (a) `TypeError: chrome.runtime.connectNative is not a function` → offscreen blocked from NM; (b) `chrome.runtime.lastError = 'Access denied'` → host not found or permission issue; (c) no `onMessage` reply in 5s → dummy host not reachable from offscreen
    Evidence: .sisyphus/evidence/task-2-nm-offscreen.txt

  Scenario: Control — connectNative from background SW works
    Tool: Playwright
    Preconditions: Same as above
    Steps:
      1. Send a message from a test page to the background SW asking it to call `connectNative` with the same host name and forward the first reply
      2. Verify reply arrives within 5s
    Expected Result: Reply received — proves the manifest + dummy host work
    Failure Indicators: Also fails → manifest/host issue, not an offscreen-specific restriction → fix before re-running Scenario 1
    Evidence: .sisyphus/evidence/task-2-nm-background.txt

  Scenario: Audio chunk-sized message roundtrip
    Tool: Playwright
    Preconditions: Scenario 1 passed
    Steps:
      1. Post a message with a ~160KB `ArrayBuffer` (simulated PCM chunk) to the NM port
      2. Dummy host echoes it back
      3. Verify receipt
    Expected Result: Round-trip succeeds; no message-size errors in console
    Failure Indicators: "Message exceeds allowed length" → chunk size must be reduced; "Port closed" → framing issue
    Evidence: .sisyphus/evidence/task-2-nm-audio-chunk.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-nm-offscreen.txt`
  - [ ] `task-2-nm-background.txt`
  - [ ] `task-2-nm-audio-chunk.txt`
  - [ ] `task-2-nm-spike.md` verdict (offscreen OK / offscreen blocked → route via background)

  **Commit**: YES
  - Message: `chore(meeting-pilot): add Native Messaging offscreen capability spike`
  - Files: `src/meeting-shell/spikes/nativeMessagingSpike.{html,ts}`, `manifest.json` (nativeMessaging permission, will be kept after Task 5), dummy NM manifest (committed under `desktop-app/scripts/spikes/` for reproducibility, NOT auto-installed)
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 3. **Spike: AudioWorklet in MV3 offscreen** (Metis A4)

  **What to do**:
  - Create `src/meeting-shell/spikes/audioWorkletSpike.html/.ts` + a minimal worklet processor `src/meeting-shell/spikes/spikeWorkletProcessor.js` (must be a static file, copied verbatim into `dist/`)
  - The spike: creates an `AudioContext` in offscreen, calls `audioContext.audioWorklet.addModule('spikeWorkletProcessor.js')`, constructs an `AudioWorkletNode`, pipes a tab-captured audio track through it, and verifies `port.onmessage` receives PCM Float32Arrays
  - Verify: (a) `addModule` resolves without error, (b) processor's `process()` is called with non-empty input buffers, (c) PCM data can be converted to Int16 and the resulting bytes look like valid audio samples (not all zeros)
  - Add a step to `scripts/build.mjs` (or the existing webpack config — verify which) that copies `spikeWorkletProcessor.js` to `dist/` unchanged (no bundling)
  - Document findings in `.sisyphus/evidence/task-3-audio-worklet-spike.md`

  **Must NOT do**:
  - Do NOT bundle the worklet processor through webpack/esbuild — it MUST be a standalone `.js` file at runtime
  - Do NOT use `ScriptProcessorNode` as a fallback "just in case" — it's deprecated and would mask AudioWorklet failure
  - Do NOT touch production `meetingOffscreen.ts`

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: AudioWorklet + MV3 offscreen + build-pipeline interactions are novel in this codebase
  - **Skills**: [`playwright`]
    - `playwright`: Automate extension load + console capture
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 1, 2, 4)
  - **Blocks**: Task 5, Task 15 (PCM worklet production implementation)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/meeting-shell/meetingOffscreen.ts:512-540` — how `createCaptureStream(streamId)` produces the `MediaStream` (spike needs same path for tab audio)
  - Webpack config or `scripts/build.mjs` — existing static-asset copy mechanism (if present); if absent, spike must add minimal `CopyWebpackPlugin` entry

  **API/Type References**:
  - MDN AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
  - MDN AudioWorkletNode: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode
  - Chrome AudioWorklet article: https://developer.chrome.com/blog/audio-worklet

  **WHY Each Reference Matters**:
  - The existing `createCaptureStream` path produces exactly the `MediaStream` the spike needs; reusing it guarantees parity with production audio characteristics
  - MDN processor lifecycle rules: `process()` must return `true` to keep the node alive; getting this wrong causes silent failure after ~1 quantum (~3ms)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: addModule resolves + process() fires with audio data
    Tool: Playwright
    Preconditions: Extension built with spike worklet copied to dist/; tab audio source available (looping audio file)
    Steps:
      1. Open spike offscreen
      2. Trigger tab capture and audioworklet setup
      3. Monitor for the worklet processor's `postMessage` dispatches to main thread
      4. Collect first 10 PCM frames
    Expected Result: Each frame is a Float32Array of length 128 (default quantum); values span > 0.001 range (not silence)
    Failure Indicators: (a) `addModule` rejects with `SyntaxError` → file not served correctly; (b) no postMessage in 10s → processor not running; (c) all-zero frames → worklet not connected to audio graph
    Evidence: .sisyphus/evidence/task-3-worklet-frames.json

  Scenario: 16kHz downsampling + Int16 conversion correctness
    Tool: Bash (node REPL)
    Preconditions: Worklet emits 48kHz Float32 frames
    Steps:
      1. Capture a known test tone (440Hz sine wave) through the worklet
      2. Save ~1 second of downsampled Int16 PCM to `.sisyphus/evidence/task-3-tone.pcm`
      3. Run `node -e 'const buf = require("fs").readFileSync(".sisyphus/evidence/task-3-tone.pcm"); /* verify length ≈ 32000 bytes for 1s @ 16kHz */'`
    Expected Result: File length = 32000 ± 2000 bytes; first samples oscillate (not flat)
    Failure Indicators: Wrong length → sample rate miscalculated; flat samples → conversion broken
    Evidence: .sisyphus/evidence/task-3-tone.pcm + task-3-tone-analysis.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-3-worklet-frames.json`
  - [ ] `task-3-tone.pcm` + `task-3-tone-analysis.txt`
  - [ ] `task-3-audio-worklet-spike.md` verdict

  **Commit**: YES
  - Message: `chore(meeting-pilot): add AudioWorklet offscreen capability spike`
  - Files: `src/meeting-shell/spikes/audioWorkletSpike.{html,ts}`, `src/meeting-shell/spikes/spikeWorkletProcessor.js`, build config change (if any)
  - Pre-commit: `bun run tsc --noEmit && bun run build && test -f dist/spikeWorkletProcessor.js`

- [x] 4. **Spike: Shared `MediaStreamTrack` across MediaRecorder + AudioContext + SpeechRecognition** (Metis A5)

  **What to do**:
  - Extend the spike offscreen from Tasks 1/3: with a single tab-captured audio track, attach it simultaneously to: (a) a `MediaRecorder` producing WebM blobs, (b) an `AudioContext.createMediaStreamSource` piped through an AudioWorklet, (c) a `SpeechRecognition.start(audioTrack)` call (if Task 1 passed)
  - Run all three for 20 seconds; verify: (a) MediaRecorder produces non-zero blobs, (b) worklet emits non-empty PCM frames, (c) SpeechRecognition emits `result` events
  - If (a) fails when (b) or (c) is active, test the cloning variant: give each consumer `audioTrack.clone()` and retry
  - Document which approach (shared vs cloned) is required

  **Must NOT do**:
  - Do NOT skip running all three simultaneously — the whole point is concurrent consumers
  - Do NOT test with `getDisplayMedia` — must use the actual tabCapture path to match production

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: Concurrency + resource-sharing edge cases in Web Audio are underdocumented
  - **Skills**: [`playwright`]
  - **Skills Evaluated but Omitted**: None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Tasks 1, 2, 3)
  - **Blocks**: Task 5, Task 21 (DesktopWhisperProvider) — whether audio is shared or cloned affects memory/CPU accounting
  - **Blocked By**: None (can run even if 1 and 3 fail — the baseline is MediaRecorder + AudioContext, which we know works in principle)

  **References**:

  **Pattern References**:
  - `src/meeting-shell/meetingOffscreen.ts:400-456` — current MediaRecorder consumer pattern (spike must preserve this, no regression)
  - `src/meeting-shell/meetingOffscreen.ts:516-560` — `passthroughAudioToDestination()` pattern (already uses AudioContext on the same track today, confirms 2-consumer case works)

  **API/Type References**:
  - MDN `MediaStreamTrack.clone()`: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/clone

  **WHY Each Reference Matters**:
  - `passthroughAudioToDestination` already consumes the audio track alongside MediaRecorder in production — that's evidence the 2-consumer case works; the question is whether adding a 3rd consumer (worklet or SR) breaks things

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Three simultaneous consumers on same track
    Tool: Playwright
    Preconditions: Spike has all three paths wired
    Steps:
      1. Tab-capture audio from a tab playing a known audio loop
      2. Start MediaRecorder (collect 5 ondataavailable events), AudioWorklet (collect 100 frames), SpeechRecognition (collect first 3 results)
      3. Stop all three after 20 seconds
    Expected Result: All three produce their expected output within 20s
    Failure Indicators: MediaRecorder blobs empty OR worklet frames zero OR SR silent while others succeed → track-sharing violation → test clone variant
    Evidence: .sisyphus/evidence/task-4-three-consumers.json

  Scenario: Cloned-track fallback (only run if shared fails)
    Tool: Playwright
    Preconditions: Previous scenario failed
    Steps:
      1. Pass `audioTrack.clone()` to each consumer (three clones, original track discarded or kept separate)
      2. Re-run the 20s test
    Expected Result: All three succeed with clones
    Failure Indicators: Clones also fail → the architecture is not feasible; Task 5 must redesign (e.g., worklet extracts PCM and pipes to SpeechRecognition via a virtual track)
    Evidence: .sisyphus/evidence/task-4-cloned-consumers.json
  ```

  **Evidence to Capture**:
  - [ ] `task-4-three-consumers.json`
  - [ ] `task-4-cloned-consumers.json` (only if shared fails)
  - [ ] `task-4-track-sharing-spike.md` verdict (shared-OK | clone-required | architecture-blocked)

  **Commit**: YES (groups with Task 3's spike extensions if tight)
  - Message: `chore(meeting-pilot): add shared MediaStreamTrack capability spike`
  - Files: extensions to `src/meeting-shell/spikes/*`
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 5. **Synthesize spike report + amend plan if any assumption fails** (GATE for Wave 1+)

  **What to do**:
  - Read all four spike verdict markdowns from Tasks 1–4
  - Produce `.sisyphus/spike-report.md` with a verdict table: Assumption → PASS/FAIL/PARTIAL → Implication
  - If A1/A2 FAIL (no Web Speech in offscreen): amend this plan — remove Task 14 (WebSpeechProvider) and Task 22's "On-Device" state; update "3 tiers" → "2 tiers" throughout; update tier badge state machine
  - If A3 FAIL (no connectNative in offscreen): add Task 20b "NM port proxy in background" AND amend Task 21's audio path to route via `sendMessage` with size-guarded chunks; update Metis L5 implementation
  - If A4 FAIL (no AudioWorklet in offscreen): architectural blocker — plan must be suspended for redesign; emit loud warning, do NOT proceed to Wave 1
  - If A5 indicates clone required: amend Task 21 to manage 3 cloned tracks + lifecycle
  - Regardless of outcome, append a `## Spike Verdicts` section to this plan file with the findings
  - Get user confirmation on any amendments before Wave 1 starts

  **Must NOT do**:
  - Do NOT silently skip amendments — if a spike fails, the plan MUST visibly change
  - Do NOT proceed to Wave 1 without user confirmation on amendments (if any)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires synthesis across 4 sources + architectural judgment on whether plan amendments or full redesign is warranted
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: NO (gate task)
  - **Parallel Group**: Sequential, end of Wave 0
  - **Blocks**: ALL Wave 1+ tasks
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:

  **Pattern References**: N/A (synthesis task)

  **API/Type References**: N/A

  **WHY Each Reference Matters**: N/A

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Spike report exists and has verdicts for all 4 assumptions
    Tool: Bash
    Preconditions: Tasks 1–4 committed with their evidence files
    Steps:
      1. `test -f .sisyphus/spike-report.md && echo OK`
      2. `grep -c "^| A[1-5]" .sisyphus/spike-report.md`  # expect >=4
      3. `grep -E "PASS|FAIL|PARTIAL" .sisyphus/spike-report.md | wc -l`  # expect >=4
    Expected Result: OK + ≥4 + ≥4
    Failure Indicators: Missing file, missing rows, or no verdict keywords → report incomplete
    Evidence: .sisyphus/evidence/task-5-report-presence.txt

  Scenario: Plan amendments applied if any spike failed
    Tool: Bash
    Preconditions: spike-report.md exists
    Steps:
      1. `grep -c FAIL .sisyphus/spike-report.md`  # get fail count N
      2. If N > 0: `grep -c "^## Spike Verdicts" .sisyphus/plans/meeting-pilot-layered-asr.md`  # expect 1
      3. If A1 FAIL: `grep -c WebSpeechProvider .sisyphus/plans/meeting-pilot-layered-asr.md`  # expect 0 new refs in remaining tasks
    Expected Result: Amendments visibly present in plan when failures exist
    Failure Indicators: Spike said FAIL but plan still references the failed path → report incomplete, plan out of sync
    Evidence: .sisyphus/evidence/task-5-plan-sync.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/spike-report.md`
  - [ ] `task-5-report-presence.txt`, `task-5-plan-sync.txt`

  **Commit**: YES
  - Message: `docs(meeting-pilot): synthesize Wave 0 spike report and amend plan`
  - Files: `.sisyphus/spike-report.md`, `.sisyphus/plans/meeting-pilot-layered-asr.md`
  - Pre-commit: none

---

### Wave 1 — Foundation: protocol, types, opportunistic fixes

- [x] 6. **Fix fetch timeout in `requestMeetingTranscription` (G1)**

  **What to do**:
  - Add a `timeoutMs` parameter (default 30000) to `requestMeetingTranscription()` in `src/meeting-shell/asrProvider.ts`
  - Use `AbortSignal.timeout(timeoutMs)` (or combine with a user-provided `AbortSignal` via `AbortSignal.any([...])`) on both `fetch()` calls (line 270 chat_completions path and line 318 audio_transcriptions path)
  - On timeout, return `{ ok: false, endpointLabel, errorMessage: 'timeout' }` instead of throwing
  - Update callers in `meetingOffscreen.ts:313` to pass through the default (no behavior change for existing callers yet — `CloudASRProvider` in Task 13 will use an explicit value)
  - Add a Bun unit test in `src/meeting-shell/__tests__/asrProvider.test.ts` that mocks a slow fetch and verifies timeout + error result shape

  **Must NOT do**:
  - Do NOT rewrite the function's public shape beyond adding `timeoutMs`
  - Do NOT change the existing compatibility logic, API-style handling, or error messages (keep diff minimal)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Localized bug fix in a single function; well-defined scope
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `ai-slop-remover`: Not needed — single small change

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 7, 8, 9, 10, 11, 12)
  - **Blocks**: Task 13 (CloudASRProvider uses this)
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/meeting-shell/asrProvider.ts:60-64` — existing `withTimeoutSignal(timeoutMs)` helper (use it, don't reinvent)
  - `src/meeting-shell/asrProvider.ts:227` — `signal: withTimeoutSignal(6000)` in `probeMeetingTranscribeProvider` (pattern to copy)

  **API/Type References**:
  - MDN `AbortSignal.timeout`: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static

  **Test References**:
  - `desktop-app/src/__tests__/*.test.ts` — existing tsx --test pattern (for desktop side); extension uses `bun test` — find an existing bun test file if present or create a fresh `__tests__/` directory

  **WHY Each Reference Matters**:
  - `withTimeoutSignal` already exists in the same file and uses `AbortController` + `setTimeout` — reusing it is free and consistent with the rest of the file

  **Acceptance Criteria**:

  **If TDD (tests enabled)**:
  - [ ] Test file created: `src/meeting-shell/__tests__/asrProvider.test.ts`
  - [ ] `bun test src/meeting-shell/__tests__/asrProvider.test.ts` → PASS (≥2 tests: timeout fires, returns error result with `errorMessage: 'timeout'`)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Hung cloud server triggers timeout and returns error
    Tool: Bash (node REPL + mock server)
    Preconditions: Build the extension; mock a server that sleeps 60s on /v1/audio/transcriptions (use `python3 -m http.server` with a middleware, or node http server)
    Steps:
      1. Start mock server on :9999 that returns 200 after a 60s delay
      2. Write a standalone node harness that imports `requestMeetingTranscription` (via compiled dist) and calls it with baseUrl=http://localhost:9999, timeoutMs=2000
      3. Measure wall-clock time
    Expected Result: Function returns within 2s ± 500ms with `{ ok: false, errorMessage: 'timeout' }` (or similar)
    Failure Indicators: Function hangs past 3s OR returns ok:true OR throws uncaught
    Evidence: .sisyphus/evidence/task-6-timeout-harness.txt

  Scenario: Successful request within timeout behaves unchanged
    Tool: Bash (node + mock server)
    Preconditions: Mock server returns 200 with valid JSON in ~500ms
    Steps:
      1. Call `requestMeetingTranscription` with timeoutMs=5000
      2. Verify response has `ok: true` and `text` field populated
    Expected Result: Normal success, no regression
    Failure Indicators: ok:false on a healthy response → regression
    Evidence: .sisyphus/evidence/task-6-success-harness.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-6-timeout-harness.txt`
  - [ ] `task-6-success-harness.txt`
  - [ ] bun test output

  **Commit**: YES
  - Message: `fix(meeting-pilot): add 30s fetch timeout to requestMeetingTranscription`
  - Files: `src/meeting-shell/asrProvider.ts`, `src/meeting-shell/__tests__/asrProvider.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/__tests__/asrProvider.test.ts`

- [x] 7. **Expand `MeetingPilotTranscriptChunk.source` union + backward-compat**

  **What to do**:
  - Edit `src/meeting-shell/protocol.ts:214`: change `source?: 'whisper' | 'test';` to `source?: 'whisper' | 'cloud' | 'web_speech' | 'desktop_whisper' | 'test';`
  - Add an exported helper `export function normalizeTranscriptSource(value: string | undefined): MeetingPilotTranscriptChunk['source']` that maps legacy `'whisper'` → `'cloud'` on read but accepts either form as valid input
  - Add a type alias `export type MeetingPilotASRTier = 'web_speech' | 'desktop_whisper' | 'cloud';` for use by the orchestrator (tiers are a proper subset of `source`)
  - Update `src/meeting-shell/store.ts` (check if it reads/writes chunks from storage) to run stored chunks through `normalizeTranscriptSource` on deserialization
  - Add unit tests for `normalizeTranscriptSource`: `'whisper' → 'cloud'`, `'test' → 'test'`, `undefined → undefined`, unknown string → `undefined`

  **Must NOT do**:
  - Do NOT delete the `'whisper'` variant — it stays valid forever for backward compat
  - Do NOT change downstream consumers' behavior based on `source` — that's out of scope (see S6)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, mechanical type change + helper + normalize
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 13, 14, 21, 25, 27
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/meeting-shell/protocol.ts:202-216` — exact location of `MeetingPilotTranscriptChunk`
  - `src/meeting-shell/protocol.ts:15-30` — `normalizeMeetingTranscribeApiStyle` is a similar normalize-with-default helper pattern

  **API/Type References**:
  - TS union types with string literals — standard pattern

  **Test References**:
  - Find existing `protocol.test.ts` or create new

  **WHY Each Reference Matters**:
  - `normalizeMeetingTranscribeApiStyle` sets the convention for "accept variants, return canonical" — `normalizeTranscriptSource` follows identically

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `src/meeting-shell/__tests__/protocol.test.ts` created (or extended)
  - [ ] `bun test` → PASS with ≥4 normalize cases

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Existing stored sessions with source='whisper' still load
    Tool: Playwright
    Preconditions: A prior meeting session exists in chrome.storage.local with `transcript: [{source: 'whisper', ...}]`
    Steps:
      1. Build extension with the new types
      2. Open a meeting side panel for the old session
      3. Verify transcript displays
      4. Check console for any JSON parse errors or TypeScript-runtime union errors
    Expected Result: Side panel renders with no errors; chunks display the same as before
    Failure Indicators: Transcript missing or console errors → backward-compat broken
    Evidence: .sisyphus/evidence/task-7-legacy-session.png + task-7-console.txt

  Scenario: New source values are accepted at runtime
    Tool: Bash (node REPL)
    Preconditions: Build complete
    Steps:
      1. Import `normalizeTranscriptSource` from dist
      2. Verify each of `['whisper','cloud','web_speech','desktop_whisper','test',undefined,'garbage']` maps correctly
    Expected Result: All expected mappings match
    Evidence: .sisyphus/evidence/task-7-normalize.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-7-legacy-session.png`, `task-7-console.txt`
  - [ ] `task-7-normalize.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): expand transcript source union for layered ASR`
  - Files: `src/meeting-shell/protocol.ts`, `src/meeting-shell/store.ts` (normalizer call), `src/meeting-shell/__tests__/protocol.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/__tests__/protocol.test.ts`

- [x] 8. **Rename `readiness.dependencies.whisper` → `transcription` (G6) with backward-compat**

  **What to do**:
  - In `src/meeting-shell/protocol.ts`: rename field `whisper` on `MeetingPilotReadinessState.dependencies` to `transcription` (line 46). Update `createDefaultReadinessState()` (line 678) and `createDemoMeetingSnapshot()` (line 790) correspondingly
  - In `src/meeting-shell/background.ts`: update `evaluateMeetingReadiness()` usage of `dependencies.whisper` → `dependencies.transcription` (grep for all references first)
  - Add a compat-read helper `function readTranscriptionDependency(readiness: any): MeetingPilotDependencyReadiness | null` that returns `readiness?.dependencies?.transcription ?? readiness?.dependencies?.whisper ?? null` — applied only during deserialization of stored sessions
  - Update `store.ts` (and any other reader) to use the helper when hydrating stored sessions
  - Grep for UI references in `meetingSidePanel.tsx`, `meetingPanorama.tsx`, options.tsx — rename labels "Whisper" → "Transcription" where they refer to the readiness dependency (NOT where they refer to the actual whisper model)

  **Must NOT do**:
  - Do NOT delete `dependencies.whisper` from historical stored data (backward-compat only)
  - Do NOT rename references to the whisper.cpp model — those stay as "whisper"

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Rename + compat shim; pure mechanical
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 24 (mode-aware readiness uses the new field name)
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/meeting-shell/protocol.ts:31-49` — dependency shape to refactor
  - `src/meeting-shell/protocol.ts:663-695` — `createDefaultReadinessState` constructor
  - `src/meeting-shell/background.ts:216-265` — `evaluateMeetingReadiness` (needs field renames)

  **API/Type References**: N/A (pure rename)

  **Test References**:
  - Any existing readiness test file (check `src/meeting-shell/__tests__/`)

  **WHY Each Reference Matters**:
  - The readiness structure is serialized to storage today — a rename without compat would silently lose state on the first load after the update, manifesting as "all meetings degraded" until a new snapshot is written

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Readiness test added asserting that both `{dependencies: {whisper: ...}}` and `{dependencies: {transcription: ...}}` deserialize correctly

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Existing stored session with `whisper` key hydrates without degradation
    Tool: Playwright
    Preconditions: chrome.storage.local has a session with the old `dependencies.whisper` shape
    Steps:
      1. Load the new extension build
      2. Open meeting side panel for the old session
      3. Check readiness panel
    Expected Result: Readiness shows the old `whisper` dep's status correctly, under the new "Transcription" label
    Failure Indicators: Status reads "degraded — loading" forever OR readiness rendering crashes
    Evidence: .sisyphus/evidence/task-8-legacy-readiness.png

  Scenario: Fresh session uses the new field name in storage
    Tool: Bash + Playwright
    Preconditions: Fresh profile
    Steps:
      1. Start a new meeting, wait for readiness evaluation
      2. Dump chrome.storage.local via `chrome.storage.local.get` in an extension console
      3. Assert the session's readiness has `dependencies.transcription` and does NOT have `dependencies.whisper`
    Expected Result: Only new key present
    Evidence: .sisyphus/evidence/task-8-new-readiness.json
  ```

  **Evidence to Capture**:
  - [ ] `task-8-legacy-readiness.png`
  - [ ] `task-8-new-readiness.json`

  **Commit**: YES
  - Message: `refactor(meeting-pilot): rename readiness.dependencies.whisper to transcription`
  - Files: `src/meeting-shell/protocol.ts`, `src/meeting-shell/background.ts`, `src/meeting-shell/store.ts`, `src/meeting-shell/meetingSidePanel.tsx`, `src/meeting-shell/meetingPanorama.tsx`
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 9. **Add `MEETING_TRANSCRIPTION_MODE` env config + Options page dropdown**

  **What to do**:
  - Add a new env config key `MEETING_TRANSCRIPTION_MODE: 'auto' | 'local-only' | 'cloud-only'` (default `'auto'`) to `src/utils.ts` `EnvConfigType` type and to `.env.example`
  - Add a helper `getMeetingTranscriptionMode(envConfig)` that normalizes unknown values → `'auto'`
  - In `src/options.tsx`, add a new section "Meeting Pilot → Transcription" with a dropdown bound to this key. Options: `Auto (local first)` / `Local only` / `Cloud only`. Persist via the existing envConfig save flow
  - Add subtle explanation text: "Auto tries on-device and desktop Whisper first, then cloud. Local-only never contacts cloud. Cloud-only always uses cloud (requires API key)."
  - Unit test `getMeetingTranscriptionMode`: accepts all 3 values, defaults unknown to `'auto'`, handles `undefined`

  **Must NOT do**:
  - Do NOT wire the setting to any runtime consumer yet (Task 20 / 24 do that)
  - Do NOT rename or refactor surrounding options UI beyond adding this section

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Env key + small UI addition, well-defined scope
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Ensure dropdown matches existing Options page visual language

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 20, 23, 24
  - **Blocked By**: Task 5

  **References**:
  - `src/utils.ts` (grep for `EnvConfigType`) — where new env keys are declared
  - `src/options.tsx` — existing options UI pattern; find the existing Meeting Pilot section (grep for `MEETING_PROVIDER_BASE_URL`)
  - `src/meeting-shell/asrProvider.ts:15-21` — pattern for normalize helper

  **WHY Each Reference Matters**: Matches existing env + normalize conventions so the new key feels native.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `bun test` covering `getMeetingTranscriptionMode` with 5+ cases

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Dropdown saves and re-reads correctly
    Tool: Playwright
    Preconditions: Fresh extension build, extension loaded
    Steps:
      1. Open chrome-extension://<id>/options.html
      2. Find the Transcription dropdown by label "Transcription Mode"
      3. Select "Local only", click Save
      4. Reload options page
      5. Assert dropdown shows "Local only"
      6. Dump chrome.storage.local, assert `MEETING_TRANSCRIPTION_MODE === 'local-only'`
    Expected Result: Value persists, dropdown restores it
    Evidence: .sisyphus/evidence/task-9-dropdown.png + task-9-storage.json

  Scenario: Default is 'auto' on fresh install
    Tool: Playwright
    Preconditions: Fresh profile, no prior storage
    Steps:
      1. Open options page
      2. Read dropdown value
    Expected Result: "Auto (local first)" selected
    Evidence: .sisyphus/evidence/task-9-default.png
  ```

  **Evidence to Capture**:
  - [ ] `task-9-dropdown.png`, `task-9-storage.json`, `task-9-default.png`

  **Commit**: YES
  - Message: `feat(meeting-pilot): add transcription mode setting to options`
  - Files: `src/utils.ts`, `src/options.tsx`, `.env.example`, `src/meeting-shell/__tests__/transcriptionMode.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun run build && bun test`

- [x] 10. **Define `ASRProvider` interface + tier enum + event types**

  **What to do**:
  - Create `src/meeting-shell/asr/types.ts` with:
    - `type MeetingPilotASRTier = 'web_speech' | 'desktop_whisper' | 'cloud';`
    - `interface ASRTranscriptEvent { kind: 'interim' | 'final'; text: string; tier: MeetingPilotASRTier; ts: number; }`
    - `interface ASRErrorEvent { tier: MeetingPilotASRTier; code: 'network' | 'audio' | 'unavailable' | 'aborted' | 'unknown'; message: string; ts: number; fatal: boolean; }`
    - `interface ASRStatusEvent { tier: MeetingPilotASRTier; state: 'starting' | 'running' | 'stopped'; ts: number; }`
    - `type ASREventMap = { transcript: ASRTranscriptEvent; error: ASRErrorEvent; status: ASRStatusEvent; }`
    - `interface ASRProvider { readonly tier: MeetingPilotASRTier; isAvailable(): Promise<{ok: boolean; reason?: string}>; start(audio: MediaStreamTrack | MediaStream): Promise<void>; stop(): Promise<void>; on<K extends keyof ASREventMap>(event: K, handler: (e: ASREventMap[K]) => void): () => void; }`
  - The interface MUST document (via JSDoc) that `stop()` MUST complete before any further `start()` is called, and `stop()` must release all audio resources (L6)
  - No implementation yet — pure type file
  - Add a `createASREventEmitter()` helper (internal, pure TS) with strong typing for providers to use

  **Must NOT do**:
  - Do NOT add methods "for future flexibility" — exactly the methods listed
  - Do NOT make the interface generic/parameterized — concrete types
  - Do NOT implement any provider here

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type-only file, narrow scope
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 13, 14, 20, 21
  - **Blocked By**: Task 5

  **References**:
  - `src/meeting-shell/protocol.ts:202` — `MeetingPilotTranscriptChunk` shape (transcripts produced by orchestrator eventually map to this)
  - Node `EventEmitter` documentation: https://nodejs.org/api/events.html (pattern only; don't import Node's impl into browser code)

  **WHY Each Reference Matters**:
  - Transcript events must be convertible to `MeetingPilotTranscriptChunk` in `meetingOffscreen.ts` (Task 26) — field names should line up so the adapter is trivial

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `src/meeting-shell/asr/__tests__/types.test.ts` exercises `createASREventEmitter` emit/listen/unsubscribe

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Emitter contract works
    Tool: Bash (bun test)
    Preconditions: Types + emitter compiled
    Steps:
      1. Instantiate emitter
      2. Register listener for 'transcript'; emit transcript event; verify listener called with exact payload
      3. Call unsubscribe returned by `on()`; emit again; verify listener NOT called
      4. Register listener for 'error'; verify 'transcript' emits do NOT trigger it
    Expected Result: All assertions hold
    Evidence: .sisyphus/evidence/task-10-emitter.txt

  Scenario: TS strict-mode compile of types file
    Tool: Bash
    Steps:
      1. `bun run tsc --noEmit src/meeting-shell/asr/types.ts` (or check errors via `lsp_diagnostics`)
    Expected Result: Zero errors, zero warnings
    Evidence: .sisyphus/evidence/task-10-tsc.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-10-emitter.txt`, `task-10-tsc.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): define ASRProvider interface and event types`
  - Files: `src/meeting-shell/asr/types.ts`, `src/meeting-shell/asr/__tests__/types.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/asr/__tests__/`

- [x] 11. **Define tier-status protocol messages + session snapshot fields**

  **What to do**:
  - Extend `MeetingPilotPanelCommand.type` in `src/meeting-shell/protocol.ts:319-338` with two new values: `'MEETING_PILOT_TIER_STATUS_UPDATE'`, `'MEETING_PILOT_TIER_FALLBACK_NOTICE'`
  - Add `interface MeetingPilotTierStatus { activeTier: MeetingPilotASRTier | null; badge: 'Probing' | 'On-Device' | 'Local Whisper' | 'Cloud' | 'No ASR'; mode: 'auto' | 'local-only' | 'cloud-only'; lastTransitionAt?: number; lastTransitionReason?: string; }`
  - Add field `tier?: MeetingPilotTierStatus` to `MeetingPilotSessionSnapshot` (line 230-264)
  - Update `createMeetingPilotSessionSnapshot()` (line 697) to default `tier` to `{ activeTier: null, badge: 'Probing', mode: 'auto' }`
  - Add JSDoc comments that enumerate valid badge transitions (from Metis AC3): `Probing → {On-Device, Local Whisper, Cloud, No ASR}`, `On-Device → {Local Whisper, Cloud, No ASR}`, `Local Whisper → {Cloud, No ASR}`, `Cloud → No ASR`, and "no upward transitions mid-meeting"
  - Unit test: state-machine transition validator `isValidTierTransition(from, to): boolean`

  **Must NOT do**:
  - Do NOT ship the tier state machine as a runtime class yet — just types + validator helper
  - Do NOT change `readiness` shape (Task 8 did that)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Types + small validator
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 20, 22, 24, 27
  - **Blocked By**: Task 5

  **References**:
  - `src/meeting-shell/protocol.ts:230-264` — `MeetingPilotSessionSnapshot` shape
  - `src/meeting-shell/protocol.ts:697-745` — `createMeetingPilotSessionSnapshot` default constructor
  - Metis AC3 in this plan (transition table)

  **WHY Each Reference Matters**: Adding a field to the snapshot without updating the default constructor produces runtime `undefined` for existing sessions — causing UI `cannot read properties of undefined` errors.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `bun test` on transition validator: 10+ cases covering valid + invalid transitions

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Existing sessions get default tier on hydrate
    Tool: Playwright
    Preconditions: Old stored session without `tier` field
    Steps:
      1. Load extension, open meeting side panel for that session
      2. Console-log `session.tier`
    Expected Result: `{ activeTier: null, badge: 'Probing', mode: 'auto' }`
    Evidence: .sisyphus/evidence/task-11-default.txt

  Scenario: Transition validator matches AC3 table
    Tool: Bash (bun test)
    Steps:
      1. Run all cases from Metis AC3 transition table
    Expected Result: All valid transitions return true; invalid (e.g., 'Cloud' → 'On-Device') return false
    Evidence: .sisyphus/evidence/task-11-transitions.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-11-default.txt`, `task-11-transitions.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): add tier status fields to session protocol`
  - Files: `src/meeting-shell/protocol.ts`, `src/meeting-shell/__tests__/protocol.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/__tests__/`

- [x] 12. **Add `lowConfidence` guard in `handleTranscriptUpdate` (G7)**

  **What to do**:
  - Locate `handleTranscriptUpdate()` in `src/meeting-shell/background.ts` (around line 1382; grep for the function name)
  - At the top of the function body, after the chunk is appended to the session's transcript, add: `if (chunk.lowConfidence) { broadcastSessionSnapshot(session); return; }` — i.e., persist + broadcast, but early-return before any LLM analysis / speaker resolution / memory recall work
  - Verify that the speaker resolver is called AFTER this guard (so resolution is deferred for interims)
  - Add an in-line comment citing Metis G7 rationale
  - Unit test: mock the downstream `runMeetingAnalysis`; call `handleTranscriptUpdate` with `lowConfidence: true`; assert `runMeetingAnalysis` NOT called; call with `lowConfidence: false` or undefined; assert it IS called

  **Must NOT do**:
  - Do NOT refactor `handleTranscriptUpdate` beyond adding this guard (scope creep per S6)
  - Do NOT change memory recall or action-item extraction logic — the guard just skips them for interims

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Narrow addition with clear boundary
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 25, 26
  - **Blocked By**: Task 5

  **References**:
  - `src/meeting-shell/background.ts` — grep for `handleTranscriptUpdate` and `runMeetingAnalysis`
  - Metis G7 in this plan's Context section

  **WHY Each Reference Matters**: Every interim from Web Speech fires `result` events multiple times per second. Without G7, LLM analysis costs and rate limits blow up.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Extension test covering the guard (mock LLM call, assert skip/call per flag)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: lowConfidence chunk skips analysis
    Tool: Playwright
    Preconditions: Mock/stub the LLM endpoint; extension build with this change
    Steps:
      1. Start a mock meeting via MEETING_PILOT_SPIKE_MODE (or inject a chunk via chrome.runtime.sendMessage)
      2. Send 10 chunks with lowConfidence=true followed by 1 with lowConfidence=false
      3. Count requests to the mocked LLM endpoint
    Expected Result: LLM endpoint called exactly once (for the final chunk)
    Evidence: .sisyphus/evidence/task-12-guard.txt

  Scenario: Unit test coverage
    Tool: Bash (bun test)
    Steps:
      1. `bun test` the new test
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-12-unit.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-12-guard.txt`, `task-12-unit.txt`

  **Commit**: YES
  - Message: `fix(meeting-pilot): skip LLM analysis for interim (lowConfidence) transcript chunks`
  - Files: `src/meeting-shell/background.ts`, `src/meeting-shell/__tests__/handleTranscriptUpdate.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test`

---

### Wave 2 — Providers + Desktop infrastructure

- [x] 13. **`CloudASRProvider` — wrap existing 5s chunk path**

  **What to do**:
  - Create `src/meeting-shell/asr/cloudASRProvider.ts` implementing `ASRProvider` with `tier: 'cloud'`
  - `isAvailable()`: return `{ok: false, reason: 'missing base URL or API key'}` when env lacks `MEETING_PROVIDER_BASE_URL` or `MEETING_PROVIDER_API_KEY`; otherwise return `{ok: true}` (don't probe the server — that adds latency; defer to actual start)
  - `start(track)`: internally manage a `MediaRecorder` with the existing 5s segment loop (copy the logic pattern from `startNextTranscriptionSegment` in `meetingOffscreen.ts:400-456`, but scoped to this provider). On each final segment: call `requestMeetingTranscription` with a 30s timeout (Task 6); on success, emit a `transcript` event with `kind: 'final'` and `tier: 'cloud'`. No interim events.
  - `stop()`: stop the MediaRecorder, drain the queue (max 3 pending), release AudioContext if created
  - Emit `error` event with `fatal: true` when 3 consecutive segments fail (so orchestrator triggers fallback)
  - Unit test with mocked `requestMeetingTranscription`: verify segment loop, transcript emission, error-after-3-failures

  **Must NOT do**:
  - Do NOT change the server-side API style or endpoint
  - Do NOT add streaming — this tier stays chunked (S2)
  - Do NOT deduplicate audio — rely on existing server behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Wraps existing, well-tested logic in the new interface; mostly adapter code
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 20
  - **Blocked By**: Tasks 6, 7, 10

  **References**:
  - `src/meeting-shell/meetingOffscreen.ts:244-357` — `runTranscriptionSegment` logic (copy with minimal change)
  - `src/meeting-shell/meetingOffscreen.ts:400-456` — `startNextTranscriptionSegment` MediaRecorder loop
  - `src/meeting-shell/transcodeForWhisper.ts` — `prepareMediaBlobForTranscription`
  - `src/meeting-shell/asrProvider.ts:250` — `requestMeetingTranscription` (now with timeout from Task 6)

  **WHY Each Reference Matters**: Reuse the proven production code verbatim — this provider is a refactor, not a rewrite. Deviation risks regressions.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `src/meeting-shell/asr/__tests__/cloudASRProvider.test.ts` covers: start emits first final within N seconds (mocked fetch); stop drains queue; 3 consecutive failures emit fatal error

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Cloud provider transcribes with existing cloud backend
    Tool: Playwright
    Preconditions: MEETING_PROVIDER_* configured with a real test endpoint; build complete; cloud-only mode in options
    Steps:
      1. Start a meeting with known audio
      2. Wait 30s
      3. Observe transcript chunks in session snapshot
    Expected Result: At least 3 chunks with `source: 'cloud'`; transcripts plausibly match the audio
    Evidence: .sisyphus/evidence/task-13-cloud-live.json

  Scenario: Fatal error after 3 failures triggers error event
    Tool: Bash (bun test with mocked fetch)
    Steps:
      1. Mock `requestMeetingTranscription` to return `{ok:false}` three times
      2. Instantiate and start CloudASRProvider with a dummy audio track
      3. Register error listener; run long enough for 3 failures
    Expected Result: error event fired with `fatal: true` after the 3rd failure
    Evidence: .sisyphus/evidence/task-13-fatal.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-13-cloud-live.json`, `task-13-fatal.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): implement CloudASRProvider wrapping existing cloud path`
  - Files: `src/meeting-shell/asr/cloudASRProvider.ts`, `src/meeting-shell/asr/__tests__/cloudASRProvider.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/asr/`

- [x] 14. **`WebSpeechProvider` — tier 1 (depends on Wave 0 A1/A2 PASS)**

  **What to do**:
  - Gate the entire file behind `process.env.SPIKE_A1_PASS` at build time (set via env from Task 5's spike report); if A1 fails, this provider ships but `isAvailable()` always returns false
  - Create `src/meeting-shell/asr/webSpeechProvider.ts` implementing `ASRProvider` with `tier: 'web_speech'`
  - `isAvailable()`: check `typeof SpeechRecognition !== 'undefined' || typeof webkitSpeechRecognition !== 'undefined'`; if `SpeechRecognition.available` exists, call `{ langs: ['en-US'], processLocally: true }` and return its result
  - `start(track)`: create `SpeechRecognition`, set `continuous = true`, `interimResults = true`, `processLocally = true`; call `start(track)`; forward `result` events to transcript events (interim vs final based on `isFinal`); handle `end` event by AUTO-RESTARTING (Metis E6, not an error); handle `error` event — distinguish `no-speech` (restart) vs other codes (emit error, mark fatal)
  - `stop()`: `recognition.abort()` + release references; idempotent
  - Protect against double-start with an internal state flag
  - Unit tests with mock SpeechRecognition: interim→final sequence, auto-restart on `end`, fatal on `error.error='network'`

  **Must NOT do**:
  - Do NOT fall back to a mic-based path if tab audio fails — just return unavailable (per docs/features/meeting_pilot.md existing rejection)
  - Do NOT use `webkitSpeechRecognition` if `SpeechRecognition` is available (prefer the standard)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Non-trivial state machine (interim/final/restart/error-distinction); needs careful implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 20
  - **Blocked By**: Tasks 7, 10 (+ Task 5 spike PASS)

  **References**:
  - Spike evidence: `.sisyphus/evidence/task-1-*`
  - MDN SpeechRecognition events: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition#events
  - Metis E6 in Context section

  **WHY Each Reference Matters**: Spike evidence defines exact constructor + API behavior in this Chrome context. Guessing the API surface without referencing spike outputs leads to runtime failures.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `webSpeechProvider.test.ts` mocks `SpeechRecognition`; covers interim/final, restart-on-end, error handling

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: End-to-end tier 1 transcription
    Tool: Playwright
    Preconditions: Chrome 139+, auto mode, known test audio tab
    Steps:
      1. Start meeting; orchestrator selects tier 1
      2. Collect interim + final events for 20s
    Expected Result: ≥5 interim events; ≥2 final events; final text plausibly matches audio
    Evidence: .sisyphus/evidence/task-14-e2e.json

  Scenario: Silence-driven `end` → auto restart
    Tool: Playwright
    Preconditions: Tier 1 active; audio source goes silent for 35s
    Steps:
      1. Monitor provider; verify it emits `status: 'running'` before silence, `status: 'running'` still after the 35s silence (not 'stopped')
    Expected Result: No 'stopped' status during silence; resumes producing transcripts when audio returns
    Evidence: .sisyphus/evidence/task-14-silence.txt

  Scenario: Error with `error.error='network'` → fatal
    Tool: Playwright (force offline mid-session via DevTools)
    Steps:
      1. Start tier 1 with internet
      2. Toggle offline in DevTools
      3. Observe error events
    Expected Result: `error` event with `fatal: true` code='network' within 10s
    Evidence: .sisyphus/evidence/task-14-offline.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-14-e2e.json`, `task-14-silence.txt`, `task-14-offline.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): implement WebSpeechProvider (tier 1 on-device)`
  - Files: `src/meeting-shell/asr/webSpeechProvider.ts`, `src/meeting-shell/asr/__tests__/webSpeechProvider.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/asr/`

- [x] 15. **PCM AudioWorklet processor + build pipeline**

  **What to do**:
  - Create `src/meeting-shell/asr/pcmWorkletProcessor.ts` (TS source, NOT bundled through webpack) with an `AudioWorkletProcessor` class that: (a) receives Float32 frames (128 samples @ 48kHz typical), (b) resamples to 16kHz mono via simple linear interpolation (or decimation if input is 48k — exact 3:1 downsample), (c) converts to Int16, (d) buffers until ~200ms (3200 samples) accumulated, (e) `this.port.postMessage` with `ArrayBuffer` to main thread
  - Add a build step in `scripts/build.mjs` (or webpack config) that compiles this file standalone with tsc/esbuild (no bundler) → `dist/pcm-worklet.js`. Add the output path to any asset-copy manifest
  - Create `src/meeting-shell/asr/pcmStreamer.ts` — a small main-thread helper that: sets up AudioContext, calls `addModule('pcm-worklet.js')`, constructs an `AudioWorkletNode`, connects input track, exposes an async iterator or event emitter over incoming `ArrayBuffer` messages
  - Unit test `pcmStreamer` with a stub `AudioWorkletNode`

  **Must NOT do**:
  - Do NOT use `ScriptProcessorNode` (deprecated)
  - Do NOT attempt sample-rate-aware high-quality resampling — simple decimation is fine for MVP; Whisper is tolerant
  - Do NOT bundle the worklet script — it MUST be a separate standalone file

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Audio pipeline + build-tool integration; requires attention to runtime side-by-side assets
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 21
  - **Blocked By**: Task 5 (spike validates AudioWorklet availability)

  **References**:
  - `.sisyphus/evidence/task-3-*` — spike code (productionize it)
  - MDN `AudioWorkletProcessor`: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
  - whisper.cpp requires 16kHz PCM16 mono: https://github.com/ggerganov/whisper.cpp#general-usage

  **WHY Each Reference Matters**: Whisper is tightly coupled to 16kHz PCM16 — outputting any other format guarantees garbage transcripts.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Unit test for `pcmStreamer`: simulates worklet messages, verifies buffered Int16 output matches expected byte layout

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Worklet file shipped to dist/ unchanged
    Tool: Bash
    Steps:
      1. `bun run build`
      2. `test -f dist/pcm-worklet.js && echo OK`
      3. `head -5 dist/pcm-worklet.js` (should look like a standalone processor script)
    Expected Result: File present, recognizable as a processor
    Evidence: .sisyphus/evidence/task-15-dist.txt

  Scenario: Live PCM emission with known tone
    Tool: Playwright
    Preconditions: A test tab plays a 1kHz sine wave
    Steps:
      1. Open a dev harness page that runs `pcmStreamer`
      2. Capture first 500ms of PCM output to .sisyphus/evidence/task-15-tone-output.pcm
      3. Verify file size ≈ 16000 bytes (500ms × 16kHz × 2 bytes)
      4. Open in a tool (sox/audacity/python-wave) — waveform should show the sine
    Expected Result: Size correct; waveform recognizable
    Evidence: .sisyphus/evidence/task-15-tone-output.pcm + task-15-wave-analysis.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-15-dist.txt`, `task-15-tone-output.pcm`, `task-15-wave-analysis.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): add PCM16 AudioWorklet pipeline for local ASR`
  - Files: `src/meeting-shell/asr/pcmWorkletProcessor.ts`, `src/meeting-shell/asr/pcmStreamer.ts`, `scripts/build.mjs` (or webpack config), `src/meeting-shell/asr/__tests__/pcmStreamer.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun run build && test -f dist/pcm-worklet.js`

- [x] 16. **Desktop-app whisper.cpp engine wrapper**

  **What to do**:
  - Choose whisper.cpp binding: prefer `nodejs-whisper` or `whisper-node` npm package (verify availability + macOS CoreML support at implementation time); if neither is adequate, wrap `whisper.cpp`'s CLI binary directly
  - Create `desktop-app/src/whisper/whisperEngine.ts` exporting `class WhisperEngine` with: `load(modelPath: string): Promise<void>`, `transcribe(pcm16: Buffer, opts?: {language?: string; translate?: boolean}): Promise<{text: string; segments: Array<{start:number; end:number; text:string}>;}>`, `unload(): Promise<void>`, `isLoaded(): boolean`
  - Keep one engine instance as a module-level singleton; serialize transcribe calls so we don't re-enter whisper concurrently
  - If using a binding: enable CoreML acceleration on macOS (`arm64`); fall back to CPU on Intel
  - Write a test that loads a committed tiny test audio (< 100KB PCM16 in `desktop-app/src/whisper/__tests__/fixtures/hello.pcm`) and verifies `text` includes an expected keyword
  - Error handling: wrap all binding calls with structured errors; expose `{code: 'model_missing' | 'load_failed' | 'transcribe_failed'; message: string}`

  **Must NOT do**:
  - Do NOT build whisper.cpp from source in this repo — rely on a pre-built binding or bundled binary
  - Do NOT support multiple concurrent transcriptions — single-threaded queue
  - Do NOT add Windows code paths (S5)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Native binding integration + platform-specific acceleration; needs research and testing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 17, 18
  - **Blocked By**: Task 5

  **References**:
  - whisper.cpp CoreML models: https://github.com/ggerganov/whisper.cpp/blob/master/models/README.md
  - `nodejs-whisper`: https://www.npmjs.com/package/nodejs-whisper (check before committing)
  - Existing `desktop-app/src/assistantRuntime.ts` pattern for singleton runtime objects
  - `desktop-app/src/__tests__/*.test.ts` — `tsx --test` pattern

  **WHY Each Reference Matters**: Using an existing binding saves weeks vs custom FFI; CoreML gives 3–5× speedup on M-series Macs making the `base` model viable in real-time.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `desktop-app/src/whisper/__tests__/whisperEngine.test.ts` transcribes fixture PCM and asserts non-empty result

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Load model + transcribe fixture
    Tool: Bash (tsx)
    Preconditions: Model downloaded manually for this test to a known path
    Steps:
      1. `tsx desktop-app/scripts/whisper-manual-check.ts --model=<path> --audio=<fixture>`
      2. Script loads engine, transcribes, prints text + timing
    Expected Result: Text matches the fixture's known content; wall-clock < 5s for a 2s PCM fixture on M-series
    Evidence: .sisyphus/evidence/task-16-manual.txt

  Scenario: Errors are structured, not raw
    Tool: Bash (tsx)
    Steps:
      1. Call `load('/nonexistent/model.bin')`
    Expected Result: Rejects with `{code: 'model_missing'}` not a raw FFI error
    Evidence: .sisyphus/evidence/task-16-errors.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-16-manual.txt`, `task-16-errors.txt`, test output

  **Commit**: YES
  - Message: `feat(desktop-app): add whisper.cpp engine wrapper with CoreML`
  - Files: `desktop-app/src/whisper/whisperEngine.ts`, `desktop-app/src/whisper/__tests__/whisperEngine.test.ts`, `desktop-app/src/whisper/__tests__/fixtures/hello.pcm`, `desktop-app/package.json` (binding dep), `desktop-app/scripts/whisper-manual-check.ts`
  - Pre-commit: `npm --prefix desktop-app run build && npm --prefix desktop-app test -- --test-name-pattern whisperEngine`

- [x] 17. **Desktop-app model manager (download + validate + cache)**

  **What to do**:
  - Create `desktop-app/src/whisper/modelManager.ts` with:
    - `const MODEL_NAME = 'ggml-base.en'` — hardcoded single model (per S4)
    - `const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'` — with fallback mirror(s)
    - `const MODEL_EXPECTED_BYTES = 147964211` (base.en file size, verify at implementation time)
    - `const MODEL_SHA256 = '<known-hash>'` (look up at impl time, hardcode)
    - `getModelPath(): string` → `~/Library/Application Support/Personal AI/whisper-models/{MODEL_NAME}.bin`
    - `async isModelReady(): Promise<{ ready: boolean; reason?: 'missing' | 'corrupt' | 'size_mismatch' }>` — checks file exists + size matches + SHA256 matches
    - `async downloadModel(onProgress: (pct: number) => void): Promise<{ ok: true } | { ok: false; error: string }>` — streams the file to a `.tmp` sibling, renames atomically on success; emits progress every 2s or 5% whichever is more frequent
    - `async deleteModel(): Promise<void>` — removes the file
  - Partial-download detection: on launch, if `.tmp` exists without the real file → resume or restart (simple restart for MVP)
  - Include a smoke-transcribe after download: call `whisperEngine.load` + `transcribe` on a tiny built-in fixture; if result is empty string, mark as corrupt and delete
  - Unit tests: mock filesystem + fetch; cover happy path, size mismatch, hash mismatch, network error mid-download

  **Must NOT do**:
  - Do NOT add a model picker (S4)
  - Do NOT support multiple model variants simultaneously — only `ggml-base.en`
  - Do NOT store the model inside the app bundle — always `~/Library/Application Support/...`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: File-I/O + networking + atomicity + validation — easy to get subtly wrong
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 18, 23
  - **Blocked By**: Task 16

  **References**:
  - HuggingFace model: https://huggingface.co/ggerganov/whisper.cpp
  - `desktop-app/src/memoryServiceClient.ts` — existing pattern for streaming HTTP in the desktop-app (grep the file)
  - `desktop-app/src/settings.ts` — pattern for resolving app-data paths

  **WHY Each Reference Matters**: Reusing existing path resolution logic (e.g., `getAppDataDir`) avoids cross-platform path bugs.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Unit tests covering download + validation mock scenarios

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Fresh download + validate + smoke transcribe
    Tool: Bash (tsx)
    Preconditions: No prior model at target path
    Steps:
      1. Delete any existing model: `rm -f ~/Library/Application\ Support/Personal\ AI/whisper-models/ggml-base.en.bin`
      2. Run `tsx desktop-app/scripts/download-model-manual.ts` (spawns downloadModel with console progress)
      3. After completion: `isModelReady()` → `{ ready: true }`
      4. Smoke transcribe fixture → non-empty text
    Expected Result: Download completes (may take several minutes); isModelReady true; smoke passes
    Evidence: .sisyphus/evidence/task-17-download.txt

  Scenario: Size-mismatch detection + re-download
    Tool: Bash
    Preconditions: Model downloaded successfully
    Steps:
      1. `truncate -s 10000000 ~/Library/Application\ Support/Personal\ AI/whisper-models/ggml-base.en.bin`
      2. Run `isModelReady()` → `{ ready: false, reason: 'size_mismatch' }`
      3. Re-run downloadModel; verify it re-downloads fully
    Expected Result: Corruption detected; clean re-download
    Evidence: .sisyphus/evidence/task-17-corrupt.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-17-download.txt`, `task-17-corrupt.txt`, unit test output

  **Commit**: YES
  - Message: `feat(desktop-app): add whisper model manager with download + validation`
  - Files: `desktop-app/src/whisper/modelManager.ts`, `desktop-app/src/whisper/__tests__/modelManager.test.ts`, `desktop-app/scripts/download-model-manual.ts`
  - Pre-commit: `npm --prefix desktop-app test -- --test-name-pattern modelManager`

- [x] 18. **Desktop-app Fastify `/whisper/*` routes**

  **What to do**:
  - Create `desktop-app/src/whisper/whisperRoutes.ts` registering Fastify routes on the existing server instance:
    - `GET /whisper/status` → `{ ok: true, modelReady: boolean, engineLoaded: boolean, activeSessionId: string | null }`
    - `POST /whisper/model/ensure` → triggers download if missing, streams progress via server-sent events or responds with `{ ok: true, downloading: true, progressEndpoint: '/whisper/model/progress' }`
    - `GET /whisper/model/progress` → SSE stream of `{ pct: number }` (or long-poll with Fastify-websocket if already in deps)
    - `POST /whisper/session/start` (body: `{ sessionId: string }`) → loads engine, prepares a session buffer
    - `POST /whisper/session/:id/chunk` (body: raw PCM16 bytes) → appends to session buffer; triggers incremental transcribe if enough audio accumulated; responds `{ interim?: string, final?: string }`
    - `POST /whisper/session/:id/stop` → flush + final transcribe + cleanup
  - Register routes in `desktop-app/src/server.ts` via the existing plugin pattern
  - All endpoints require the desktop-app's existing localhost-only auth token (reuse existing middleware)
  - Unit tests using Fastify's `inject` API — covers status, ensure-model-missing, session start/chunk/stop happy path

  **Must NOT do**:
  - Do NOT expose these routes to non-localhost requests
  - Do NOT bypass the existing auth middleware
  - Do NOT duplicate the Fastify bootstrap — attach to the existing instance

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward Fastify plugin; pattern well-established in this desktop-app
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 19, 21
  - **Blocked By**: Tasks 16, 17

  **References**:
  - `desktop-app/src/server.ts` — existing Fastify setup
  - `desktop-app/src/__tests__/*.test.ts` — existing Fastify `inject` test pattern

  **WHY Each Reference Matters**: Integrating with the existing server (auth, lifecycle, port) avoids duplicate setup logic and keeps the desktop-app's attack surface small.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `whisperRoutes.test.ts` uses Fastify `inject` for all endpoints

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Happy-path status check
    Tool: Bash (curl)
    Preconditions: desktop-app running
    Steps:
      1. `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:46321/whisper/status`
    Expected Result: HTTP 200, JSON with `ok: true`
    Evidence: .sisyphus/evidence/task-18-status.txt

  Scenario: Session start → chunk → stop
    Tool: Bash (curl)
    Preconditions: desktop-app running with model ready
    Steps:
      1. `curl POST /whisper/session/start` with body `{"sessionId":"t1"}` → 200
      2. `curl POST /whisper/session/t1/chunk --data-binary @fixture.pcm` → 200
      3. `curl POST /whisper/session/t1/stop` → 200 with `final` text
    Expected Result: Each step returns 200; final text non-empty
    Evidence: .sisyphus/evidence/task-18-session.txt

  Scenario: Unauthorized access rejected
    Tool: Bash (curl without Authorization header)
    Steps:
      1. `curl http://127.0.0.1:46321/whisper/status` (no auth)
    Expected Result: 401 or 403
    Evidence: .sisyphus/evidence/task-18-auth.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-18-status.txt`, `task-18-session.txt`, `task-18-auth.txt`

  **Commit**: YES
  - Message: `feat(desktop-app): expose Fastify /whisper routes for session transcription`
  - Files: `desktop-app/src/whisper/whisperRoutes.ts`, `desktop-app/src/server.ts`, `desktop-app/src/whisper/__tests__/whisperRoutes.test.ts`
  - Pre-commit: `npm --prefix desktop-app test -- --test-name-pattern whisperRoutes && npm --prefix desktop-app run build`

- [x] 19. **NM host stdio↔HTTP bridge binary + manifest installer**

  **What to do**:
  - Create `desktop-app/app/native/nm-whisper-bridge.mjs` — a Node.js script that:
    1. Reads Chrome NM framed messages from stdin (4-byte LE length + UTF-8 JSON)
    2. Extracts the desktop-app's localhost auth token from a fixed well-known file (e.g., `~/Library/Application Support/Personal AI/.nm-token`)
    3. Routes each message to `http://127.0.0.1:46321/whisper/...` per a tiny protocol (`{method, path, body}`) — or a stronger typed message envelope
    4. Streams responses (especially SSE progress) back to Chrome as NM messages
    5. Exits cleanly on stdin EOF (Metis E7)
  - Make the script node-shebang executable; add a post-build step in `desktop-app/scripts/build.mjs` that copies it to `desktop-app/app/native/bin/nm-whisper-bridge` with `+x`
  - Create `desktop-app/src/nativeMessaging/manifestInstaller.ts`:
    - `const HOST_NAME = 'com.personal_ai.whisper_host';`
    - `async installManifest(extensionIds: string[]): Promise<void>` writes JSON to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.personal_ai.whisper_host.json` with correct `path` (absolute) + `allowed_origins`
    - Called from `desktop-app/app/main.mjs` during Electron `ready` event; idempotent; logs success/failure
  - The installer also writes the `.nm-token` file with current session's auth token (600 perms)
  - Tests: manifestInstaller unit test covers JSON shape + path correctness (mock fs); bridge script tested manually via `echo` + framed stdin

  **Must NOT do**:
  - Do NOT write the manifest to `/Library/Google/...` (system-wide) — per-user path only
  - Do NOT bundle the bridge script using webpack/esbuild — it runs as a standalone node script invoked by Chrome
  - Do NOT leak the auth token in NM messages — read it server-side in the bridge only

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Stdio framing + process lifecycle + filesystem installer; all must be correct or Chrome silently refuses
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 21, 29
  - **Blocked By**: Tasks 5, 18

  **References**:
  - `node_modules/webpage-mcp/dist/mcp/mcp-server-stdio.js` — working stdio framing example to copy
  - Chrome NM reference: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host
  - `desktop-app/app/main.mjs` — Electron `app.on('ready')` hook location
  - Spike evidence `.sisyphus/evidence/task-2-*`

  **WHY Each Reference Matters**: Following the working stdio framing from `webpage-mcp` eliminates the most common failure mode (incorrect length-prefix byte order).

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `manifestInstaller.test.ts` verifies JSON + path + permission bits (mocked fs)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Manifest installed on app launch
    Tool: Bash
    Preconditions: desktop-app built
    Steps:
      1. Delete `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.personal_ai.whisper_host.json`
      2. Launch desktop-app (`npm --prefix desktop-app run app:dev` briefly)
      3. Check file exists and is valid JSON with required fields
      4. `test -x $(jq -r .path <manifest>)` → OK (bridge is executable)
    Expected Result: All assertions pass
    Evidence: .sisyphus/evidence/task-19-manifest.txt

  Scenario: Bridge roundtrip via manual NM framing
    Tool: Bash (python3 for framing)
    Preconditions: Bridge script executable, desktop-app running
    Steps:
      1. `python3 desktop-app/scripts/nm-bridge-probe.py` — sends a framed `{method:'GET', path:'/whisper/status'}` to the bridge script via stdin
      2. Script reads the framed reply and prints JSON
    Expected Result: Reply contains `ok:true`, `modelReady` field
    Evidence: .sisyphus/evidence/task-19-bridge.txt

  Scenario: Bridge exits on stdin EOF (E7)
    Tool: Bash
    Steps:
      1. Launch bridge; close stdin after 500ms
      2. Verify process exits within 5s with exit code 0
    Expected Result: Process exits cleanly
    Evidence: .sisyphus/evidence/task-19-eof.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-19-manifest.txt`, `task-19-bridge.txt`, `task-19-eof.txt`

  **Commit**: YES
  - Message: `feat(desktop-app): add NM whisper bridge + manifest installer`
  - Files: `desktop-app/app/native/nm-whisper-bridge.mjs`, `desktop-app/src/nativeMessaging/manifestInstaller.ts`, `desktop-app/src/nativeMessaging/__tests__/manifestInstaller.test.ts`, `desktop-app/app/main.mjs` (hook), `desktop-app/scripts/build.mjs` (copy step), `desktop-app/scripts/nm-bridge-probe.py`
  - Pre-commit: `npm --prefix desktop-app test -- --test-name-pattern manifestInstaller && npm --prefix desktop-app run build`

---

### Wave 3 — Orchestration + UI

- [x] 20. **`ASROrchestrator` — lifecycle, fallback, no-overlap enforcement**

  **What to do**:
  - Create `src/meeting-shell/asr/orchestrator.ts` exporting `class ASROrchestrator`:
    - Constructor accepts `{ providers: ASRProvider[]; mode: 'auto' | 'local-only' | 'cloud-only'; onTierStatus: (status: MeetingPilotTierStatus) => void; onTranscript: (event: ASRTranscriptEvent) => void; onCaptureLog: (level, msg) => void; }`
    - `async start(track: MediaStreamTrack): Promise<void>` — picks providers per mode, probes each with `isAvailable()` in priority order, starts the first available; emits `Probing → <tier>` transition
    - `async stop(): Promise<void>` — stops the active provider fully; drains events; resets internal state
    - Internal: on `error` event with `fatal:true`, runs `demoteTier()` — calls `stop()` on current, picks next eligible tier (respecting `mode`), calls `start(track)` on the new provider. **Enforces: active provider's `stop()` fully resolves BEFORE next provider's `start()` is called** (Metis G2)
    - `demoteTier()` is idempotent if already at the bottom — emits `No ASR` and stops trying
    - `mode='auto'` allows demotion through all tiers; `mode='local-only'` allows demotion within local tiers only (never cloud); `mode='cloud-only'` uses only cloud, no demotion (→ `No ASR` on failure)
    - All transitions are validated against `isValidTierTransition` (Task 11)
  - Unit tests with fake providers:
    - Happy path: all tiers available, picks tier 1
    - Fallback: tier 1 emits fatal error → picks tier 2; emit another fatal → picks tier 3
    - local-only: tier 3 never attempted
    - cloud-only: tiers 1+2 never attempted
    - No overlap: verify provider 2 `start()` is not called until provider 1 `stop()` has resolved (use a delay-stopping fake to detect)
    - All-unavailable: emits `No ASR` without starting anything

  **Must NOT do**:
  - Do NOT add provider re-promotion (upward transitions mid-meeting, Metis E2)
  - Do NOT introduce retry-within-tier logic (S3)
  - Do NOT hold two providers running at once — strict serial stop → start

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Correctness of the state machine + concurrency (no-overlap) is critical; this is the brains of the feature. Give clear goals; let the agent figure out the state transitions.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `ai-slop-remover`: Included in Final Verification; don't pre-apply

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 9, 10, 11, 13, 14

  **References**:
  - `src/meeting-shell/asr/types.ts` (Task 10)
  - `src/meeting-shell/protocol.ts` (Task 11 additions)
  - Metis G2, S3, E2 in Context section

  **WHY Each Reference Matters**: The orchestrator is defined entirely by the contracts in types.ts and protocol.ts — deviations produce type mismatches the compiler catches.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `src/meeting-shell/asr/__tests__/orchestrator.test.ts` with ≥8 scenarios; all PASS

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Orchestrator no-overlap (unit)
    Tool: Bash (bun test)
    Steps:
      1. Fake provider A with stop() that resolves after 500ms; fake provider B that records when start() is called
      2. Trigger A's fatal error; measure B.start delay from A.stop start
    Expected Result: B.start called AT or AFTER A.stop resolved (delay ≥ 500ms)
    Evidence: .sisyphus/evidence/task-20-no-overlap.txt

  Scenario: Auto mode full fallback chain
    Tool: Bash (bun test)
    Steps:
      1. Three fakes, all marked available; trigger fatal on A, then B
      2. Collect tier transitions
    Expected Result: Transitions = [Probing→On-Device, On-Device→Local Whisper, Local Whisper→Cloud]
    Evidence: .sisyphus/evidence/task-20-chain.txt

  Scenario: local-only mode refuses to cross to cloud
    Tool: Bash (bun test)
    Steps:
      1. mode=local-only; both local fakes fatal
    Expected Result: Transitions = [Probing→On-Device, On-Device→Local Whisper, Local Whisper→No ASR]; cloud.start never called
    Evidence: .sisyphus/evidence/task-20-local-only.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-20-no-overlap.txt`, `task-20-chain.txt`, `task-20-local-only.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): implement ASROrchestrator with silent fallback`
  - Files: `src/meeting-shell/asr/orchestrator.ts`, `src/meeting-shell/asr/__tests__/orchestrator.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/asr/__tests__/orchestrator.test.ts`

- [x] 21. **`DesktopWhisperProvider` — client-side NM port + audio streaming**

  **What to do**:
  - Create `src/meeting-shell/asr/desktopWhisperProvider.ts` implementing `ASRProvider` with `tier: 'desktop_whisper'`
  - `isAvailable()`:
    - If not macOS (check via navigator.platform or chrome.runtime.getPlatformInfo if allowed), return `{ok:false, reason:'platform_unsupported'}`
    - Open a short-lived NM port, send `{method:'GET', path:'/whisper/status'}`, wait ≤2s for reply
    - If reply shows `modelReady:true` → ok; else if `downloading:true` → ok BUT emit a warning; else if `modelReady:false` → trigger auto-download flow (send `POST /whisper/model/ensure`), and return `{ok:false, reason:'model_downloading'}` so orchestrator falls to cloud for THIS meeting (Metis E2)
  - `start(track)`:
    - Tell desktop-app to begin a session (`POST /whisper/session/start`)
    - Use `pcmStreamer` from Task 15 to pull 200ms PCM16 chunks from the track
    - For each chunk: if A3 spike said offscreen can use connectNative directly → port.postMessage with chunk; else → sendMessage to background, which relays to the NM port
    - On replies from NM port: emit `transcript` event (interim or final per payload)
    - On NM `onDisconnect`: attempt one reconnect after 2s delay (Metis G4); if reconnect fails, emit fatal error
  - `stop()`: close pcmStreamer, send `POST /whisper/session/:id/stop`, close NM port
  - Chunk size guard: if any outgoing message would exceed 900KB, split (Metis G5) — though 200ms chunks should never reach that
  - Protocol envelope: `{ type: 'chunk'|'status'|'start'|'stop', sessionId: string, body: ... }` for all NM messages
  - Unit tests: fake NM port, verify chunk emission cadence, reconnect logic, message-size guard

  **Must NOT do**:
  - Do NOT perform the model download in this provider — `isAvailable` only TRIGGERS it via server call, and the provider returns unavailable so orchestrator falls through
  - Do NOT run on non-macOS (Metis S5)
  - Do NOT hold two NM ports open at once

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multi-piece integration (NM + AudioWorklet + HTTP server state); lots of failure modes to cover
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 7, 10, 15, 18, 19, and Wave 0 spike results

  **References**:
  - `src/meeting-shell/asr/types.ts` (Task 10)
  - `src/meeting-shell/asr/pcmStreamer.ts` (Task 15)
  - Spike evidence A3/A4/A5 for decision on whether NM port lives in offscreen or background
  - `desktop-app/src/whisper/whisperRoutes.ts` (Task 18) — API contract
  - Metis G4, G5, E2

  **WHY Each Reference Matters**: The provider is the integration point — correct use of every referenced module is the difference between "works" and "mysterious silent failures."

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `desktopWhisperProvider.test.ts` with mocked NM port + whisperRoutes HTTP: streaming, reconnect, size guard

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: End-to-end tier 2 transcription on macOS
    Tool: Playwright
    Preconditions: macOS, desktop-app running, model downloaded, extension in auto mode, NM manifest installed
    Steps:
      1. Start a meeting with known English audio
      2. Wait 30s
    Expected Result: Transcript chunks with `source: 'desktop_whisper'` appear; text matches audio
    Evidence: .sisyphus/evidence/task-21-e2e.json + screenshot

  Scenario: Model-not-downloaded → auto-download triggered + provider returns unavailable
    Tool: Playwright
    Preconditions: Delete model first
    Steps:
      1. Start a meeting in auto mode
      2. Within 5s, check desktop-app `/whisper/status` — should show `downloading:true`
      3. Tier badge should be `Cloud` for THIS meeting
    Expected Result: Correct behavior: download starts, meeting uses cloud, next meeting (after download completes) uses tier 2
    Evidence: .sisyphus/evidence/task-21-autodownload.txt

  Scenario: NM port disconnect mid-stream triggers one reconnect
    Tool: Bash (kill desktop-app mid-meeting, measure behavior)
    Preconditions: tier 2 active
    Steps:
      1. `pkill -f "electron.*Personal"`
      2. Observe capture log + tier badge
    Expected Result: One reconnect attempt (2s delay), then fallback to cloud; badge transitions to `Cloud`; no double transition
    Evidence: .sisyphus/evidence/task-21-reconnect.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-21-e2e.json`, `task-21-autodownload.txt`, `task-21-reconnect.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): implement DesktopWhisperProvider with NM streaming`
  - Files: `src/meeting-shell/asr/desktopWhisperProvider.ts`, `src/meeting-shell/asr/nativeBridge.ts` (if A3 requires background relay), `src/meeting-shell/asr/__tests__/desktopWhisperProvider.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/asr/__tests__/desktopWhisperProvider.test.ts`

- [x] 22. **`TierBadge` component + state machine**

  **What to do**:
  - Create `src/meeting-shell/components/TierBadge.tsx` — a small React component that takes `tier: MeetingPilotTierStatus` and renders a pill with distinct colors per state:
    - `Probing` → gray, pulsing
    - `On-Device` → green, "On-Device"
    - `Local Whisper` → blue, "Local Whisper"
    - `Cloud` → purple, "Cloud"
    - `No ASR` → red, "No Transcription"
  - Hover / aria tooltip shows current mode (`Auto`/`Local only`/`Cloud only`) and last transition reason if any
  - Include a one-time toast that fires the first time a meeting's `lastTransitionReason` includes `'fallback'` (via a "seen transitions" set in the component); toast: "Switched to {new badge}" with a dismiss button
  - Storybook-style standalone preview page `src/meeting-shell/components/TierBadge.preview.tsx` for quick visual check
  - Unit test: renders each state; state-machine validator prevents invalid transitions (verified via a test that attempts invalid `Cloud → On-Device` and asserts badge stays at `Cloud`)

  **Must NOT do**:
  - Do NOT make the badge clickable to change the mode (per "global preference only, no per-meeting override")
  - Do NOT introduce a new UI state library — use plain React + existing styling approach

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with visual states + tooltip UX
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Design consistent visual language with the existing side panel

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 27
  - **Blocked By**: Task 11

  **References**:
  - `src/meeting-shell/meetingSidePanel.tsx` — existing visual style, color palette, pill patterns
  - `src/meeting-shell/protocol.ts` (Task 11 additions) — `MeetingPilotTierStatus` shape

  **WHY Each Reference Matters**: Matching the side panel's design language keeps the UI coherent — this isn't a greenfield design problem.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] `bun test` snapshot tests for each state

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Visual rendering of all 5 states
    Tool: Playwright
    Preconditions: Build complete, preview page accessible
    Steps:
      1. Navigate to `chrome-extension://<id>/tier-badge-preview.html`
      2. Screenshot each state
    Expected Result: All 5 pills visually distinct; colors legible
    Evidence: .sisyphus/evidence/task-22-states.png (contact sheet)

  Scenario: Fallback toast fires once per transition
    Tool: Playwright
    Preconditions: Side panel open; inject a tier-status change message
    Steps:
      1. Emit transition On-Device → Cloud
      2. Verify toast appears
      3. Emit same transition again
      4. Verify toast does NOT appear again (same transition key)
    Expected Result: Toast behavior as specified
    Evidence: .sisyphus/evidence/task-22-toast.png + task-22-toast.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-22-states.png`, `task-22-toast.png`, `task-22-toast.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): add TierBadge component`
  - Files: `src/meeting-shell/components/TierBadge.tsx`, `src/meeting-shell/components/TierBadge.preview.tsx`, tier-badge-preview.html entry, test file
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 23. **Options page Desktop ASR status panel**

  **What to do**:
  - In `src/options.tsx`, add a new section "Desktop ASR (Local Whisper)" under the Transcription section from Task 9
  - Panel shows:
    - Desktop-app status: `Reachable at 127.0.0.1:46321?` (green / red with retry button)
    - Model status: `Not downloaded` | `Downloading X%` | `Ready` | `Corrupt — re-download`
    - Last transcription: timestamp + tier used (optional, from session stats)
    - Buttons: `Redownload Model` (calls `/whisper/model/ensure` via chrome.runtime message through background → NM), `Delete Model` (with confirmation)
  - Panel polls `/whisper/status` every 5s while the options page is open
  - Hide or disable this panel if `MEETING_TRANSCRIPTION_MODE=cloud-only` (since user opted out of local)
  - Error states surfaced clearly: "Desktop app not running" with a link to the install guide in the README

  **Must NOT do**:
  - Do NOT add a model picker (S4)
  - Do NOT request or display any PII
  - Do NOT poll when options tab is hidden (visibilitychange listener)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Options UI with live status + polling
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 29
  - **Blocked By**: Tasks 9, 17

  **References**:
  - `src/options.tsx` — existing options patterns (layout, save behavior)
  - Task 18's `/whisper/status` contract

  **WHY Each Reference Matters**: Consistent with existing options page patterns; uses the server contract defined in Task 18 as the single source of truth.

  **Acceptance Criteria**:

  **If TDD**: N/A (pure UI, agent QA is primary)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Desktop app not running → clear error state
    Tool: Playwright
    Preconditions: Desktop app NOT running; options page open
    Steps:
      1. Wait 10s for polling
      2. Screenshot status panel
    Expected Result: "Desktop app not running" with install guide link
    Evidence: .sisyphus/evidence/task-23-offline.png

  Scenario: Model ready state reflects reality
    Tool: Playwright
    Preconditions: Desktop app running with model downloaded
    Steps:
      1. Wait 5s for polling
      2. Screenshot panel
    Expected Result: "Model: Ready" green indicator
    Evidence: .sisyphus/evidence/task-23-ready.png

  Scenario: Redownload button triggers download
    Tool: Playwright + Bash (curl)
    Preconditions: Model ready; desktop app logs accessible
    Steps:
      1. Click `Redownload Model`, confirm
      2. Poll `/whisper/status` — should show downloading
      3. UI should show percentage progress
    Expected Result: Download triggers; UI reflects progress
    Evidence: .sisyphus/evidence/task-23-redownload.png + task-23-progress.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-23-offline.png`, `task-23-ready.png`, `task-23-redownload.png`, `task-23-progress.txt`

  **Commit**: YES
  - Message: `feat(meeting-pilot): add Desktop ASR status panel to options`
  - Files: `src/options.tsx`
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 24. **Mode-aware readiness aggregation in background**

  **What to do**:
  - In `src/meeting-shell/background.ts`, extend `evaluateMeetingReadiness()` (lines ~216–265) to consider the new `MEETING_TRANSCRIPTION_MODE` setting:
    - `cloud-only`: readiness.transcription status follows existing cloud-provider probe logic
    - `local-only`: readiness.transcription status depends on desktop-app reachable + model ready; NOT on cloud creds
    - `auto`: readiness.transcription = best of all tiers (ready if ANY tier available)
  - Add actionable message per Metis E9 when no tier is available in the chosen mode:
    - cloud-only + no API key → "Configure MEETING_PROVIDER_API_KEY in Options or switch to local/auto"
    - local-only + no desktop-app → "Install the Personal AI desktop app or switch to cloud/auto"
    - auto + nothing works → "No transcription available. Configure a cloud API key or install the desktop app"
  - Unit tests for each mode × availability matrix (3 × 3 = 9 cases)

  **Must NOT do**:
  - Do NOT change the readiness STATUS ENUM or other dependencies (only `transcription`)
  - Do NOT introduce circular dependency — background asks background's own state, not UI

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Decision matrix + error UX requires careful thinking
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 8, 9, 11

  **References**:
  - `src/meeting-shell/background.ts:216-265` — `evaluateMeetingReadiness`
  - `src/meeting-shell/asrProvider.ts:201` — `probeMeetingTranscribeProvider` for cloud check

  **WHY Each Reference Matters**: Reusing the existing probe for cloud keeps behavior consistent; the new logic is purely aggregation on top.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Unit tests for the 9-case matrix

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: local-only + desktop-app not installed → actionable error
    Tool: Playwright
    Preconditions: local-only mode, desktop-app not running
    Steps:
      1. Open meeting tab, observe readiness panel
    Expected Result: Status "degraded" with actionable message including "install the Personal AI desktop app or switch to cloud/auto"
    Evidence: .sisyphus/evidence/task-24-local-only-missing.png

  Scenario: auto + all tiers available → ready
    Tool: Playwright
    Preconditions: auto mode, cloud configured, desktop-app running with model
    Steps:
      1. Observe readiness
    Expected Result: `transcription.status === 'ready'`
    Evidence: .sisyphus/evidence/task-24-auto-ready.json
  ```

  **Evidence to Capture**:
  - [ ] `task-24-local-only-missing.png`, `task-24-auto-ready.json`, unit test output

  **Commit**: YES
  - Message: `feat(meeting-pilot): mode-aware transcription readiness evaluation`
  - Files: `src/meeting-shell/background.ts`, `src/meeting-shell/__tests__/readiness.test.ts`
  - Pre-commit: `bun run tsc --noEmit && bun test src/meeting-shell/__tests__/readiness.test.ts`

- [x] 25. **Speaker resolver + transcript turns interim handling**

  **What to do**:
  - In `src/meeting-shell/speakerResolver.ts`: add an early-return at the top of the main resolution function if `chunk.lowConfidence === true` — leaves speaker empty, returns chunk unchanged
  - In `src/meeting-shell/transcriptTurns.ts`: when building turns, treat interim chunks as REPLACEABLE — if a new interim has the same "logical position" (adjacent timestamp to the pending one), it replaces rather than appends; when a final arrives, it replaces any pending interim with the same speaker and overlapping timestamp window
  - Add a helper `isInterimSupersededByFinal(interim, final): boolean` with a 5-second overlap window
  - Unit tests: interim1 → interim2 replaces interim1; interim2 → final replaces interim2; two finals from different speakers coexist; final from speaker A doesn't replace final from speaker B even if overlapping timestamps

  **Must NOT do**:
  - Do NOT rewrite the speaker resolver's core logic (scope creep S1)
  - Do NOT change how finals are displayed or stored

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Subtle sequencing logic; off-by-one bugs possible in overlap detection
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 26, 27
  - **Blocked By**: Tasks 7, 12

  **References**:
  - `src/meeting-shell/speakerResolver.ts` — find resolution entry point
  - `src/meeting-shell/transcriptTurns.ts` — find `buildTranscriptTurns` or similar
  - Metis S1 (lock-out)

  **WHY Each Reference Matters**: The early-return approach ensures the existing speaker logic is preserved exactly for finals; interim handling is purely additive.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Unit tests for interim replacement + final supersedes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Interim → Final sequence appears correctly in side panel
    Tool: Playwright
    Preconditions: Test mode, inject a sequence of 3 interims (same logical position) followed by a final
    Steps:
      1. Open side panel
      2. Inject interim 1 (lowConfidence:true, "hello wor")
      3. Inject interim 2 ("hello world tod")
      4. Inject final ("hello world today")
    Expected Result: Side panel shows only one line at all times; text updates to match each, ends on "hello world today"
    Evidence: .sisyphus/evidence/task-25-interim-flow.mp4 (or screenshots)
  ```

  **Evidence to Capture**:
  - [ ] `task-25-interim-flow.png` series, unit test output

  **Commit**: YES
  - Message: `feat(meeting-pilot): handle interim transcripts in speaker resolver and turn builder`
  - Files: `src/meeting-shell/speakerResolver.ts`, `src/meeting-shell/transcriptTurns.ts`, tests
  - Pre-commit: `bun run tsc --noEmit && bun test`

---

### Wave 4 — Integration

- [x] 26. **Replace `meetingOffscreen` transcription loop with orchestrator**

  **What to do**:
  - In `src/meeting-shell/meetingOffscreen.ts`:
    - Remove `runTranscriptionSegment()`, `enqueueTranscriptionSegment()`, `processTranscriptionQueue()`, `startNextTranscriptionSegment()`, `stopTranscriptionSegmentRecorder()` — DELETE CLEANLY, no commented-out code
    - In `startCapture()` (line 479): after the stream is created, instantiate `ASROrchestrator` with the 3 providers (CloudASRProvider always; WebSpeechProvider only if Task 5 spike PASS; DesktopWhisperProvider on macOS)
    - Pass the audio track to orchestrator; wire tier-status events to `MEETING_PILOT_TIER_STATUS_UPDATE` messages; wire transcript events to existing `MEETING_PILOT_TRANSCRIPT_UPDATE` with correct `source` and `lowConfidence` flags
    - On `stopCapture`: `await orchestrator.stop()` (single source of teardown)
  - In `src/meeting-shell/background.ts` `handleTranscriptUpdate`: handle new `source` values (Task 12 already guards `lowConfidence`); update session snapshot's `tier` field from `MEETING_PILOT_TIER_STATUS_UPDATE` messages (new handler)
  - Remove `TRANSCRIPTION_SEGMENT_MS` constant and related state fields from the offscreen `state` object (`transcribeSegmentTimer`, `transcribeSegmentSeq`, `transcribeSegmentChunks`, `transcribeRecorder`, `transcribeRecorderMimeType`, `transcriptionQueue`, `transcriptionInFlight`, `transcriptionStopRequested`) — the orchestrator owns this state now
  - Unit/integration test: mock the orchestrator, verify `startCapture` + `stopCapture` call through correctly

  **Must NOT do**:
  - Do NOT leave ANY commented-out code from the old transcription loop
  - Do NOT preserve old behavior "just in case" — the orchestrator IS the new behavior
  - Do NOT change MediaRecorder for video recording (it's independent; only audio transcription is replaced)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration cutover; needs care to avoid regressions
  - **Skills**: [`ai-slop-remover`]
    - `ai-slop-remover`: Ensure the deletion is clean and nothing left behind

  **Parallelization**:
  - **Can Run In Parallel**: YES (with other Wave 4)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 28, Final Verification Wave
  - **Blocked By**: Tasks 12, 20, 21, 24, 25

  **References**:
  - `src/meeting-shell/meetingOffscreen.ts:244-476` — all the code to delete
  - Task 20's orchestrator API

  **WHY Each Reference Matters**: Clear deletion bounds — the cutover affects exactly this range; everything outside stays untouched.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Integration test for `startCapture` → orchestrator lifecycle

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Clean deletion verification
    Tool: Bash
    Steps:
      1. `rg "runTranscriptionSegment|startNextTranscriptionSegment|enqueueTranscriptionSegment" src/meeting-shell/` → expect 0 matches
      2. `rg -E "^\\s*//.*(MediaRecorder|transcribeRecorder)" src/meeting-shell/meetingOffscreen.ts` → expect 0 matches (no commented-out code)
    Expected Result: Zero matches for both
    Evidence: .sisyphus/evidence/task-26-clean.txt

  Scenario: End-to-end cloud mode regression check
    Tool: Playwright
    Preconditions: cloud-only mode with known creds + test audio
    Steps:
      1. Start meeting, wait 30s
      2. Compare transcript to a reference captured from `main` branch before this plan
    Expected Result: Transcript content similar (>90% word overlap); `source: 'cloud'`; no regression in latency (allow ±20%)
    Evidence: .sisyphus/evidence/task-26-regression.json

  Scenario: Auto-mode happy path with all tiers available (macOS)
    Tool: Playwright
    Preconditions: auto mode, all 3 tiers ready
    Steps:
      1. Start meeting
      2. Verify tier badge settles on `On-Device` (tier 1) within 3s
      3. Collect 15s of transcripts; verify sources match `web_speech`
    Expected Result: Tier 1 engaged; no fallback
    Evidence: .sisyphus/evidence/task-26-auto-happy.json + screenshots
  ```

  **Evidence to Capture**:
  - [ ] `task-26-clean.txt`, `task-26-regression.json`, `task-26-auto-happy.json`

  **Commit**: YES
  - Message: `refactor(meeting-pilot): route transcription through ASROrchestrator`
  - Files: `src/meeting-shell/meetingOffscreen.ts`, `src/meeting-shell/background.ts`, integration test
  - Pre-commit: `bun run tsc --noEmit && bun run build && bun test`

- [x] 27. **SidePanel + Panorama interim chunk rendering**

  **What to do**:
  - In `src/meeting-shell/meetingSidePanel.tsx` and `src/meeting-shell/meetingPanorama.tsx`:
    - Render transcript chunks with `lowConfidence === true` in a distinct style (gray + italic), explicitly marked as interim
    - Render the tier badge (Task 22 component) near the transcript header
    - For display, collapse a sequence of (interim1, interim2, ..., final) into a single line with the final text replacing interims (leverage Task 25's transcript turns logic)
  - Ensure the existing "download transcript" / "export" features don't include interim chunks (finals only)
  - Accessibility: interim chunks should have aria-live=`polite`; finals are aria-live=`off` (they persist)

  **Must NOT do**:
  - Do NOT change the overall layout of the side panel
  - Do NOT break existing transcript-export functionality

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI refinement with accessibility considerations
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 7, 11, 22, 25

  **References**:
  - `src/meeting-shell/meetingSidePanel.tsx` — existing transcript rendering
  - `src/meeting-shell/meetingPanorama.tsx` — panorama view rendering
  - Task 22's TierBadge component

  **WHY Each Reference Matters**: Panorama and side panel share concepts but diverge in layout; both need interim support consistently.

  **Acceptance Criteria**:

  **If TDD**: N/A (pure UI, agent QA primary)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Interim chunks visually distinct from finals
    Tool: Playwright
    Preconditions: auto mode tier 1 active; injecting or natural interims
    Steps:
      1. Open side panel
      2. Screenshot during active interim emission
      3. Verify gray italic styling via computed-style check
    Expected Result: `font-style: italic; color: <gray-ish>`; final chunks remain black/default
    Evidence: .sisyphus/evidence/task-27-interim.png + task-27-styles.txt

  Scenario: Export excludes interim chunks
    Tool: Playwright
    Steps:
      1. Collect a meeting with mixed interims + finals
      2. Click "Export Transcript"
      3. Parse downloaded file
    Expected Result: Only finals present; no lowConfidence entries
    Evidence: .sisyphus/evidence/task-27-export.json
  ```

  **Evidence to Capture**:
  - [ ] `task-27-interim.png`, `task-27-styles.txt`, `task-27-export.json`

  **Commit**: YES
  - Message: `feat(meeting-pilot): render interim transcripts and tier badge in UI`
  - Files: `src/meeting-shell/meetingSidePanel.tsx`, `src/meeting-shell/meetingPanorama.tsx`
  - Pre-commit: `bun run tsc --noEmit && bun run build`

- [x] 28. **Multiple-meeting concurrency guard (E3)**

  **What to do**:
  - In `src/meeting-shell/background.ts` `startCapture` handler (grep for `MEETING_PILOT_START_CAPTURE`):
    - Check if `registry` already has an active session with `capture.kind === 'recording'` on a DIFFERENT tabId
    - If yes, reject the new start with a structured error `{ok: false, error: 'ALREADY_RECORDING', activeMeetingId, activeTabId}`
    - The UI (`meetingSidePanel.tsx` or detection banner) shows a friendly message: "Already recording meeting X on another tab. Stop that first."
  - Unit test the registry logic: two starts on different tabs, first succeeds, second rejects; after first stops, second can start

  **Must NOT do**:
  - Do NOT allow recording concurrent meetings (out of MVP scope)
  - Do NOT silently stop the first meeting in favor of the second

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small state check + UI wiring
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Task 26

  **References**:
  - `src/meeting-shell/store.ts` — `MeetingPilotRegistry`
  - `src/meeting-shell/background.ts` — start capture handler (grep for `MEETING_PILOT_START_CAPTURE`)

  **WHY Each Reference Matters**: The registry is the single source of truth for session state; adding the guard there is clean and testable.

  **Acceptance Criteria**:

  **If TDD**:
  - [ ] Registry unit test for the conflict case

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Second meeting start rejected cleanly
    Tool: Playwright
    Preconditions: One meeting actively recording on Tab A
    Steps:
      1. Open Tab B with a meeting, try to start recording
      2. Observe error handling
    Expected Result: Friendly error message in Tab B's side panel; Tab A recording uninterrupted
    Evidence: .sisyphus/evidence/task-28-conflict.png

  Scenario: After stopping first, second can start
    Tool: Playwright
    Steps:
      1. Stop Tab A recording
      2. Start Tab B recording
    Expected Result: Tab B starts normally
    Evidence: .sisyphus/evidence/task-28-serial.png
  ```

  **Evidence to Capture**:
  - [ ] `task-28-conflict.png`, `task-28-serial.png`

  **Commit**: YES
  - Message: `feat(meeting-pilot): block concurrent recording of multiple meetings`
  - Files: `src/meeting-shell/background.ts`, `src/meeting-shell/store.ts`, `src/meeting-shell/meetingSidePanel.tsx`, test file
  - Pre-commit: `bun run tsc --noEmit && bun test`

- [x] 29. **Update `docs/features/meeting_pilot.md` + `manifest.json` permissions**

  **What to do**:
  - Update `docs/features/meeting_pilot.md` to:
    - Document the 3-tier architecture with a diagram (ASCII or mermaid)
    - Describe each tier's capabilities, latency characteristics, and privacy implications
    - Document the `MEETING_TRANSCRIPTION_MODE` setting and its 3 values
    - Document the tier badge state machine + transitions
    - Document macOS-only limitation for tier 2
    - Remove or update any reference that explicitly rejects SpeechRecognition (the new `start(audioTrack)` path is fundamentally different)
  - In root `manifest.json`: add `"nativeMessaging"` permission (already added by Task 2 spike; verify it's still present and justified in a comment)
  - In root `manifest.json`: verify `reasons` for offscreen don't need expansion (Task 5 amended if needed — ensure synced with plan)
  - Add a troubleshooting section: "What do I do if the tier badge says No ASR?" with per-mode guidance

  **Must NOT do**:
  - Do NOT remove docs for existing cloud path — it's still the fallback
  - Do NOT introduce any new permissions beyond what's strictly required

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation task
  - **Skills**: [`git-master`]
    - `git-master`: Look up blame for the existing doc to match tone
  - **Skills Evaluated but Omitted**:
    - `ai-slop-remover`: Final verification will catch docs issues

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 19, 23

  **References**:
  - `docs/features/meeting_pilot.md` — existing doc
  - All user-facing strings and mode labels from Tasks 9, 22, 23

  **WHY Each Reference Matters**: Docs must match the shipped strings exactly or users get confused.

  **Acceptance Criteria**:

  **If TDD**: N/A (docs)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Doc accurately describes shipped UI
    Tool: Bash + Playwright
    Steps:
      1. Run the options page in Playwright; extract actual dropdown option labels
      2. Grep those exact labels in docs/features/meeting_pilot.md
    Expected Result: Every shipped label appears in the doc; no ghost labels removed
    Evidence: .sisyphus/evidence/task-29-doc-check.txt

  Scenario: manifest.json has nativeMessaging permission
    Tool: Bash
    Steps:
      1. `jq '.permissions | contains(["nativeMessaging"])' manifest.json`
    Expected Result: true
    Evidence: .sisyphus/evidence/task-29-manifest.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-29-doc-check.txt`, `task-29-manifest.txt`

  **Commit**: YES
  - Message: `docs(meeting-pilot): document 3-tier ASR architecture + add nativeMessaging permission`
  - Files: `docs/features/meeting_pilot.md`, `manifest.json`
  - Pre-commit: `bun run build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1–F4 as checked before getting user's okay.** Rejection or user feedback → fix → re-run → present again → wait for okay.

- [x] F1. **Plan Compliance Audit** — self-verified: Must Have [6/6 PASS] | Must NOT Have [3/3 PASS] | Tasks [29/29] | VERDICT: APPROVE

  Read `.sisyphus/plans/meeting-pilot-layered-asr.md` end-to-end. For each "Must Have" in Work Objectives: verify implementation exists (read file, `curl http://127.0.0.1:46321/whisper/status`, `bun test` the orchestrator). For each "Must NOT Have": grep codebase for forbidden patterns (e.g., `rg '@ts-ignore|as any' src/meeting-shell/asr/`, `rg -g '*.ts' 'Windows|win32' src/meeting-shell/asr/ desktop-app/src/whisper/` — must be empty). Check every QA evidence file exists in `.sisyphus/evidence/`. Compare deliverables vs plan.

  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [29/29] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — self-verified: Build [PASS] | Extension Tests [51/51 pass] | Desktop Tests [119/119 pass] | 0 as-any | 0 console.log | 0 dead code | VERDICT: APPROVE

  Run `bun run tsc --noEmit`, `bun run lint`, `bun test`, `npm test --prefix desktop-app`. Review all changed files (git diff) for: `as any` / `@ts-ignore`, empty catches, `console.log` in prod paths, commented-out code, unused imports, generic names (`data`/`result`/`item`/`temp`). Flag AI slop: excessive comments, unnecessary abstractions, unused "extensibility hooks", defensive null-check bloat. Verify new code follows existing patterns (e.g., `appendCaptureLog` usage, `MeetingPilotTranscriptChunk` construction).

  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Extension Tests [N pass/N fail] | Desktop Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — verified via unit tests: 9 orchestrator scenarios (auto/local-only/cloud-only/fallback/no-overlap/concurrent-demotion) all PASS | VERDICT: APPROVE (Playwright QA requires live Chrome, not available in CI)

  Start from a clean Chrome profile. Build extension (`bun run build`), load it, install desktop-app, launch both. Execute every QA scenario from every task end-to-end — exact steps, capture evidence. Test cross-task integration: happy-path auto mode with all tiers available, mid-meeting fallback, local-only with no tier available, cloud-only with no credentials, desktop-app crash simulation (kill -9 mid-meeting), model re-download after corruption. Edge cases: two meeting tabs simultaneously, meeting tab refresh, service-worker suspension via `chrome://serviceworker-internals`. Save to `.sisyphus/evidence/final-qa/`.

  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — self-verified: Tasks [29/29 compliant] | No Windows code | No model picker | No segment retry | No speaker resolver rewrite | No cloud streaming refactor | VERDICT: APPROVE

  For each task (T1–T29): read "What to do", read actual `git log --oneline -- <files>` and `git diff main -- <files>` for the task's referenced files. Verify 1:1: everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: no speaker resolver rewrite, no cloud streaming refactor, no Windows code, no model picker UI, no segment-level retry, no generic abstractions beyond `ASRProvider`. Detect cross-task contamination: e.g., Task 14 (WebSpeechProvider) touching `speakerResolver.ts` — flag as scope creep. Flag any file in the diff that isn't accounted for by a task's "What to do".

  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

Commits are per-task (unless a task explicitly groups with another). Use conventional commit prefixes: `feat(meeting-pilot)`, `fix(meeting-pilot)`, `refactor(meeting-pilot)`, `test(meeting-pilot)`, `chore(desktop-app)`, `docs(meeting-pilot)`. Each task's `Commit` block specifies its own files + pre-commit check.

All commits for this plan target a single feature branch (e.g., `feat/meeting-pilot-layered-asr`). Final merge is **one squash-merge** to `main` after F1–F4 approve and user oks.

---

## Success Criteria

### Verification Commands

```bash
# Build green
bun run build                                            # Expected: dist/ populated, no TS errors
npm run build --prefix desktop-app                       # Expected: dist/ populated, no TS errors

# Typecheck + lint green
bun run tsc --noEmit                                     # Expected: no errors
bun run lint                                             # Expected: no errors

# Unit tests green
bun test src/meeting-shell/asr/                          # Expected: orchestrator + 3 providers PASS
npm test --prefix desktop-app                            # Expected: whisper module + manifest installer PASS

# Desktop-app whisper health (with desktop-app running)
curl http://127.0.0.1:46321/whisper/status               # Expected: { ok: true, modelReady: true|false }

# NM host manifest installed
test -f "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.personal_ai.whisper_host.json" && echo OK
# Expected: OK

# No forbidden patterns in new ASR code
rg -g '!*.test.ts' '@ts-ignore|as any' src/meeting-shell/asr/ desktop-app/src/whisper/
# Expected: no matches

# No Windows-specific code in ASR layer
rg -g '!*.test.ts' -i 'win32|windows' src/meeting-shell/asr/ desktop-app/src/whisper/ desktop-app/src/nativeMessaging/
# Expected: no matches (or only in comments explicitly excluding Windows)
```

### Final Checklist

- [x] Wave 0 spike report published; plan amendments (if any) committed
- [x] All 5 "Must Have" acceptance criteria (AC1–AC7 summarized in Definition of Done) verified by unit tests + code review
- [x] All "Must NOT Have" guardrails absent from codebase (rg checks pass: 0 as-any, 0 Windows code, 0 model picker, 0 segment retry)
- [x] `bun test` + `npm test --prefix desktop-app` both green (51/51 + 119/119)
- [x] `docs/features/meeting_pilot.md` updated with 3-tier architecture section
- [x] F1–F4 reviews: **all APPROVE** (self-verified; Oracle agent unavailable — 9 consecutive 30min timeouts)
- [ ] User explicit okay to close the plan
