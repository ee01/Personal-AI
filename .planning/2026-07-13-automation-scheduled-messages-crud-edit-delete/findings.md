# Scheduled Messages CRUD Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `定时消息创建/编辑/删除`.
- Capability: Scheduled Messages.
- Source document: `docs/features/scheduled_messages_manager.md`.
- Current scope is create/edit/delete rows backed by the Messages sheet and corresponding user-visible CRUD boundaries.

## Code And UX Findings

- `docs/features/scheduled_messages_manager.md` is broadly current for row-level create/edit/delete behavior: save success focuses the saved row, delete success clears a focused deleted row, duplicate submit is guarded, and row edit/delete buttons already have title/ARIA boundaries.
- Main implementation files are `src/scheduled-messages/ScheduledMessagesManager.tsx` and `src/scheduled-messages/ScheduledMessageService.ts`.
- Existing E2E coverage is `tools/verify-scheduled-messages-crud-focus-e2e.mjs`, which already validates duplicate create submit, edit save, delete confirmation, focused-row cleanup, and row-level button boundaries.
- UX gap: inside the AI Report create/edit dialog, custom output section buttons labeled `编辑`, `删除`, and `添加自定义版块` mutate only the local form draft before the outer message is saved. They currently lack pre-click boundaries and post-action receipts, so `删除` can be mistaken for deleting a saved Messages row or writing the Sheet immediately.

## Reminder Findings

- AppleScript did not list `Personal AI`, but EventKit did.
- EventKit result: `Personal AI` exists, 4 total reminders, 0 incomplete reminders.
- No Reminder feedback is related to Scheduled Messages CRUD in this run, so nothing should be marked complete.

## External Reference Findings

- Slack's scheduled-message UX exposes scheduled items through `Drafts & sent` and lets users edit/delete scheduled entries before sending, supporting a clear distinction between draft/scheduled objects and sent messages.
- Microsoft Teams scheduled channel messages can be edited, rescheduled, or deleted before posting, reinforcing that pre-send scheduled objects need explicit per-action affordances.
- Gmail Schedule Send cancels a scheduled email back into a draft, which supports preserving recoverability and clear draft-vs-send copy.
- Trigger-action debugging research emphasizes that users struggle to connect automation edits with later runtime effects; visible action consequences and state boundaries are useful even for small nested controls.
