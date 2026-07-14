# Meeting History Panorama List Snapshot Plan

## Target

- Feature: `会议历史归档` in `docs/features/meeting_pilot.md`
- UI path: `memory-exploring.html#/meetings` -> `打开 Panorama`

## Current Gap

- The history list card already shows a summary plus topic / action item / decision counts.
- When the user opens Panorama, the page asks memory-service for full archive detail.
- If that detail request fails, Panorama falls back to URL parameters, but those parameters currently only carry title, time, participants, and Digest/PDF state.
- The fallback is honest, but thinner than the card the user just trusted.

## External Signal

- Teams recap, Zoom AI Companion summaries, and Otter meeting summaries all keep post-meeting assets such as recording, transcript, summary, and action items visible as separate materials.
- Meeting recap research also supports providing both quick highlights and structured minutes, with clear caveats around missing details and misattribution.

## Plan

1. Pass the list-card summary and structure counts from Meeting History to Panorama as read-only URL snapshot fields.
2. Parse those fields in Panorama and use the real card summary as the fallback summary.
3. Update the archive-source receipt so fallback clearly says which data came from the list snapshot and which full details are still missing.
4. Extend the history and panorama E2E scripts to prove the snapshot is passed, rendered, and bounded.
5. Update the Meeting Pilot feature doc with the current behavior.

## Non-Goals

- Do not change memory-service archive APIs.
- Do not synthesize fake action item rows, decisions, or timeline events from counts.
- Do not retry, regenerate PDF, send notes, or write back to Memory Service from this path.
