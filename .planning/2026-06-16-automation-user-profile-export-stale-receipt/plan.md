# User Profile Export Stale Receipt Plan

## Context

- Automation: 真实体验官 / automation-3
- Selected feature: `docs/features/user_profile_system.md`
- User persona: a privacy-conscious user who periodically exports profile data for audit and expects the page to distinguish the current export from older files.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`

## UX Gap

After a successful profile export, a later export failure could leave the previous `画像导出回执` visible. That mixes a current failure with an older successful file receipt and makes it unclear whether the failed attempt produced a valid JSON export.

## Plan

1. Clear stale export receipts when any new export starts.
2. Make ordinary status changes clear old export receipts by default.
3. Preserve the export receipt only for the export success path that just created the current file.
4. Add an E2E regression that performs successful export, diagnostic-partial export, then a failing export and asserts the old receipt is gone.
5. Update the canonical user profile doc with the current-export receipt boundary.

## Validation Target

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `node tools/verify-user-profile-export-e2e.mjs`
- First successful `npm start` compile, then stop watch.
- `git diff --check` for touched files.
