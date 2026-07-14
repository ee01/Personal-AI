# Meeting Pilot Side Panel Capture Control Boundaries

## Target

- Feature: `会中 side panel` in `docs/features/index.md`
- Canonical doc: `docs/features/meeting_pilot.md`
- Main surface: `src/meeting-shell/meetingSidePanel.tsx`
- Scope: capture-start card and sticky footer Capture/settings button boundaries.

## Reminder Check

- AppleScript did not list `Personal AI`.
- EventKit found `Personal AI` with 4 total items, 0 incomplete items, and 4 completed items.
- No live Reminder item was related to Meeting Pilot side panel capture controls, so nothing will be marked done.

## External Scan

- Zoom AI Companion exposes host start/stop, participant active indication, and summary/transcript consequences.
- Microsoft Teams Facilitator exposes real-time notes, agenda/timer/task surfaces, and explicit follow-up task sync.
- Otter action items expose transcript provenance, edit/copy/reassign/delete consequences, and irreversible delete warnings.
- Action-item detection research emphasizes local/global transcript context, so side panel controls should keep review and external-task boundaries explicit.

## Plan

1. Add a reusable Meeting Pilot side panel capture-control boundary helper.
2. Apply it to the capture-start card primary button and sticky footer action button.
3. Keep runtime behavior unchanged: no capture, ASR, archive, action-item, or external write logic changes.
4. Extend existing Meeting Pilot E2E checks to assert recording and not-yet-started button boundaries.
5. Update `docs/features/meeting_pilot.md` and the `会中 side panel` index row concisely.
6. Validate with syntax checks, targeted Meeting Pilot checks, first successful `npm start` compile, E2E, and scoped `git diff --check`.

## Status

- [x] Target selected and duplicate existing action-boundary work avoided.
- [x] Reminder and external scan completed.
- [x] Code patched.
- [x] Docs updated.
- [x] Tests updated.
- [x] Verification completed.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Existing untracked `meeting-sidepanel-action-boundaries` plan already covered action controls | Initial selected slice | Narrowed to capture-start/footer controls instead of overwriting prior work |
