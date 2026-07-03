# Quick Ask Window Findings

## 2026-06-25

- Random selection rerolled away from the freshest exact feature families in automation memory. Locked target: `Quick Ask 小窗` under Doubao Bridge.
- Source doc: `docs/features/doubao_bridge.md`. The doc is broadly current for Quick Ask: menubar entry, `Option+A`, compact/expanded states, immediate pending feedback, active-browser context filtering, mobile-context send receipt, status card, explicit remember, and voice receipts are documented.
- Local Reminders: AppleScript found no visible Reminders list named `Personal AI`; no Reminder item can be incorporated or marked done in this run.
- Existing worktree is very dirty, including current Quick Ask files. Treat all pre-existing diffs as user/automation-owned and layer only a small additive change.
- Current Quick Ask code already includes status-card action descriptors, status freshness receipts, mobile-context send receipts, active-browser context filtering, session expiry, evidence cleanup, explicit remember handling, and voice draft receipts.
- UX gap: the compact scope buttons (`工作 / 个人 / 两者`) call `persistAskScope()` and write `explorer.askDefaultScope` on success, but success has no visible receipt. Users can misread the action as a one-off filter rather than a saved default for later Quick Ask / Ask behavior.
- Implementation slice: show an inline banner after scope changes saying the selected scope was saved as the default, and explicitly say this does not rewrite existing memories, resend/sync, or change already-rendered answers. If settings are unavailable or save fails, keep the immediate local switch but say the default was not saved.

## External Reference Findings

- Raycast Quick AI presents quick AI as a one-off, flow-preserving question surface with follow-ups and handoff to full chat. This supports keeping Quick Ask scope feedback inline rather than navigating to settings.
- OpenAI's ChatGPT macOS Chat Bar is a movable prompt window opened by keyboard/menu bar, with explicit submit controls and configurable shortcut. This reinforces that launcher-like surfaces should keep transient controls and side effects visible in-place.
- Mixed-Initiative Context argues that context should be explicit and bounded rather than a flat hidden transcript. Quick Ask's scope selector is a context boundary, so saving it silently is a mismatch.
- Proactive / preference-aligned assistant research emphasizes that users vary in desired assistant initiative and presentation; default-scope changes should be visible because they tune future assistant behavior.
