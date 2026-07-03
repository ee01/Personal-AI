# Memory Coverage backup pre-action boundary plan

## Target

- Feature: `备份下载与恢复入口` in Memory Coverage Map.
- Scope: UI trust boundary and verification for the backup entry point; no backup schema, import/export API, or database behavior changes.

## External/product direction

- Google Takeout and ChatGPT data export both train users to treat exports as downloaded archives, not automatic restores.
- Claude memory import keeps the import step explicit and reviewable instead of silently syncing another provider's memory.
- Data-portability research highlights empowerment, but also warns that easy transfers can create privacy and security risk.

## Improvement plan

1. Done: add a compact pre-action receipt next to the Coverage Map header actions explaining what the backup button will and will not do before the user clicks it.
2. Done: keep the existing post-download success/failure receipts unchanged, but make the pre-action receipt disappear once a concrete download receipt exists so the page does not repeat itself.
3. Done: update the Coverage Map doc to state that the backup entry now has both pre-action and post-action receipts.
4. Done: extend `verify-memory-coverage-e2e` to assert the pre-action receipt before download, and assert it is replaced by success/failure receipts after the operation.
5. Done: verify with targeted coverage E2E, memory backup service check, first successful `npm start` compile, and `git diff --check` scoped to touched files.
