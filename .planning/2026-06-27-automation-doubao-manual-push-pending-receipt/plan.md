# Doubao Manual Push Pending Receipt

## Target

- Randomly selected feature: `Persona / 近期重点 / 提醒推送` under Doubao Bridge.
- Scope: Desktop App manual push buttons for `stable_memory`, `mobile_briefing`, and `reminder_sync`.
- Reminder check: local Reminders lists were readable, but there was no `Personal AI` list, so no Reminder item was incorporated or completed.

## Findings

- The feature docs already describe pre-click and post-result receipts for package type, target thread, delivery verification, and skipped runs.
- The remaining UX gap was the in-flight state: immediately after clicking a manual push button, the UI only changed the button text to `推送中...` while the message area could still show an older success/failure. A real user could misread that as already sent, especially for reminder sync where send, mark-done, and empty-placeholder boundaries must stay separate.
- Product scan signals:
  - ChatGPT Scheduled Tasks uses explicit confirmation, notification, and monitoring-task management for proactive reminders.
  - ChatGPT Memory Sources makes personalization sources visible and manageable.
  - Digital reminder-system research argues reminders often mix future intentions, remembered details, and conversation cues, so state and effect boundaries need to stay visible.
  - Automation-transparency research supports showing automation activity and effects in the interface, not only after completion.

## Plan

1. Add a `推送待确认` in-flight receipt before `bridgeApi.runNow()` resolves.
2. Keep the receipt per sync kind:
   - `stable_memory`: renders `persona_core / voice_mode`, not mobile context.
   - `mobile_briefing`: renders `active_focus_digest`, not long-term persona / voice.
   - `reminder_sync`: renders manual digest, does not mark todos done or send placeholders.
3. Extend the existing desktop Playwright harness to hold a manual run pending, assert the in-flight receipt, release the mocked run, and assert final receipts still work.
4. Update `docs/features/doubao_bridge.md`.
5. Verify with the focused desktop harness, first successful `npm start` compile, and scoped `git diff --check`.
