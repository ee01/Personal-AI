# Findings: Snooze Menu Marker Cache Receipt

## Repo State

- `docs/progressing/to-verify.md` says there are no carry-over verification items.
- Automation memory shows recent exact targets included Jira Design Links, Topic mute, Project Dashboard, Agent Workflow, Relationship Radar, and Task Scheduler, so this run avoided those exact surfaces.
- The current worktree is broadly dirty before this run. This run should only own Message Reaction Snooze quick-menu cache-freshness changes, related tests/docs, the active plan pointer, and this planning directory.
- EventKit found the `Personal AI` Reminders list with 4 total items and 0 incomplete items. None are related to Message Reaction, Snooze, Remind, RingCentral message deferral, or Scheduled Messages recovery.

## Product / Research Scan

- Gmail Snooze temporarily removes an email from the inbox and returns it at the chosen time. This supports making the destination and return time concrete before a Snooze action.
- Slack lets users save messages/files for Later or set reminders from a message/file, with saved items visible in one place. This supports a visible management/recovery path from the quick menu.
- Slack reminders can be created from message/file overflow actions with a chosen preset or custom time. This supports quick presets plus custom time.
- The MobileHCI 2018 `Snooze!` notification-deferral paper studied user-defined deferral by duration or specific point in time, supporting short presets and concrete time previews.

## UX Gap

- The quick menu already shows an existing same-source Snooze and the new target time, but its `缓存口径` line only says it comes from a local marker snapshot.
- The marker cache already has `updatedAt` and the marker badge uses fresh/stale/unknown state. The quick-menu reschedule receipt should reuse that truth so a stale local marker does not look like a confirmed live Snooze queue state.

## Implementation Notes

- Extend `SnoozeQuickMenuMarkerCache` to include `updatedAt`.
- Return cache state from `getExistingSnoozeMarkerForQuickMenu`.
- Add a presentation helper for `fresh`, `stale`, and `unknown` cache states in `snoozeQuickMenuPresentation.ts`.
- Thread the cache basis into `buildSnoozeQuickMenuReceipt`.
- Update E2E to assert the stale marker menu states the local snapshot may be stale and remains subordinate to Scheduled Messages/background sync.
