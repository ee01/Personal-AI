# Scheduled Messages CRUD submit guard plan

## Target

Feature sampled from `docs/index.md`: `定时消息创建/编辑/删除` under Scheduled Messages.

## Context checked

- `AGENT.md` validation policy.
- `docs/features/scheduled_messages_manager.md`.
- Current Scheduled Messages CRUD implementation and `verify-scheduled-messages-crud-focus-e2e.mjs`.
- Local Reminders lists. No `Personal AI` list is visible on this machine.
- External product references: Slack scheduled messages, Microsoft Teams scheduled messages, Google Chat scheduled messages.
- Research references: trigger-action programming mental-model accuracy and end-user debugging papers.

## Constructive direction

1. Keep scheduled messages as visible managed objects: create, edit, reschedule, delete, and return-to-list paths should stay first-class.
2. Treat repeated or conflicting automation actions as reliability issues that should be prevented at creation time when possible.
3. Prefer direct in-context recovery and confirmation over extra review queues.

## Implementation plan

1. Add an in-flight guard around Scheduled Messages create/update submit handling so duplicate submit events cannot create duplicate Sheet rows.
2. Extend the CRUD E2E to submit the same new-message form twice and assert only one append reaches Google Sheets.
3. Update the feature doc with the latest user-facing behavior.
4. Run focused Scheduled Messages E2E, dev extension compile, and diff checks.

