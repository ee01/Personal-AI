# Doubao Bridge manual push receipts

## Selected feature

- Random feature: `Persona / 近期重点 / 提醒推送`
- Source doc: `docs/features/doubao_bridge.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is accessible, but there is no `Personal AI` list, so no reminder item is driving this pass.
- The existing doc and code already cover the two-thread model, latest send audit, skip/failure states, and mobile-context channel receipt.

## External signals

- ChatGPT Tasks and Pulse make proactive work reviewable through task lists, notifications, daily cards, feedback, and opt-out controls.
- Prospective-memory research supports making the future cue/action relationship explicit before the reminder fires.
- Provenance/XAI work supports showing source, processing path, and authority boundaries before users trust automation.

## Plan

1. Add pre-click receipts to the Desktop App thread panels:
   - persona push: package, target thread, and stable-memory boundary
   - recent focus push: package, target thread, and empty-placeholder boundary
   - reminder/notice push: manual digest mode, target thread, and delivery/audit boundary
2. Keep the receipt in the existing step cards so it is visible before the user clicks.
3. Update the Doubao feature doc with the pre-click receipt behavior.
4. Extend the existing desktop Playwright check with stable text assertions.
5. Validate with desktop tests, E2E, `npm start` first compile, desktop build, and `git diff --check`.
