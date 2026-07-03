# Automation Plan: Snooze Quick Menu Live Preview

## Goal

Random feature-loop target: `Snooze 快速时间菜单` in `docs/features/message_reaction.md`.

Improve the quick-menu UX so relative reminder choices keep their displayed/accessible time aligned with the actual time used when the user clicks.

## Plan

1. [complete] Read automation memory, AGENT.md, feature index, carry-over docs, and Reminders state.
2. [complete] Randomly select and scope the feature.
3. [complete] Inspect relevant Snooze quick-menu docs, source, tests, and prior memory.
4. [complete] Research comparable product behavior and notification-snooze literature.
5. [complete] Implement live preview refresh plus explicit timing boundary receipt.
6. [complete] Update `docs/features/message_reaction.md`.
7. [complete] Validate with focused tests, `npm start` first compile, E2E-style checks, and diff checks.
8. [complete] Update automation memory and close out.

## Selected Improvement

The quick menu already recalculates relative choices at click time, which is correct for avoiding stale scheduled writes. The remaining UX gap is that visible time previews and `aria-label`s are generated when the menu opens. If the menu stays open, a user can see an older preview but create a later recalculated reminder. The fix is to refresh the preview on hover/focus/click and state the timing contract in the menu receipt.
