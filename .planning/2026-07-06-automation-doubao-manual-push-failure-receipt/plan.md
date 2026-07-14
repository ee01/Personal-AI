# Doubao manual push failure receipt plan

## Target

- Feature: `Persona / 近期重点 / 提醒推送`
- Docs: `docs/features/doubao_bridge.md`
- Surface: `Personal AI.app` Doubao Bridge manual push controls

## Current finding

- Pending, success, skipped, and audit receipts already explain package type, target thread, source count, verification, transport, and status-writeback boundaries.
- If manual push throws before returning an auditable result, the UI falls back to a plain error message. Users cannot tell whether the click wrote to `memory_sync_thread` or `mobile_context_thread`, marked a delivery, mixed persona into the mobile thread, or completed reminders.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. A completed historical Doubao feedback item about wrong recent highlights was already addressed, so no Reminder item should be reopened or marked done.

## External scan

- ChatGPT Memory and Tasks keep source, trigger, notification, and management state separate; initiated work should not be shown as completed before confirmation.
- Claude memory import and long-term memory research reinforce provenance and "what stuck" visibility.
- Human-AI interaction guidance supports status visibility and graceful failure for AI-initiated actions.

## Implementation

1. Add a manual push failure receipt helper for `stable_memory`, `mobile_briefing`, and `reminder_sync`.
2. Use it in the three manual push `catch` branches.
3. Extend `desktop-app/scripts/doubao-source-toggle-gating-check.mjs` to simulate a rejected `runNow` and assert the failure copy.
4. Update `docs/features/doubao_bridge.md` and `docs/features/index.md`.

## Verification

- `node --check desktop-app/app/renderer.js`
- `node --check desktop-app/scripts/doubao-source-toggle-gating-check.mjs`
- `npm --prefix desktop-app run test:source-toggle-gating`
- `npm start -- --progress` until first successful compile, then stop
- scoped `git diff --check`
