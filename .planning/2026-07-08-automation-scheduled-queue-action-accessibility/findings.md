# Findings

## Repository State

- Current worktree is broadly dirty from previous automation sweeps and unrelated work. This run should own only the Scheduled Messages queue accessibility changes, matching E2E/docs updates, the new planning directory, and automation memory update.
- `docs/progressing/to-verify.md` has no carry-over work.

## Reminder State

- AppleScript list enumeration did not include `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No Reminder item is open or related to Scheduled Messages, queue pressure, reschedule suggestions, Google Sheet writeback, or executor recovery.

## UX Gap

- The queue detail card correctly explains suggestions and write boundaries, but `定位最晚` and `编辑` are generic in accessible names.
- This makes keyboard and assistive-tech use weaker than mouse use: the card title contains context, but the individual actions do not.

## Implementation Direction

- Add deterministic button labels/titles derived from the existing slot summary data.
- Labels should name the target message, queue lane, target position, and the action boundary.
- E2E should assert the labels and that clicking draft suggestion still has no Sheet write before save.
