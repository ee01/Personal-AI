# Findings

## Repository

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有 carry-over 待校验事项。
- 工作区已有大量历史脏改；本轮只拥有本计划目录、`.planning/.active_plan`、Snooze 快速菜单相关源码、verifier/E2E 和文档改动。
- 随机样本首位为 `Snooze 快速时间菜单`，本轮选为目标。

## Reminder

- AppleScript list enumeration did not include `Personal AI`.
- EventKit did find `Personal AI`: total 4, incomplete 0.
- Completed items are historical Doubao / notification / test feedback and unrelated to Message Reaction Snooze.

## External Research

- Gmail Snooze: desktop/mobile entry asks the user to choose a later day/time, reinforcing that snooze is a time-selection act before the message returns.
- Slack reminders: message hover -> Remind me -> choose a time or custom time; management remains in Slack reminder paths.
- Boomerang for Gmail: pending boomeranged messages are available from a Manage Scheduled Messages page, matching the Personal AI `管理稍后处理` recovery path.
- MobileHCI 2018 Snooze research: user-defined deferral is commonly tied to people/events and daily routines, so short delays, EOD, and next-morning choices should stay explicit.
- Email deferral research: deferred items are often tasks postponed until the user has time or information; the UX should show where the item will be recoverable, not imply completion.

## Code Findings

- `src/message-reaction/snoozeQuickMenuPresentation.ts` currently returns `null` when there is no existing Snooze marker, so new-reminder quick menus have options but no first-screen write/timing boundary.
- `src/message-reaction/MessageReactionUI.ts` already refreshes option times on hover/focus/click and has a targeted receipt update hook for existing Snooze reschedule previews.
- `desktop-app/scripts/message-reaction-toolbar-check.mjs` already covers quick-menu E2E, English localization, stale marker cache receipts, keyboard navigation, custom time picker, and manage entry.
- Existing docs still say the normal quick menu deliberately omits pre-click receipt; this is the line to update after adding a compact `提醒时间口径` receipt.
