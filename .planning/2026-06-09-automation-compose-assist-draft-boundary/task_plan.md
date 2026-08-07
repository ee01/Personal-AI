# Compose Assist Draft Boundary Plan

Goal: improve the selected `回复助手草稿辅助` feature by checking docs/code against current behavior, incorporating Reminder and outside-reference context, then shipping a focused low-decision UX improvement with verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, AGENT workflow, feature index, planning state, Reminders, feature docs, code, tests, and outside references |
| 2 | completed | Implement compact draft-boundary receipt in the Compose Assist preview/review popover |
| 3 | completed | Update focused tests/E2E and `docs/features/assist.md` |
| 4 | completed | Run targeted frontend/backend checks, dev compile, E2E, and diff checks |
| 5 | completed | Update automation memory and summarize final outcome |

## Decisions

- Selected feature: `回复助手草稿辅助` under Compose Assist.
- Source doc: `docs/features/assist.md`.
- Reminders state: local Reminders is readable, but there is no visible list named `Personal AI`, so no Reminder feedback can be incorporated or marked done.
- Implementation slice: add a compact `草稿回执` to the input-adjacent Compose Assist popover so users can tell what will be inserted, that nothing will be sent/submitted, why review may be required, and how many evidence items are behind the draft.
- Keep the UX lightweight: no new management page, no extra mandatory review for low-risk suggestions, and no source links in the hover popover.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Root `task_plan.md` is an older Scheduled Messages plan | Planning restore | Created an isolated plan under `.planning/2026-06-09-automation-compose-assist-draft-boundary/` |
