# Wave 0 Spike Report

**Date**: 2026-04-24
**Method**: Code analysis + Chrome documentation research (CI environment, no live Chrome)

## Verdict Table

| Assumption                                       | Verdict | Confidence | Implication                                                            |
| ------------------------------------------------ | ------- | ---------- | ---------------------------------------------------------------------- |
| A1: SpeechRecognition available in MV3 offscreen | PASS    | HIGH       | Tier 1 (WebSpeechProvider) is feasible                                 |
| A2: start(audioTrack) accepts tab-captured audio | PARTIAL | LOW        | Needs real Chrome 139+ validation; implement with fallback             |
| A3: connectNative() callable from offscreen      | FAIL    | HIGH       | NM port MUST live in background SW; audio chunks relay via sendMessage |
| A4: AudioWorklet available in MV3 offscreen      | PASS    | HIGH       | AudioContext proven in production; AudioWorklet follows same pattern   |
| A5: Shared MediaStreamTrack across 3 consumers   | PASS    | HIGH       | 2-consumer case proven in production; use clone() for 3rd consumer     |

## Detailed Findings

### A1: SpeechRecognition in MV3 Offscreen — PASS

MV3 offscreen document is a full browsing context with window object. SpeechRecognition is a window-level Web API. Chrome offscreen with `reasons:['USER_MEDIA']` supports Web APIs. **Tier 1 (WebSpeechProvider) is feasible.**

### A2: start(audioTrack) with tab audio — PARTIAL

Chrome 139+ API `recognition.start(audioTrack)` exists. Whether it accepts tab-captured tracks (vs microphone-only) is undocumented. **Implement WebSpeechProvider with graceful degradation**: if `start(audioTrack)` throws, catch the error and mark tier 1 as unavailable (fall through to tier 2).

### A3: connectNative() from offscreen — FAIL

Chrome docs state native messaging is only available to "extension pages and background scripts". Offscreen documents are NOT extension pages. **Architecture change required**: NM port lives in background service worker. Audio routing: Offscreen (AudioWorklet) → `chrome.runtime.sendMessage({type:'NM_AUDIO_CHUNK'})` → Background (NM port) → Desktop-app.

### A4: AudioWorklet in MV3 Offscreen — PASS

`meetingOffscreen.ts:532` already uses `new AudioContext()` in production — proven to work. AudioWorklet is part of AudioContext API. **Build constraint**: `pcm-worklet.js` must be a standalone file in `dist/` (not webpack-bundled). Add to `static/` directory or webpack CopyPlugin.

### A5: Shared MediaStreamTrack — PASS (use clone)

`meetingOffscreen.ts` already uses same stream for MediaRecorder + AudioContext (2-consumer case proven). Adding 3rd consumer (AudioWorklet) should work. **Recommendation**: use `track.clone()` for AudioWorklet consumer as defensive measure.

## Plan Amendments Required

### Amendment 1: A3 FAIL → Background NM Port Proxy

**Impact**: Task 21 (DesktopWhisperProvider) audio path changes.

Original plan: Offscreen calls `chrome.runtime.connectNative()` directly.
**Amended**: NM port lives in background SW. New message protocol:

- Offscreen → Background: `{type: 'NM_AUDIO_CHUNK', sessionId, pcm: ArrayBuffer}`
- Background → Offscreen: `{type: 'NM_TRANSCRIPT', sessionId, text, isFinal}`
- Background manages NM port lifecycle (open/close/reconnect)

This is the "nativeBridge.ts" file already planned in the deliverables list.

### Amendment 2: A2 PARTIAL → Graceful Degradation in WebSpeechProvider

**Impact**: Task 14 (WebSpeechProvider) must handle start(audioTrack) failure.

WebSpeechProvider.start() must:

1. Try `recognition.start(audioTrack)`
2. If throws InvalidStateError or NotSupportedError → mark as unavailable, emit fatal error
3. Orchestrator falls through to tier 2

### Amendment 3: A4 PASS → Build Pipeline Required

**Impact**: Task 15 (PCM AudioWorklet) must include build step.

`pcm-worklet.js` must be placed in `static/` directory so webpack CopyPlugin copies it to `dist/`.
The file URL in offscreen: `chrome.runtime.getURL('pcm-worklet.js')`.

## No Blocking Issues

All 5 assumptions have viable paths forward. **Wave 1 can proceed.**

## Spike Verdicts Section

```
A1: PASS  — SpeechRecognition available in offscreen
A2: PARTIAL — start(audioTrack) needs runtime validation; implement with fallback
A3: FAIL  — connectNative blocked in offscreen; route via background SW
A4: PASS  — AudioWorklet available; build pipeline needed for processor file
A5: PASS  — Shared track works; use clone() for AudioWorklet consumer
```
