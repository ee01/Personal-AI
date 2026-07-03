# User Profile Loaded-Slice Search Receipt

## User Journey

A cautious user audits profile items by searching for a remembered project or preference. The page initially loads a capped slice for speed, so a search can return no matches even though the item exists in the unloaded tail.

## Improvement Plan

1. Add a compact `检索范围` receipt below the User Profile item summary.
2. Make the receipt explicit that search/filter currently matches only the loaded slice until `加载全部` runs.
3. Keep the change presentation-only: no backend query, export, calibration, confirmation, restore, or profile write semantics change.
4. Extend the existing User Profile E2E to prove the receipt is visible before `加载全部`, changes after all items are loaded, and appears with a no-match truncated search.
5. Update `docs/features/user_profile_system.md` so the canonical behavior mentions the loaded-slice search boundary.

## Verification Target

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `npm start` until first successful compile, then stop
- `node tools/verify-user-profile-export-e2e.mjs`
- `git diff --check -- src/modals/components/UserProfilePage.vue tools/verify-user-profile-export-e2e.mjs docs/features/user_profile_system.md .planning/2026-07-02-automation-user-profile-loaded-slice-search/plan.md`
