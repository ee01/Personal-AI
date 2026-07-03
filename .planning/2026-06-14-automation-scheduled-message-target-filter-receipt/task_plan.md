# Scheduled Messages Target Filter Receipt Plan

Goal: improve the selected `定时消息列表筛选` feature by making deep-linked message targeting honest about how it interacts with active list filters, while keeping docs, tests, Reminders state, and automation memory in sync.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, automation memory, repo memory hints, `docs/progressing/to-verify.md`, feature index, worktree status, and Reminders list names |
| 2 | completed | Randomly select and inspect Scheduled Messages list filtering docs/code/tests |
| 3 | completed | Research comparable automation-history/list-filter UX and TAP debugging papers |
| 4 | completed | Implement a target-message receipt that explains when deep-link focus overrides pending/category/self-only filters |
| 5 | completed | Update focused unit/E2E coverage for the receipt and target-filter behavior |
| 6 | completed | Update `docs/features/scheduled_messages_manager.md` with the current behavior |
| 7 | completed | Run targeted verification, first successful `npm start`, feature E2E, and scoped diff checks |
| 8 | completed | Update automation memory, handle Reminder completion if applicable, and archive the Codex session if possible |

## Decisions

- Carry-over: `docs/progressing/to-verify.md` is `暂无。`; no unfinished verification item supersedes a fresh random pick.
- Reminder branch: local Reminders are readable, but the visible lists do not include `Personal AI`; no Reminder item can be incorporated or marked done.
- Selected feature: `定时消息列表筛选` under Scheduled Messages.
- Existing behavior: ordinary filters already have `列表筛选回执`; a `messageId` deep link overrides filters to show the target row, but the banner does not explicitly name that override or its no-side-effect boundary.
- Implementation slice: add a compact target-message receipt using the existing banner and shared filter helper, not a new modal or management queue.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `$CODEX_HOME` was unset when reading automation memory | Initial direct `$CODEX_HOME/automations/...` read | Re-read via `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md` |
| `timeout` command is not available on this macOS shell | First Reminders list probe | Used direct AppleScript list-name probe, which returned visible lists successfully |
| Scheduled Messages CRUD focus E2E timed out waiting for old `已定位消息` text | First E2E run after UI copy changed | Updated the stale assertion to the new `消息定位回执` contract and reran the same E2E successfully |
