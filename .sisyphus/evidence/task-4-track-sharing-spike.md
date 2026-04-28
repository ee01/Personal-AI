# Wave 0 Spike A5: Shared MediaStreamTrack

**Date**: 2026-04-24
**Method**: Codebase analysis + Web Audio specification research

## Verdict: PASS (shared track works; clone recommended as defense)

## Evidence

### Existing Production Proof (2-consumer case)

`meetingOffscreen.ts` already uses the same `stream` for:

1. `MediaRecorder` (line 564): `new MediaRecorder(stream, { mimeType })`
2. `AudioContext.createMediaStreamSource` (line 535): `audioCtx.createMediaStreamSource(stream)`

This proves the 2-consumer case works in production today.

### Web Audio Specification

- `MediaStreamTrack` can be consumed by multiple `MediaStreamSource` nodes
- `MediaRecorder` and `AudioContext` can share the same `MediaStream`
- Web Audio spec explicitly allows multiple consumers

### 3rd Consumer Analysis

Adding a 3rd consumer (AudioWorklet or SpeechRecognition):

- AudioWorklet: Connected via `AudioContext.createMediaStreamSource(stream)` → same pattern as existing
- SpeechRecognition: `recognition.start(audioTrack)` - new API, behavior with shared track unknown

### Recommendation

- Use `track.clone()` for each consumer as defensive measure
- Prevents any potential exclusive-access issues
- Small overhead (clone is lightweight)

## Implication for Task 21 (DesktopWhisperProvider)

- Create a cloned track for the AudioWorklet PCM extractor
- Original track stays with MediaRecorder (existing behavior preserved)
- Pattern: `const pcmTrack = audioTrack.clone()` before passing to AudioWorklet
