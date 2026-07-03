# User Profile Item Evidence Receipt Plan

Goal: improve the randomly selected `用户画像条目` feature with a focused UX/code change after code/doc inspection, outside research, and Reminder check.

## Findings

- Reminder check: Reminders is readable, but no `Personal AI` list exists locally, so no Reminder items can be incorporated or marked done.
- Current docs are broadly current for profile item creation, confirmation, exclusion, restoration, influence calibration, safe evidence links, and export boundaries.
- Current UI already has strong receipts for create/confirm/influence/retract/restore/export. The remaining item-level UX gap is evidence inspection: the button says only `N 条证据 · 查看`, so a user can still wonder whether opening evidence refreshes source pages, confirms the profile item, or writes profile state.
- External scan:
  - ChatGPT memory controls emphasize user management, priority/deprioritization, deletion, and memory history.
  - Claude memory exposes view/edit memory, citations to past chats, export/import, and clear toggles.
  - Gemini privacy controls separate saved info/activity/connected-app data and warn that linked services retain their own data.
  - Response-aware memory selection and Mem0 both support selective, evidence-backed memory use instead of showing or injecting everything.

## Plan

1. Add a compact evidence-inspection receipt inside expanded User Profile evidence panels and accessible/title text on evidence toggle buttons.
2. Keep source URL safety and all profile mutation/export behavior unchanged.
3. Extend `tools/verify-user-profile-export-e2e.mjs` to assert the evidence receipt and accessible boundary.
4. Update `docs/features/user_profile_system.md` with the evidence-inspection boundary.
5. Run `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`, `npm start` to first successful compile, `node tools/verify-user-profile-export-e2e.mjs`, `npm run verify:i18n`, and scoped `git diff --check`.
6. Update automation memory and close out Reminder state if applicable.

## Status

- Completed on 2026-06-29T01:09:03+08:00.
