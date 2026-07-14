# User Profile Load-All Scope Receipt

## Target Feature

- Index row: `用户画像条目`
- Source doc: `docs/features/user_profile_system.md`
- Primary UI/code: `src/modals/components/UserProfilePage.vue`
- Verifier: `tools/verify-user-profile-export-e2e.mjs`

## Plan

1. Preserve the existing profile item list behavior and add a local receipt only around the `加载全部` action.
2. Show a pending receipt while the page is requesting the full profile item list, including the previous loaded slice and the no-write/no-confirm boundary.
3. Show a success receipt after the full list is loaded, making clear that search/filter now covers the full fetched set but personalization still only uses `active + confirmed`.
4. Show a failure receipt if the reload cannot be trusted, so the user does not read an old slice as a complete profile.
5. Extend the existing E2E fixture instead of adding a new harness.
6. Update the canonical feature doc and index with concise behavior wording.

## Non-Goals

- Do not change profile item APIs, pagination size, filtering, sorting, export semantics, confirmation, retraction, restore, or provider context selection.
- Do not touch real Memory Service data.
- Do not mark any Reminder item done unless a matching incomplete Personal AI Reminder is found.

