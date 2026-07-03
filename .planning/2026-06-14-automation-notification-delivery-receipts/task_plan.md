# Notification Center Channel Delivery Receipts Plan

Goal: improve the `渠道投递回执` feature by confirming docs and code match, using current product/research references, fixing one low-decision UX gap, updating canonical docs, and validating through the repo harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, repo workflow, feature index, to-verify state, existing plan context, and local Reminders |
| 2 | completed | Inspect Notification Center docs, delivery-receipt code, UI rendering, tests, and current dirty scope |
| 3 | completed | Search product and paper references for notification delivery receipts, status transparency, and recovery UX |
| 4 | completed | Decide the smallest implementation slice and record the plan before edits |
| 5 | completed | Implement focused code/docs/test changes without reverting unrelated work |
| 6 | completed | Run targeted verification, dev build, and whitespace checks |
| 7 | completed | Update automation memory and summarize outcome |

## Decisions

- Selected feature: `渠道投递回执` in Notification Center.
- Source doc: `docs/features/notification_center.md`.
- `docs/progressing/to-verify.md` is empty, so there is no carry-over verification task.
- The local Reminders app is accessible but has no visible list named `Personal AI`; no Reminder item can be incorporated or marked done.
- The worktree is broadly dirty from other runs. Keep edits scoped to Notification Center, its verifiers/tests, this planning directory, and automation memory.
- Current implementation already keeps per-channel delivery state, `effectiveStatus`, todo cooldown, and cross-channel digest hints. The likely improvement is to make failed cross-channel hints carry the failure detail/boundary instead of only the compact status label.
- Implementation slice: enrich Provider/Doubao markdown digest cross-channel hints when another channel has a failed latest receipt. The hint should include the channel error and, when there was a prior successful/terminal effective status, say that the effective state did not roll back. Do not alter feed filtering, cooldown, delivery writeback, or Chrome OS notification compact context.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` unset in shell | Initial automation-memory read | Used the normal fallback path `/Users/Esone/.codex/automations/automation/memory.md` for current run history and final memory update |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark Reminder items complete |
