# Findings & Decisions

## Requirements
- Pick one random feature from `docs/features/index.md`.
- Keep the corresponding feature doc current but not overly detailed.
- Search current product and paper references for comparable patterns.
- Implement low-decision incomplete/improvement work, then update docs and verify as fully as practical.
- Check local Reminders list `Personal AI` and complete related items only if the list exists and was used.

## Research Findings
- `docs/progressing/to-verify.md` is empty, so this is a fresh random feature pass.
- Random target: `队列可视化与改期建议` under Scheduled Messages, source doc `docs/features/scheduled_messages_manager.md`.
- Local Reminders list names are readable, but there is no visible `Personal AI` list. No Reminder feedback was incorporated or completed.
- The current feature doc is mostly current for queue health / queue suggestions: it describes same-slot congestion, 08:00 after-queue semantics, one-click reschedule, success/failure receipts, and the pre-click write boundary.
- Current implementation anchors: `src/scheduled-messages/scheduleQueuePressure.ts`, `src/scheduled-messages/ScheduledMessagesManager.tsx`, `src/scheduled-messages/__tests__/scheduleQueuePressure.test.ts`, and `tools/verify-scheduled-messages-queue-suggestion-e2e.mjs`.
- UX gap: queue cards explain the target/time/boundary, but `ScheduleQueueSuggestion` does not carry a reason. The success receipt can say what changed, yet cannot preserve why that specific message/time was recommended unless the user remembers the queue card.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a concise `reason` field to `ScheduleQueueSuggestion` | Keeps card, button title, E2E, and success receipt aligned on why this target/time was chosen |
| Keep the reason deterministic in `scheduleQueuePressure.ts` | Avoids rebuilding queue reasoning ad hoc in the React component |
| Verify with helper test + dev compile + queue suggestion E2E | The change spans shared queue logic and user-visible extension UI |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `web.open` failed for search result ids | Opened source URLs directly instead |

## Resources
- Slack scheduled-message docs model scheduled messages as managed objects; updating requires deleting the old scheduled message and scheduling a new one.
- Twilio scheduled-message docs distinguish scheduled creation, send-time failures, and cancellation state.
- Zapier troubleshooting docs expose run statuses, Zap history, logs, and replay/autoreplay recovery.
- Brackenbury et al. 2019, "How Users Interpret Bugs in Trigger-Action Programming", identifies timing-related and expectation-related trigger-action bugs.
