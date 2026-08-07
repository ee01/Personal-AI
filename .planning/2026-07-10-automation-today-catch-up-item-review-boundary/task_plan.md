# Today Pilot Catch-up Item Review Boundary

## Target

- Feature: `高压后补课` under Today Pilot.
- Source doc: `docs/features/today_pilot.md`.
- Selected from the randomized `docs/index.md` sample after `docs/progressing/to-verify.md` was empty and recent exact automation targets were avoided.

## Current State

- The homepage catch-up block already shows a read-only `补课回执`, failure state, and waiting/high-priority overlap de-duplication.
- Each catch-up item is clickable, but the control itself does not explain that the click only opens Memory Search for source review.
- `navigateToCatchUpItem()` currently routes to `/search?q=...` with title/preview text only, so the destination has no explicit catch-up review context.

## External Signals

- Google Meet and Zoom catch-up flows frame missed-content summaries as review aids with host/consent/availability limits, not as automatic source handling.
- Microsoft Viva Briefing and AI reminder research emphasize missed commitments, requests, and meeting prep, while notification/interruption studies argue for low-interruption batching.
- Applied here: Today Pilot catch-up should keep the item-level action as a low-risk source-review handoff and make the no-read/no-reply/no-write boundary visible at the actual click point.

## Reminder State

- AppleScript listed Reminder lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No Reminder item is related to Today Pilot catch-up, missed-message review, or source handoff; nothing will be marked done.

## Implementation Plan

1. Add item-level hover/ARIA copy for catch-up cards that names the source, snapshot window, destination, and no-side-effect boundary.
2. Pass a lightweight `source=today_pilot_catch_up` query flag when opening Memory Search, so the route itself carries review context without changing backend behavior.
3. Update the Today Pilot static verifier and Playwright E2E to assert the item-level boundary and route context.
4. Update `docs/features/today_pilot.md` and the `docs/index.md` row concisely.
5. Verify with `npm run verify:day-pilot-home`, `npm start` first successful compile, `npm run verify:today-pilot-home:e2e`, and scoped `git diff --check`.
