# Message Analysis Entry Rules Improvement Plan

Goal: improve the randomly selected `记忆入口规则` feature by checking that the current docs match code, incorporating current product/research references, identifying a low-decision UX/code improvement, implementing it, and verifying it with the strongest practical harness.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, feature index, existing planning state, dirty worktree, and Reminders list state |
| 2 | completed | Inspect Message Analysis docs, entry-rule code paths, tests, and current UX gaps |
| 3 | completed | Search current product and research references for rule authoring, trigger-action transparency, and notification/action boundaries |
| 4 | completed | Write the concrete improvement plan and choose the smallest no-extra-decision implementation slice |
| 5 | completed | Implement scoped code/docs/UX changes while preserving unrelated dirty files |
| 6 | completed | Run targeted tests, dev extension compile, and relevant E2E verification |
| 7 | in_progress | Update automation memory, handle Reminder completion if applicable, and archive the Codex thread if tooling is available |

## Decisions

- Selected feature: `记忆入口规则` under Message Analysis.
- Source doc: `docs/features/message_analysis.md`.
- Reminder state: local Reminders is reachable but does not contain a `Personal AI` list, so no Reminder item can be incorporated or marked done in this run.
- Recent automation targets were filtered out before random selection to avoid immediately revisiting freshly touched feature families.
- The worktree is broadly dirty from prior/user/automation work. Edits must remain scoped to this target and must not revert unrelated changes.
- Selected implementation slice: add a pre-click manual analysis scope receipt above `立即分析最近 ... 小时消息`, because that command can read current RingCentral messages and trigger memory writes, notifications, summaries, auto-reply, follow-thread, or RuntimeAction planning according to matched rules.
- Verification target: extend `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`, run Message Analysis runtime verifiers, run `npm start` until first successful compile, then path-scoped `git diff --check`.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` belongs to an older Scheduled Messages run | Initial planning restore | Use isolated `.planning/2026-06-19-automation-message-analysis-entry-rules/` files for this run |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder completion |
| E2E exact header assertion expected `2.1 小时` | First `tools/verify-message-analysis-rule-diagnostics-e2e.mjs` rerun | Inspected rendered receipt; dev config used `0.1 小时`, so the verifier now asserts the stable window label and rule count instead of a hardcoded hour value |
