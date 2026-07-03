# Automation Plan: Snooze Manage Single-Flight

## Goal

Random feature-loop target: `Snooze 快速时间菜单` in `docs/features/message_reaction.md`.

Improve the quick menu's `管理稍后处理 / Manage Remind` path so it behaves like the reminder creation path: one click should open one management surface, show a clear in-progress state, and recover cleanly if opening fails.

## Plan

1. [complete] Read automation memory, `AGENT.md`, feature index, carry-over docs, Reminders state, and prior Snooze plan.
2. [complete] Randomly select and scope the feature.
3. [complete] Inspect relevant Snooze quick-menu docs, source, tests, and current dirty diff.
4. [complete] Research comparable product behavior and notification-snooze literature.
5. [complete] Implement single-flight manage-entry behavior for the Snooze quick menu.
6. [complete] Add focused verification coverage.
7. [complete] Update `docs/features/message_reaction.md`.
8. [in_progress] Run targeted verification, first successful dev compile, and diff checks.
9. [pending] Update automation memory and close out.

## Selected Improvement

The quick menu already explains where reminders go and gives a permanent management entry. The remaining UX gap is that the manage entry is not serialized like reminder creation. A fast double-click can send multiple open requests, producing duplicate management tabs or unclear state. This is a direct trust problem for a recovery path: the user clicked management because they need to inspect or change a reminder, so the UI should acknowledge the request and prevent duplicates.
