# Findings & Decisions

## Requirements
- Read feature list, randomly pick one feature, inspect docs/code, do external research, check Reminders, write a plan, implement narrowly, update docs, verify as fully as practical.
- Chosen feature: `定时消息配置同步` under Scheduled Messages, source doc `docs/features/scheduled_messages_manager.md`.
- `docs/progressing/to-verify.md` has no carry-over work.
- Reminders: AppleScript list enumeration did not show `Personal AI`; EventKit found 4 `Personal AI` reminders, all already completed and focused on Doubao / notification sync, not this feature.

## Research Findings
- Automation memory shows several fresh July 1 exact-focus sweeps; avoided Task Scheduler, Meeting Pilot alert freshness, Scheduled compensation window, Message Analysis empty export, Memory Search safe link diagnostics, and similar same-day targets.
- `refreshConfigFromSheetForManualSync()` sets a visible Config-stage notice after reading Sheet Config and deciding Sheet newer / local newer / conflict / same / read failure.
- `handleSync()` then calls `loadMessages(nextService)`. `loadMessages()` catches failures and returns `[]`, so a Messages refresh failure can leave the prior Config-stage notice visible.
- UX gap: the user can see "Config 已是最新" or "已从 Sheet Config 刷新本机配置" even if the actual Messages/Logs refresh failed after that Config step.
- Airtable sync troubleshooting emphasizes visible source, permissions/source-change checks, manual sync, and last-success context: https://support.airtable.com/docs/troubleshooting-syncs-in-airtable
- Zapier troubleshooting separates run statuses, affected steps, logs, errors, and recovery/replay paths: https://help.zapier.com/hc/en-us/articles/8496037690637-How-to-troubleshoot-errors-in-Zap-workflows
- Power Automate run-history docs make status transitions and "no further actions executed" boundaries explicit: https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit
- Huang & Cakmak 2015 shows trigger-action systems cause mental-model errors when state/event/action differences are hidden; UI should clarify what happened and what did not: https://hcrlab.cs.washington.edu/publications/huang2015ubicomp/

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Preserve existing Config read/write/storage behavior | The current Sheet-first contract is correct and documented. |
| Return lightweight Config-stage metadata from manual sync refresh | Allows final receipt to say which config source was adopted without parsing visible copy. |
| Track foreground message load errors with a ref | Minimizes changes to `loadMessages()` callers while distinguishing failed read from legitimate empty Messages. |
| Override phase notice after foreground `loadMessages()` | The final user-visible state should describe the whole manual sync, not just the first phase. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `shuf` unavailable | Used Perl random sampler. |
| Reminders APIs disagreed | Treated EventKit as authoritative for `Personal AI`; no open or relevant items to complete. |

## Resources
- `src/scheduled-messages/ScheduledMessagesManager.tsx`
- `tools/verify-scheduled-messages-config-sync-e2e.mjs`
- `docs/features/scheduled_messages_manager.md`
