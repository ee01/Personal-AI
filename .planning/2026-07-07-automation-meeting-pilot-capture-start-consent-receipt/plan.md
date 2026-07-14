# Meeting Pilot Capture start consent receipt

## Scope

- Selected feature: `Meeting Pilot 捕获` from `docs/features/index.md`.
- Source doc: `docs/features/meeting_pilot.md`.
- Reminder state: EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. All items are completed historical Doubao / Notification / test feedback, so no Reminder item is related to Meeting Pilot Capture or will be marked done in this run.

## External scan

- Zoom AI Companion starts meeting summaries from explicit host/co-host controls and uses speech-to-text data for summaries: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013
- Microsoft Teams Intelligent Recap depends on transcription and recording policies; when recording is off, recap loses recording/speaker/topic/chapter coverage: https://learn.microsoft.com/en-us/microsoftteams/intelligent-recap-calls-meetings
- Otter's recording-permission flow requires participants to accept recording before entering a Teams meeting when that policy is enabled: https://help.otter.ai/hc/en-us/articles/39339238308503-Recording-Permissions-with-Otter
- AI meeting-assistant guidance and research discussion consistently emphasize transparency, consent, user control, and not treating capture as an invisible background action.

## UX finding

Meeting Pilot already has a side-panel Capture handoff receipt, and the background correctly preserves startup errors instead of pretending to record. The remaining gap is the main popup button: while `MEETING_PILOT_ENABLE_CAPTURE_AND_OPEN_PANEL` is pending, the UI only says `处理中` / `正在开启`, so a user cannot tell whether this is only a local Chrome tab-capture request, whether participants have been notified, or whether recording is already confirmed.

## Plan

1. Add a popup-level pending receipt before sending the Capture start request.
2. Keep the receipt explicit: pending does not confirm recording, does not notify participants, does not send meeting content, does not create minutes, does not write external tasks, and does not represent participant consent.
3. Reuse the same boundary in start failure paths and side-panel Capture handoff copy so the first screen stays honest after popup closes or fails.
4. Extend Meeting Pilot runtime/E2E checks to assert the new popup pending receipt and side-panel participant-notice boundary.
5. Update concise feature docs and index text.

## Validation target

- `node --check desktop-app/scripts/meeting-pilot-scene1-check.mjs`
- `node --check desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs`
- `npm start -- --progress` until first successful compile, then stop
- `npm run test:meeting-pilot-scene1`
- `npm --prefix desktop-app run test:meeting-pilot-scene2`
- scoped `git diff --check`
