# OpenClaw Delegation Improvement Plan

Goal: improve the randomly selected `OpenClaw 外部委派` feature by confirming docs match code, using current product/research references, fixing the smallest clear UX/code issue, and validating the action-queue path end to end where practical.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, repo rules, feature index, existing planning context, and local Reminder list state |
| 2 | completed | Inspect OpenClaw delegation docs, Action Queue UI, backend execution policy, tests, and dirty worktree scope |
| 3 | completed | Search current comparable product docs and research about agent delegation, HITL, tool results, and external action auditability |
| 4 | completed | Choose the smallest no-extra-decision improvement and record the implementation plan before edits |
| 5 | completed | Implement scoped code/docs/test changes without reverting unrelated dirty work |
| 6 | completed | Run targeted backend/UI verification, first successful `npm start` compile, relevant E2E, and scoped `git diff --check` |
| 7 | completed | Update automation memory, handle Reminder completion if applicable, archive the Codex thread, and summarize outcome |

## Decisions

- Selected feature: `OpenClaw 外部委派` under Memory Service.
- Source doc: `docs/features/memory_system.md`; index row: `docs/features/index.md`.
- Local Reminders is reachable but has no `Personal AI` list, so no Reminder item can be incorporated or marked done in this run.
- The worktree is broadly dirty. This run must stay scoped to OpenClaw delegation/action-queue files, docs, verification helpers, this planning directory, and automation memory.

## Implementation Plan

- Improve the `人工确认` panel for `delegate_openclaw` actions in `src/modals/components/ActionQueue.vue`.
- Add OpenClaw-specific approval copy that separates human approval from external completion proof.
- Add approval facts for mode, target system, and result contract: approved execution still needs artifact / transcript / queue status to prove the external result.
- Update `tools/verify-action-queue-e2e.mjs` to exercise a write-bearing OpenClaw approval card and assert the new pre-click approval boundary.
- Update `docs/features/memory_system.md` to keep the OpenClaw delegation doc current without over-detailing implementation.

## Errors Encountered

| Error | Resolution |
| --- | --- |
| First Action Queue E2E rerun timed out waiting for `/execute` response | The click locator still used the old approval-card title; updated it to `更新生产部署状态` and reran successfully |
