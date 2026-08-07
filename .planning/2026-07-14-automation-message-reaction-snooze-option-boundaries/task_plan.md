# Message Reaction Snooze Option Boundaries

## Scope

- Selected feature: `Snooze 快速时间菜单` in `docs/index.md`.
- Canonical doc: `docs/features/message_reaction.md`.
- Runtime surface: RingCentral message hover toolbar Snooze quick menu.
- Reminder check: EventKit found the local `Personal AI` list with 4 total items and 0 incomplete items, so no Reminder item is included or marked done.

## External Scan

- Gmail Snooze makes the chosen return time explicit and keeps a Snoozed recovery view.
- Slack Later keeps saved/reminded items in In progress, supports custom reminder times, and lets users complete, archive, or edit reminders from one place.
- Microsoft To Do exposes reminder choices like later today, tomorrow, next week, or custom date/time.
- Weber et al. MobileHCI 2018 found notification snoozing needs both predefined durations and user-defined points in time; it also stresses history/recovery because deferred notifications remain ephemeral and can create a second interruption.

## Improvement Plan

1. Add per-control boundary labels for each quick time item so the focused/clicked menuitem says whether it will create a new Snooze or reschedule the same-source Snooze.
2. Add control-level labels for `自定义...` and `管理稍后处理`, distinguishing picker navigation and filtered Scheduled Messages navigation from actual reminder writes/deletes/completion.
3. Keep the fix presentation/accessibility-only: no change to quick option time calculation, Google Sheet writes, Background dedupe, marker cache lookup, Toast behavior, or Scheduled Messages semantics.
4. Update docs/index concisely to say the menuitem itself carries the boundary, not only the top receipt.
5. Verify with focused Message Reaction unit tests, first successful `npm start` compile, real extension E2E for the toolbar, and scoped `git diff --check`.

