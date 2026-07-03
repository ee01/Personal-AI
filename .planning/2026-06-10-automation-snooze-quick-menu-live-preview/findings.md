# Findings

## Repo State

- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders listed several lists but no `Personal AI` list, so no reminder feedback items were available for this run.
- The worktree was already broadly dirty before this run. Keep changes scoped to Snooze quick-menu files and this isolated planning directory.

## Product/Research Notes

- Slack Later keeps saved items and reminders in one visible place and supports returning to a message later.
- Gmail Snooze temporarily removes mail and brings it back at the chosen time.
- Mobile notification snooze research describes user-defined deferral as a way to postpone interruptions to a chosen future moment; short delays and precise future times are core to the behavior.
- Prospective-memory reminder research supports reminders as an external cue; user trust depends on the chosen cue time being clear and reliable.

## Code Notes

- `showSnoozeQuickMenu()` builds quick options once and renders `timeLabel`/`aria-label` at menu-open time.
- Each quick option's `getTime()` uses a live `clock()` and is called again at click time, so the actual write is fresh.
- That creates a possible mismatch after a long-open menu: visible preview and screen-reader label can be stale while the scheduled time is current.

