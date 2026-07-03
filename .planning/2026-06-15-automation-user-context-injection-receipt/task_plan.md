# User Context Injection Improvement Plan

Goal: improve the selected `用户上下文注入` feature in Prompt Config by checking the current docs/code, incorporating external product/research signals, implementing one bounded UX/code improvement that needs no extra user decision, updating the canonical feature doc, and validating it.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory state, feature index, workflow memory, existing planning files, git status, and Reminders list state |
| 2 | completed | Inspect Prompt Config docs, user-context injection code paths, and existing targeted verifiers/E2E |
| 3 | completed | Research comparable product and paper references for context injection, memory/profile disclosure, and editable prompt context |
| 4 | completed | Write the concrete improvement plan before editing |
| 5 | completed | Implement the scoped code/docs/UX change while preserving unrelated dirty worktree changes |
| 6 | completed | Run targeted verification, dev compile, feature-relevant E2E/browser proof where practical, and diff checks |
| 7 | completed | Update automation memory, Reminder state if applicable, and archive/close the run |

## Decisions

- Selected feature: `用户上下文注入`.
- Source doc: `docs/features/custom_prompts.md`.
- Capability family: Prompt Config.
- Local Reminders are reachable, but the list names do not include `Personal AI`; no Reminder item can be incorporated or marked done in this run.
- The worktree has broad pre-existing dirty changes. Only touch files directly owned by this Prompt Config slice plus this `.planning` directory and automation memory.
- Chosen implementation slice: make user-context tab receipts aware of the active preview scope so the tab itself says whether its signals enter the current `全部 / 消息 / 项目` injection preview.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Missing `$CODEX_HOME/automations/automation/memory.md` | Initial automation-memory read | Treat as absent for this automation id and create the file before the final response |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and skip Reminder item completion |
| Root `task_plan.md` is stale Scheduled Messages data | Planning skill restore step | Use a fresh isolated `.planning/2026-06-15-automation-user-context-injection-receipt/` plan instead |
| No callable Codex archive tool exposed | Current session archive request | Located current session file but did not manually move it while active; report archive tooling as unavailable |
| `git diff --check` rejects automation memory path | Final scoped check included `/Users/Esone/.codex/...` outside repo | Rerun git check for repo files only and scan automation memory separately |
