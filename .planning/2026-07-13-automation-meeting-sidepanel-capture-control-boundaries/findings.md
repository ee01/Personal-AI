# Findings

## Repo

- `docs/progressing/to-verify.md` is empty.
- `docs/features/meeting_pilot.md` already documents broad side panel action-review and capture receipts.
- `src/meeting-shell/meetingSidePanel.tsx` already has button-level boundaries for tabs, action filters, action item controls, cue-to-action, manual add, copy, and bulk confirm.
- The capture-start card primary buttons and footer `.panel-status-action` button still lacked matching `title` / `aria-label` boundaries even though those controls can open config, show the popup authorization guide, or stop Capture.

## Reminder

- AppleScript list enumeration did not expose `Personal AI`.
- EventKit found `Personal AI` and reported total 4 / incomplete 0 / completed 4.
- No Reminder item is available to incorporate or complete.

## External References

- Zoom AI Companion Meeting Summary: host/co-host start/stop and participant active indication make capture/summary state visible.
- Zoom AI Companion Meeting Questions: preset questions include catch-up, name-mentioned, and action-item queries, supporting low-friction side panel recovery paths.
- Microsoft Teams Facilitator: real-time notes, decisions/open questions, agenda timers, and task sync are explicit meeting surfaces.
- Otter Action Items: action items expose transcript provenance and make edit/copy/reassign/delete consequences explicit.
- `Meeting Action Item Detection with Regularized Context Modeling`: action-item detection depends on local and global transcript context, supporting explicit review/evidence boundaries before task follow-up.
