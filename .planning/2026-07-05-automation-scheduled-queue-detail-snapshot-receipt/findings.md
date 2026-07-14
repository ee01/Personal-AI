# Findings

## Repo

- Target feature: `队列可视化与改期建议` in `docs/features/scheduled_messages_manager.md`.
- Existing behavior: queue summary is compact by default; detail expansion shows slot basis, front-of-queue examples, and reschedule actions.
- UX gap: detail expansion does not first state snapshot scope or no-side-effect boundaries.

## Reminders

- AppleScript list enumeration did not show `Personal AI`.
- EventKit read succeeded and found `Personal AI` with 4 total items.
- All items are completed historical Doubao / Notification feedback; none are related to Scheduled Messages queue visualization or reschedule suggestions.

## External Scan

- Slack scheduled-message APIs expose scheduled message IDs, listability, limits, and deletion before send.
- Twilio message scheduling exposes `scheduled` status and status fetching; later delivery state is separate from successful scheduling.
- Microsoft Power Automate troubleshooting starts from run history and failed-step context.
- TAP debugging research highlights timing and expectation bugs; users need explicit why / why-not and action-boundary explanations.
