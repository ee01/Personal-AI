# Quick Ask Status Priority Receipt Plan

## Target

- Random feature: `Quick Ask 状态卡`
- Feature doc: `docs/features/doubao_bridge.md`

## Context

- `docs/progressing/to-verify.md` has no carry-over items.
- Automation memory says the previous run covered Meeting Pilot, so this pass avoids repeating that feature.
- Local Reminders is accessible, but there is no `Personal AI` list, so no Reminder items are included or completed.
- External references point toward launcher-style AI staying fast while proactive or mixed-initiative state remains explainable and under user control.

## UX Gap

The status card already shows source and snapshot freshness, but mixed runtime states still lack a visible reason for why each item is shown in that order. A user can see `setup_blocker`, `sync_issue`, or `waiting_reply`, but not quickly tell whether the item is urgent, an approval boundary, a recovery path, or just queued background work.

## Plan

1. Add a compact per-item priority receipt that explains why the status is present now.
2. Keep the existing status card interaction model: clicking a status item still drafts a follow-up question; setup blockers still open settings.
3. Include the priority receipt in the drafted follow-up so stale/urgent boundaries travel with the question.
4. Extend the Quick Ask status-card E2E to assert visible priority receipts and draft propagation.
5. Update `docs/features/doubao_bridge.md` with the current status-card contract.
6. Validate with `npm --prefix desktop-app run test:quick-ask-status-card`, `npm start` first successful compile, and path-scoped `git diff --check`.
