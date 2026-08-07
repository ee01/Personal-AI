# Today Pilot Meeting Prep Refresh Receipt Findings

## Selection

- Random target from `docs/index.md`: `会前准备`.
- Capability: Today Pilot.
- Source document: `docs/features/today_pilot.md`.
- Reminder scan returned `NO_PERSONAL_AI_LIST`; no related local Reminder items can be marked done.
- Worktree is already broadly dirty. Keep edits scoped to Today Pilot meeting-prep files, verifiers, docs, this planning directory, and automation memory.

## Code And UX Findings

- `docs/features/today_pilot.md` is broadly current for meeting prep: it documents pre-generated/backfill meeting prep, calendar-only/fallback evidence boundaries, Video Home injection, and Meeting Pilot handoff semantics.
- Core backend path is `memory-service/src/core/TodayPilotMeetingPrepService.ts`; it supports cached resolve, on-demand generation, deterministic fallback, evidence refs, cue cards, and Storyline opportunity gating.
- Video Home path is `src/contentScriptRingCentralVideoHome.ts`; it requests cached prep on load with `autoGenerate:false`, triggers `prepareMeetingPrepBackfill()` on manual refresh, then resolves again and persists a local `meetingPrepHandoff`.
- Existing UI shows `会前准备回执` for the final prep and a local handoff boundary, but it does not preserve a manual refresh result. After a user clicks refresh, they cannot tell whether the click read a cached prep, generated a new prep, skipped recurring/noisy meetings, or failed backfill but still displayed an old/pre-existing prep.
- Existing verifier `tools/verify-today-pilot-video-home.ts` is a good lightweight gate for this surface.

## External Reference Findings

- Microsoft Copilot meeting prep places prep inside the meeting event and supports deeper follow-up chat about action items or goals.
- Microsoft Sales Copilot meeting prep exposes requirements, limitations, fallback scenarios, and matching/data-retention behavior. This supports making generation and fallback scope visible.
- Zoom AI Companion summary docs separate host/admin enablement, generated meeting assets, participant access, edit/delete, and sharing. This supports keeping Today Pilot refresh/backfill separate from joining, recording, sharing, or external write effects.
- AI-powered collaborative reminder research describes meeting/task support as prospective-memory aid and emphasizes time/event cues, cognitive load, and metacognitive feedback. This supports a post-click receipt that helps users calibrate what the reminder/prep system just did.

## Implementation Direction

Add a route-scoped `refreshReceipt` state to the Video Home injected card. Manual refresh should set a pending receipt, update it with prepare/backfill counts and resolve source, render it just below the existing prep receipt, and clear it when the selected meeting or route changes.
