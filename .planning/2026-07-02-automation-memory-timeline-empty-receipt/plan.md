# Memory Timeline Empty Result Receipt Plan

## Target

- Feature: `记忆时间轴` under Memory Exploring.
- Source doc: `docs/memory_system.md`.
- Main UI: `src/modals/components/TimelinePage.vue`.
- Presentation helper: `src/modals/timelinePresentation.ts`.

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Random sample initially included `Storyline Draft 页面`, but automation memory showed Storyline Draft was a recent exact target, so this run switched to `记忆时间轴`.
- AppleScript listed local Reminder lists without `Personal AI`; EventKit did see `Personal AI`, but all 4 items are completed and about Doubao / notification sync rather than Memory Timeline.
- External scan: Microsoft Recall exposes timeline segments, app/site filtering, local snapshot/privacy controls, and delete/pause boundaries; SenseCam / lifelogging and THEANINE timeline-memory research reinforce that personal memory retrieval depends on time, source/context, and recovery cues near the result surface.
  - https://support.microsoft.com/en-us/windows/ai/ai-features/retrace-your-steps-with-recall
  - https://support.microsoft.com/en-US/Windows/privacy/privacy-and-control-over-your-recall-experience
  - https://www.microsoft.com/en-us/research/publication/do-life-logging-technologies-support-memory-for-the-past-an-experimental-study-using-sensecam/
  - https://arxiv.org/abs/2406.10996

## UX Gap

The Timeline page already distinguishes safe links, source coverage, focused targets, feedback status, refreshing snapshots, and failed refreshes. The remaining gap is the empty state:

- A successful `/recall` response with `0` items looks similar to a generic absence message.
- Users cannot immediately tell whether the empty state means successful-empty, failed fetch, deletion, index clearing, feedback write, or source sync.
- Source-filtered empty states need the same local-only boundary if a stale or future source filter ever hides every loaded row.

## Implementation Plan

1. Add `buildTimelineEmptyReceipt()` in `timelinePresentation.ts`.
2. Render `时间轴空结果回执` inside the empty Timeline state.
3. Distinguish full successful-empty from source-filter-empty:
   - full empty: successful `/recall`, 0 visible and 0 loaded rows.
   - source-filter empty: loaded rows exist, current source filter shows 0.
4. State non-effects explicitly: no deletion, no index clearing, no feedback write, no source sync, no read marking.
5. Keep existing recall, sorting, source filtering, feedback, and open-link behavior unchanged.
6. Update `docs/memory_system.md`.
7. Extend `verify-memory-timeline.ts` and `verify-memory-timeline-e2e.mjs`.

## Verification

- `npm run verify:memory-timeline`
- `node --check tools/verify-memory-timeline-e2e.mjs`
- `npm start -- --progress`, stop after first successful compile.
- `npm run verify:memory-timeline:e2e`
- Scoped `git diff --check`.
