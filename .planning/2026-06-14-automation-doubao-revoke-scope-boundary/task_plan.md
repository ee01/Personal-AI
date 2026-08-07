# Doubao Bridge Revoke Scope Boundary Plan

Goal: improve the selected `豆包互联 / Doubao Bridge` feature by checking current docs and code, grounding the UX in current product/research references, then implementing one bounded trust-boundary improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, `AGENT.md`, memory loop guidance, `docs/progressing/to-verify.md`, feature index, worktree state, and Reminders list state |
| 2 | completed | Randomly select the feature and inspect `docs/features/doubao_bridge.md`, Desktop App Explorer source-card code, and existing verifier |
| 3 | completed | Search current product/research references for AI memory controls, import/export, provenance, and deletion boundaries |
| 4 | completed | Implement a small revoke-scope boundary receipt near the Explorer revoke controls |
| 5 | completed | Update the feature doc and E2E assertions for the new user-visible boundary |
| 6 | completed | Run targeted Desktop App E2E, first successful `npm start` compile, and scoped diff checks |
| 7 | completed | Update automation memory, archive the current Codex session where possible, and summarize outcome |

## Decisions

- Selected feature: `豆包互联` under Doubao Bridge from `docs/index.md`.
- Source doc: `docs/features/doubao_bridge.md`.
- Target UX gap: the Explorer `撤回已入库记忆` action is privacy-sensitive and scope-sensitive, but the near-control UI does not explain why the button is disabled or that the action only affects the current saved default scope while leaving the other scope and remote chat untouched.
- Implementation slice: add a concise per-source revoke boundary receipt/status beside the revoke button. It should name Memory Service readiness, source running state, current saved scope, local artifact count, legacy unscoped audit count, and the non-effect on remote chat / other scopes.
- Reminder state: local Reminders are readable, but there is no visible `Personal AI` list. No Reminder item can be incorporated or marked done.
- Worktree state: broad pre-existing dirty worktree. Keep edits scoped to Desktop App source-card UI, its verifier, the Doubao Bridge feature doc, this planning directory, automation memory, and the active plan pointer.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `CODEX_HOME` unset | Initial automation-memory read expanded to an empty base | Used `/Users/Esone/.codex/automations/automation/memory.md` as the Codex home fallback |
| No visible `Personal AI` Reminders list | AppleScript list scan | Recorded absence and stopped the Reminder branch |
| Stale root `task_plan.md` and stale `.planning/.active_plan` | Planning restore | Created this isolated planning directory and will update the active plan pointer |
