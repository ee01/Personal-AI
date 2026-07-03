# User Profile Export Findings

## Initial Context

- Selected feature: `用户画像导出` under User Profile.
- Source doc: `docs/features/user_profile_system.md`.
- Feature index notes existing coverage via `tools/verify-user-profile-export-e2e.mjs`.
- Local Reminders list names: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- There is no visible local Reminders list named `Personal AI`.
- `docs/progressing/to-verify.md` has no pending carry-over item.

## Code And UX Findings

- `docs/features/user_profile_system.md` is broadly current: it already documents full `status=all` pagination, `profileAudit`, optional diagnostic warnings, manifest SHA-256 fingerprints, and the post-download export receipt.
- Main UI path: `src/modals/components/UserProfilePage.vue` renders a compact `导出范围` line in the header, calls `EXPORT_USER_PROFILE`, downloads a local JSON file, then keeps a `画像导出回执`.
- Main background path: `src/services/UserProfileMessageHandler.ts` builds `exportInfo.manifest`, `pagination`, `profileAudit`, optional-section availability, and `exportSummary`.
- Existing E2E `tools/verify-user-profile-export-e2e.mjs` already proves view pagination, export pagination, all-status inclusion, inactive audit items, warning handling, manifest integrity, failure cleanup, and post-download receipt copy.
- UX gap: before clicking `导出画像`, the user only sees one sentence. The important export contract exists after the download, but the pre-click surface does not yet make the file format, manifest/integrity, all-status scope, diagnostic warning fallback, and no restore/delete/sync/send boundary scan-friendly.
- The low-decision implementation slice is a pre-export checklist beside the export button. It reuses current state (`loaded/total/filter/truncated`) and does not change export payload semantics.

## External Reference Findings

- OpenAI's ChatGPT data export flow separates requesting/exporting account data from other data controls and requires a confirmation step.
- Google Takeout frames export as creating an archive/copy and explicitly notes that downloading data does not delete it from Google servers.
- Claude's current help docs describe account data export and memory import/export for backup or migration, which reinforces explicit portability boundaries.
- GDPR Article 20 and UK ICO guidance both emphasize structured, commonly used, machine-readable exports, not implicit restoration or deletion.
- Recent AI memory portability / long-term-memory research highlights memory lock-in, privacy, provenance, and portability risk. The UI should therefore treat export as a local, auditable artifact with clear integrity and side-effect boundaries.
