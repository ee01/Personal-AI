# Findings

## Repo

- `docs/progressing/to-verify.md` says there is no carry-over item.
- Random eligible sample included `Rehearsal 管理页`; selected it while avoiding the freshest exact targets from automation memory.
- `docs/features/rehearsal.md` is current and already describes list scope receipts, empty-filter receipts, deep-link recovery, cue editor receipts, and action receipts.
- `src/modals/components/RehearsalsPage.vue` implements those receipts, but the actual status/search/refresh/load-more/recovery/cue-editor controls are still weakly labeled compared with the documented boundary.
- `tools/verify-rehearsals-page-e2e.mjs` already covers Rehearsal list/detail/action semantics and is the right E2E surface to extend.

## Reminders

- AppleScript listed local Reminder lists but did not expose `Personal AI`.
- Swift/EventKit found the `Personal AI` list with 4 total items and 0 incomplete items.
- All found items are completed historical Doubao/Notification feedback, so no Rehearsal item was incorporated or marked done.

## External Scan

- Apple Reminders Smart Lists expose filter scope across tags, dates, locations, flags, and priority; Rehearsal filters should similarly say they change the visible/read slice, not state.
- ChatGPT Scheduled Tasks documents paused-task review plus resume/edit/delete management from a Scheduled page; Rehearsal management controls should separate review/filter from status-changing actions.
- Digital-reminder research argues many future intentions cannot be captured by time/place alone; Rehearsal's cue set and visible cue-strength receipts are aligned with that.
- Implementation-intention and prospective-memory work emphasizes cue-action binding; Rehearsal controls should keep "cue/script review" separate from execution or external writeback.

## Sources

- Apple Reminders Smart Lists: https://support.apple.com/guide/iphone/use-smart-lists-iphe882772ed/ios
- ChatGPT Scheduled Tasks: https://help.openai.com/en/articles/10291617-tasks-in-chatgpt
- Exploring Possibilities for Digital Reminder Systems: https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf
- Implementation intentions / prospective memory: https://link.springer.com/article/10.3758/MC.36.4.716
