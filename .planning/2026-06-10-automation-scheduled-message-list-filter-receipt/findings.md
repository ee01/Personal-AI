# Findings & Decisions

## Requirements
- Keep `docs/features/scheduled_messages_manager.md` aligned with current code.
- Include web/product and research context.
- Implement a bounded improvement that needs little user decision.
- Validate per `AGENT.md` with focused tests, dev build, E2E when runtime UI changes.

## Research Findings
- Slack scheduled-message docs emphasize listing/deleting scheduled messages on demand instead of requiring apps to maintain hidden state.
- Power Automate and Zapier position run/task history as a troubleshooting surface with status and failure context.
- Notification deferral research supports visible snooze/filter state and clear recovery because hidden deferral can become a missed-task risk.
- Interruption and batching research supports keeping routine reminders in lower-interruption queues, but only if users can inspect what is deferred or hidden.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Put the receipt helper in `scheduledMessagesFilters.ts` | Existing query parsing and view filtering already live there, and unit tests can cover edge cases without UI setup. |
| Show receipt only for active list filters, not normal all-message list | Avoid cluttering the default operational table. |
| Warn when self-only filtering lacks `currentUsername` | The checkbox is otherwise misleading because it cannot match the current user. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| No `Personal AI` Reminders list exists locally | No Reminder items incorporated or marked done. |

## Resources
- Slack scheduled messages docs
- Power Automate flow troubleshooting docs
- Zapier Zap history docs
- Snooze notification deferral and notification interruption papers
