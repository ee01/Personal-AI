# Findings

## Repo State

- `AGENT.md` requires targeted tests, `npm start` first successful compile, then an E2E proof for user-visible extension UI changes.
- `docs/progressing/to-verify.md` has no carry-over items.
- The worktree is already broadly dirty from prior runs; this run should only touch Scheduled Messages config-sync files and this planning directory.
- Reminders is reachable, but the local list names do not include `Personal AI`; no Reminder item can be tied to this run.

## Current Implementation

- `ScheduledMessagesManager.tsx` already performs manual sync as: set running receipt -> read Sheet Config -> maybe write newer Sheet Config to local cache -> load Messages -> maybe recover worksheet IDs by writing Config Sheet first.
- The final success/conflict/failure receipts are explicit, but the initial running receipt only says it will read Sheet Config and will not immediately send or start a second sync.
- The button is disabled while `isSyncingConfig` is true, and `syncConfigInFlightRef` also protects against repeated handler calls.

## External References

- Airtable Sync documentation emphasizes source/destination and expected sync behavior, supporting visible source/adoption boundaries.
- Zapier troubleshooting and replay docs keep run state, errored steps, and replay/recovery paths visible.
- Power Automate run history/resubmit docs separate selecting a past run from actual resubmit/cancel execution.
- Google Sheets API `values.update` requires a `valueInputOption`; this feature already uses `RAW` to preserve config strings.
- Trigger-action debugging research shows end users need help understanding where an automation failed and what a recovery action actually does.

## UX Decision

During manual sync, show a running receipt that explicitly says adoption has not been decided yet. This prevents the user from reading a spinner as "Sheet has been applied" or "sync wrote something" before the Sheet Config read resolves.
