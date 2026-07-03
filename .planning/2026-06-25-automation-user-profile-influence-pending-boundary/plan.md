# User Profile Influence Pending Boundary

## Target

- Random feature: `User Profile` -> `画像快速增强/降低影响`.
- Reminder check: local Reminders has no `Personal AI` list, so no Reminder item is attached to this run.

## External Scan

- ChatGPT Memory and Dreaming emphasize memory freshness plus user controls, but also make transparency especially important when inferred profile state changes in the background.
- Claude memory export/import exposes what Claude sees and keeps manual edit as a fallback.
- Gemini Enterprise saved memories expose view, update, disable-reference, and delete controls.
- Response-Aware User Memory Selection argues that useful profile injection should be based on response utility, not just semantic similarity or raw memory weight.

## Improvement Plan

1. Inspect the quick influence calibration flow for any state that claims a write, confirmation, or personalization eligibility before Memory Service confirms it.
2. Fix the pending state so clicking `设为重点` can show the target weight, but cannot prematurely mark an unconfirmed item as `active + confirmed` or `可用于个性化`.
3. Add E2E coverage for a slow `设为重点` request on a pending profile item.
4. Update the canonical feature doc and run the user-profile verification path.

## Implementation Notes

- `src/modals/components/UserProfilePage.vue` now keeps user confirmation and personalization eligibility unchanged during the pending influence request.
- `tools/verify-user-profile-export-e2e.mjs` delays the fixture response for `Export Project 2` and asserts the row stays `待确认` / `确认前不使用` while the pending receipt is visible.

## Validation

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `npm --prefix memory-service test -- --run src/__tests__/api-profile.test.ts src/__tests__/api-ingest-profile.test.ts src/__tests__/api-profile-insight.test.ts`
- `node --check tools/verify-user-profile-export-e2e.mjs`
- `npm start` first successful development compile, then stopped.
- `node tools/verify-user-profile-export-e2e.mjs`
- `git diff --check -- src/modals/components/UserProfilePage.vue tools/verify-user-profile-export-e2e.mjs docs/features/user_profile_system.md .planning/2026-06-25-automation-user-profile-influence-pending-boundary/plan.md`
