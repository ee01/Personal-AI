# Outreach Session Receipt Improvement Plan

Goal: improve the selected `主动询问 / 主动询问会话管理` feature from `docs/index.md` by checking current docs and code, grounding the UX decision in current product/research references, implementing one bounded low-decision improvement, and validating it through the strongest practical targeted checks.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read repo instructions, automation memory, memory guidance, `to-verify`, feature index, Reminders list state, and dirty worktree state |
| 2 | completed | Inspect Outreach docs, service/UI code, tests, and current behavior gaps |
| 3 | completed | Search current product and paper references for proactive agent/outreach transparency patterns |
| 4 | completed | Lock a concrete implementation plan with source/scope/freshness/recovery boundaries |
| 5 | completed | Implement code/docs/test changes without reverting unrelated dirty files |
| 6 | completed | Run targeted tests, dev compile, E2E/browser proof when practical, and `git diff --check` |
| 7 | completed | Update automation memory, handle Reminders if applicable, archive session if possible, and summarize |

## Initial Decisions

- Selected feature family: `主动询问` / `主动询问会话管理`.
- Source doc: `docs/memory_system.md`.
- Reminder branch: local Reminders is reachable but has no visible `Personal AI` list, so no Reminder items can be incorporated or marked done unless a later probe finds one.
- Worktree is broadly dirty before this run. Only touch files needed for the Outreach improvement and this planning/automation bookkeeping.
- Implementation slice: add a `计划推进回执` to `待触发计划` template cards. It should say the plan has not sent yet, what timing/target/sync state gates the next session, and where to recover or inspect prior runs.
- Validation target: extend `tools/verify-outreach-sessions-e2e.mjs` with a future synced template fixture and assertions for the new receipt, then run the Outreach E2E, dev compile, and path-scoped whitespace check.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` is unset in shell | Initial automation-memory read | Used `/Users/Esone/.codex/automations/automation/memory.md` as the normal Codex home fallback |
| No visible `Personal AI` Reminders list | AppleScript list scan | Record absence and do not fabricate Reminder-driven completion |
| Outreach E2E timed out waiting for template receipt | First verifier run used a `waiting_reply` latest session fixture | Changed the fixture to a terminal latest session because pending templates are intentionally hidden while their latest session is active |
