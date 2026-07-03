# Relationship Radar Context Card Improvement Plan

Goal: improve the selected `人脉关系 Context Card` feature by checking current docs/code, incorporating external product and research references, adding a scoped low-decision UX/code improvement, and validating it end to end.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Restore repo instructions, automation memory, stale root planning context, feature index, dirty worktree state, and local Reminders list state |
| 2 | completed | Inspect Relationship Radar docs, Context Card implementation, tests, and current user journey |
| 3 | completed | Search current product and research references for relationship/person context cards and trust calibration |
| 4 | completed | Lock the concrete improvement slice and update this plan before editing runtime files |
| 5 | completed | Implement the selected code/docs/UX change while preserving unrelated dirty files |
| 6 | completed | Run targeted verification, dev compile, and smallest relevant E2E/browser proof |
| 7 | completed | Update automation memory, attempt archive only with a real mechanism, and summarize outcome |

## Decisions

- Selected feature: `人脉关系 Context Card`.
- Source doc: `docs/features/relationship_radar.md`.
- Local Reminders list scan found no visible `Personal AI` list, so no Reminder feedback can be incorporated or marked done in this run.
- Existing dirty worktree is broad and unrelated. Keep edits scoped to Relationship Radar plus this planning/automation bookkeeping.
- Selected implementation slice: preserve the last Context Card on same-person refresh failure, show a scoped `上下文卡刷新失败回执`, and revert the sensitive-inclusion toggle if the include-sensitive refresh did not actually succeed.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` is stale from a June 4 Scheduled Messages run | Planning restore | Read it for recovery as required, then created this isolated `.planning` directory for the current run |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not mark any Reminder items done |
