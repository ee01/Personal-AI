# User Profile pending operation receipts

Run time: 2026-06-24

## Target

- Random feature index row: `用户画像条目` under `docs/features/user_profile_system.md`.
- Keep the backend profile item lifecycle unchanged.

## External direction

- ChatGPT and Claude memory controls emphasize visible review, edit/delete, import/export, and explicit user control.
- Recent memory-selection research such as RUMS and Mem0 points toward selective, evidence-aware memory use rather than silently injecting every candidate.
- For this UI, the useful slice is making pending profile mutations visible before the service confirms them.

## Plan

1. Add pending receipts for confirm, retract, restore, and explicit profile item creation.
2. Preserve current success/failure receipts and the `active + confirmed` personalization boundary.
3. Update User Profile docs and feature index wording without over-documenting implementation details.
4. Extend the existing User Profile E2E to assert the new pending receipts.
5. Run targeted verifier, first successful dev compile, E2E, and scoped whitespace checks.

