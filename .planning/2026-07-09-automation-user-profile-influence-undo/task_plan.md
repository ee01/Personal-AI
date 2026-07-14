# User Profile Influence Undo Plan

## Target

- Feature: `画像快速增强/降低影响`
- Source doc: `docs/features/user_profile_system.md`
- Main UI: `src/modals/components/UserProfilePage.vue`

## Plan

1. Inspect current profile calibration docs, UI receipts, message handler, and E2E fixture.
2. Check the local `Personal AI` Reminders list and fold in any open related item.
3. Use current product and research references to constrain the UX improvement.
4. Add a narrow undo path for the last successful influence adjustment.
5. Update the existing User Profile E2E to cover lower-impact -> undo -> later retract.
6. Refresh concise docs/index wording.
7. Run targeted User Profile verification, dev compile, E2E, and scoped whitespace checks.
