# Message Analysis Manual Rule Improvement Plan

Goal: improve the selected `手动关注项规则` feature by checking current code/doc accuracy, using product and paper references to tighten the UX shape, implementing one scoped low-decision improvement, and validating it with the repo harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, repo instructions, feature index, `to-verify`, Reminders state, and selected feature doc |
| 2 | completed | Inspect Message Analysis manual-rule runtime, rule page UI, diagnostics, existing verifiers, and current dirty worktree |
| 3 | completed | Search current product/docs and paper references for trigger/condition/action rule UX and alerting |
| 4 | completed | Lock the concrete improvement plan and write findings before editing |
| 5 | completed | Implement the selected code/docs/test changes while preserving unrelated dirty files |
| 6 | completed | Run targeted runtime/UI verification, first successful `npm start` compile, E2E, and `git diff --check` |
| 7 | completed | Update automation memory, note Reminder status, and summarize outcome |

## Decisions

- Selected feature: `手动关注项规则` under Message Analysis.
- Source doc: `docs/features/message_analysis.md`.
- No carry-over: `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders are accessible, but there is no `Personal AI` list, so no Reminder feedback can be incorporated or marked done.
- Existing worktree is broadly dirty. Keep edits scoped to Message Analysis manual-rule UI/presentation, verifier, feature doc, and this planning folder.
- Implementation slice: add an explicit side-effect/boundary receipt for manual rules so users can see whether a match only stores memory, sends/digests, creates auto replies, delegates linked actions, and where recovery/audit happens.

## Plan

1. Add a shared `getRuleEffectBoundaryReceipt(...)` helper beside existing safety/delivery helpers.
2. Render the receipt on rule cards and in new/edit save previews.
3. Extend the Message Analysis E2E fixture to assert memory-only, digest, auto-reply, and linked-action boundary copy.
4. Update `docs/features/message_analysis.md` with a short current-behavior note rather than implementation detail.
5. Validate with targeted helper/E2E, `npm start`, and diff checks.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| No `Personal AI` Reminder list | AppleScript list scan | Record absence and skip Reminder completion |
| Root `task_plan.md` already belongs to an older Scheduled Messages run | Planning setup | Use an isolated `.planning/2026-06-09-automation-message-analysis-manual-rules/` plan instead of overwriting root files |
