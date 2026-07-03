# Decision Center Handled Deep-Link Plan

Goal: improve the randomly selected `决策中心` feature by keeping notification deep-link state honest after the user handles the linked confirmation item.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, current worktree state, and Reminder list state |
| 2 | completed | Select a non-fresh exact target from `docs/features/index.md` and inspect Decision Center docs/code/E2E |
| 3 | completed | Search current industry products and research for human-in-the-loop decision/approval patterns |
| 4 | completed | Implement the smallest UX fix for handled notification deep links |
| 5 | completed | Update canonical feature docs and E2E coverage |
| 6 | completed | Run targeted E2E, first successful `npm start` compile, i18n if relevant, and scoped diff checks |
| 7 | completed | Update automation memory and summarize Reminder status |

## Decisions

- Selected feature: `决策中心` under Memory Service.
- Source doc: `docs/features/memory_system.md`.
- Main UI: `src/modals/components/DecisionCenter.vue`.
- Existing verifier: `npm run verify:decision-center:e2e`.
- Reminder branch: local Reminders has no `Personal AI` list, so no Reminder item can be incorporated or marked done.
- Implementation slice: when a notification deep-linked confirmation item is answered or ended in this page, show a handled-by-this-operation notice instead of the generic "not in loaded queues" notice.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Initial random sampler included the glossary table | First feature picker parsed all markdown tables | Re-ran selection only inside `## 小功能点索引` |
| Local Reminders has no `Personal AI` list | AppleScript list scan | Stop Reminder branch and report exact absence |
| First Decision Center E2E did not see the new notice | Ran E2E before rebuilding `dist/` | Ran `npm start` to first successful webpack compile, then reran E2E |
| Playwright strict-mode matched two refresh buttons | E2E used broad `name: '刷新'` selector | Tightened Decision Center refresh selectors with `exact: true` |
