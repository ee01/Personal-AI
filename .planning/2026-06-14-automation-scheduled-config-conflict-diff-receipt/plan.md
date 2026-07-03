# Scheduled Messages Config Conflict Diff Receipt

## Target

- Randomly selected feature: `定时消息配置同步` in `docs/features/scheduled_messages_manager.md`.
- Reminder check: local Reminders is readable, but no `Personal AI` list exists, so no Reminder item can be incorporated or marked done.
- Current run started around `2026-06-14T23:03:42+08:00`.

## Research Notes

- Google Apps Script installable triggers run under the creator account, are quota-bound, and time-driven triggers can be minute-level but slightly randomized. The Scheduled Messages UI should keep trigger ownership, freshness, and recovery state visible.
- Zapier App Connections exposes connection status, last modified time, ownership, and reconnect/test actions. For Config sync, a conflict receipt should show enough field-level evidence to decide the next recovery action.
- Power Automate connections expose fix/status/details paths, including which apps and flows use a connection. Config sync should similarly name which source is active and what differs.
- Trigger-action debugging research shows users often need history, fault localization, and patch previews to recover automations; a conflict banner with only field names leaves the fault localization step too thin.

## Improvement Plan

1. Keep the current conflict safety contract: equal/unknown freshness with key differences must not auto-overwrite Sheet or local Config.
2. Reuse the existing sanitized diff model from manual binding to show up to three `本机` vs `Sheet` examples in the manual sync banner, with secrets still masked.
3. Make Config sync detail chips wrap long URLs and labels without overflowing compact Scheduled Messages headers.
4. Extend the config-sync E2E to force a same-timestamp conflict during manual sync and verify the diff preview plus unchanged local cache.
5. Update the canonical feature doc to describe the same-freshness conflict preview.
6. Validate with the scheduled config sync E2E, dev compile, and scoped whitespace checks.
