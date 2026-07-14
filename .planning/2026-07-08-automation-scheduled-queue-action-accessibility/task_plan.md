# Scheduled Queue Action Accessibility

Goal: improve the `队列可视化与改期建议` feature by making queue-detail actions understandable from keyboard and assistive-tech paths without changing scheduling behavior.

## Plan

1. [completed] Read `AGENT.md`, feature index, carry-over list, automation memory, repo memory guidance, worktree state, Reminder state, selected docs, source, and E2E.
2. [completed] Check local `Personal AI` Reminders and external product/research references.
3. [completed] Add accessible labels/titles for queue slot `定位最晚` and `编辑` actions that name the target, slot, position, and no-write boundary.
4. [completed] Update queue suggestion E2E to assert the action labels and no-side-effect wording.
5. [completed] Update Scheduled Messages docs and feature index briefly.
6. [completed] Run targeted E2E, `npm start` first compile, E2E again, and scoped `git diff --check`.

## Findings

- `docs/progressing/to-verify.md` is empty.
- AppleScript did not list `Personal AI`, but EventKit found the local `Personal AI` list with 4 total items and 0 incomplete items. All items are completed Doubao / Notification / test feedback, not related to Scheduled Messages queue visualization or reschedule suggestions.
- The existing queue feature already shows compact summary, details receipt, suggestion basis, write-after lane, and reschedule success/failure receipts.
- Gap: the queue-detail `定位最晚` and `编辑` buttons expose only generic visible text. A keyboard or screen-reader user cannot tell which message/slot they affect or that these actions do not write Sheet, reschedule, send, or skip prior queued messages.

## External References

- Slack scheduled-message workflows keep schedule configuration editable and user-invoked.
- Power Automate run-history tooling exposes run selection plus explicit resubmit/cancel actions instead of silently rerunning.
- CHI trigger-action-programming research emphasizes helping users reason about automation outcome differences and expectation bugs.

## Scope

- Presentation/accessibility only.
- Do not change queue calculation, suggestion selection, Sheet update payloads, Jira Automation, App Script, Logs, execution order, or Reminder state.

## Verification

- `node --check tools/verify-scheduled-messages-queue-suggestion-e2e.mjs` passed.
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/scheduled-messages/__tests__/scheduleQueuePressure.test.ts` passed 29/29.
- `npm start -- --progress` compiled successfully in 14572 ms and was stopped after the first successful compile.
- `npm run verify:scheduled-messages-queue-suggestion:e2e` passed.
- Scoped `git diff --check` passed for the touched paths.
- Process cleanup found no remaining webpack, queue E2E, temp queue profile, or Chromium process.
