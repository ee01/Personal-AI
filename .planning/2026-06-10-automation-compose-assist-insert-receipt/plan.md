# Compose Assist Direct Insert Receipt

## Target

- Random feature: `回复助手直接插入`
- Source doc: `docs/features/assist.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Local Reminders is reachable, but there is no `Personal AI` list, so no reminder feedback is included.
- External references checked: Gmail Smart Compose, Outlook suggested replies, and recent human-AI co-writing agency papers all support keeping writing assistance user-editable, explicitly not-sent, and recoverable.

## Plan

1. Keep the existing direct insert / review gates intact.
2. Make the post-insert receipt say the suggestion is in the draft only, not sent, and still editable.
3. If the composer refuses insertion, show a visible failure receipt and avoid accepted feedback or ambient positive traces.
4. Update the Compose Assist doc and direct-insert E2E coverage.
5. Verify with focused tests, first webpack dev compile, E2E, and diff checks.
