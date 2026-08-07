# Meeting Pilot Handoff Live Refresh Plan

## Goal

Improve `Meeting Pilot handoff` so an already-open Meeting Pilot side panel refreshes its Today Pilot meeting-prep context when the local handoff candidate collection changes, not only when the legacy single handoff key changes.

## Selected Feature

- Feature: `Meeting Pilot handoff`
- Capability: Today Pilot / Meeting Pilot
- Source docs: `docs/features/today_pilot.md`, `docs/features/meeting_pilot.md`
- Random selection note: chosen from a randomized `docs/index.md` sample after excluding the freshest exact Memory Service, Memory Lens, Jira Import, Skill Foundry, Rehearsal, Topic, and Scheduled Messages targets.

## Findings

- `MeetingSidePanel` loads both `meetingPrepHandoff` and `meetingPrepHandoffs` when it mounts.
- The storage-change listener only watched `meetingPrepHandoff`, so collection-only refreshes could leave the currently open side panel showing an older selected handoff until reload.
- This is a user-visible handoff freshness issue: Today Pilot refresh can update the candidate collection while Meeting Pilot is already open.
- Reminders: AppleScript did not list `Personal AI`, but EventKit did; all 4 items were completed Doubao / notification / test feedback and unrelated to Meeting Pilot handoff.

## External Scan

- Microsoft Teams Copilot and Facilitator expose meeting summaries, action items, agenda support, and task sync as meeting-scoped state rather than silent global automation.
- Zoom AI Companion exposes in-meeting question prompts such as catch-up, mentions, and action items, reinforcing the need for current meeting context inside the meeting panel.
- Meeting action-item research emphasizes local and global meeting context; stale or mismatched handoff context can turn a useful prompt into misleading action guidance.
- CHI 2025 goal-reflection work emphasizes user control, timing, and intervention intensity; this supports live-refreshing the local context while preserving visible no-write boundaries.

## Plan

1. [complete] Inspect docs, code, Reminder state, automation memory, and external product/research references.
2. [complete] Update `MeetingSidePanel` to resync when either the single handoff key or the handoff collection key changes.
3. [complete] Extend Scene 1 E2E to update only `meetingPrepHandoffs` and require the open side panel to show the refreshed goal, match receipt, and evidence link.
4. [complete] Update Today Pilot / Meeting Pilot docs and feature index to document the live collection-refresh boundary.
5. [complete] Run targeted syntax, dev compile, Scene 1 E2E, Today Pilot / Video Home checks, i18n, and scoped whitespace checks.

## Verification

- `node --check desktop-app/scripts/meeting-pilot-scene1-check.mjs` passed.
- `npm start -- --progress` reached first successful webpack dev compile and was stopped.
- `npm run test:meeting-pilot-scene1` passed, including the new collection-only handoff refresh assertion.
- `npm run verify:day-pilot-home` passed.
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-today-pilot-video-home.ts` passed.
- `npm run verify:i18n` passed.
- Scoped `git diff --check` passed.
