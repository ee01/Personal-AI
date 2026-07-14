# Findings

## Repo

- `docs/progressing/to-verify.md` has no carry-over items.
- Recent automation memory covered Jira Design Links, Task Scheduler, Quick Ask voice, Topic Messages, Coverage Map, Jira Automation Import, and User Profile export. Compose Assist direct insert is a viable non-fresh random target.
- `docs/features/compose_assist.md` already documents direct insert, undo, stale draft checks, readonly failure, Rehearsal review, keyboard dwell calibration, and surface-specific feedback.
- Current direct-insert E2E covers stale silent draft changes, selected-range replacement when selection survives, readonly failure, high-risk review, undo, and feedback.

## UX Gap

- When a high-risk or review-required suggestion opens the review controls, the user may confirm insertion from a button that has focus.
- For contenteditable composers, `insertTextIntoComposer()` falls back to the live document selection, then appends at the end if the selection is no longer inside the composer.
- This can turn an intended selected-text replacement into an append, even though the user never changed the draft.

## Reminders

- AppleScript listed local reminder lists but did not show `Personal AI`.
- EventKit found `Personal AI` with four items.
- All four items were already completed historical Doubao / Weekly Dream Digest / sync feedback. None related to Compose Assist direct insert, so no Reminder item should be marked done.

## External Scan

- Gmail Smart Compose is low-friction and user-controlled; personalized suggestions are private to the account and can be disabled.
- Microsoft Copilot in Outlook generates a draft for review, then lets the user keep it or adjust tone/length before send.
- RingCentral AI writing tools draft or improve messages while the user remains in the send flow.
- Atlassian Intelligence/Rovo drafts Jira descriptions/comments and JSM replies from similar past work, but still places the user in the reply/comment surface.
- Interaction-Required Suggestions argues for human involvement and fine-grained control in co-writing interfaces.

## Implication

The constructive improvement is not a bigger review panel. It is preserving the user's editing intent during the smallest existing control handoff: original selected range -> review/confirm -> insert into the same selected range.

