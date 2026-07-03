# User Profile Export Manifest Check Plan

Run time: 2026-06-30T15:05:35+0800

## Target

- Selected feature: `用户画像导出` under User Profile.
- Source doc: `docs/features/user_profile_system.md`.
- Main UI: `src/modals/components/UserProfilePage.vue`.
- Existing proof: `tools/verify-user-profile-export-e2e.mjs`.

## Reminder State

- Local Reminders list-name probe succeeded.
- No `Personal AI` list exists on this machine, so no Reminder item is related or markable for this run.

## Research Notes

- ChatGPT, Claude, and Google Takeout data-export patterns separate downloadable copies from deletion, restore, import, and external sync.
- Memory portability and personalization research points to structured payloads, provenance, integrity metadata, and clear user control over which profile facts can be reused.
- Constructive gap for this slice: the export receipt already has a short fingerprint, but post-download copy still says some sections were "written" without naming the local JSON target, and it does not surface the manifest ID as a file-level check handle.

## Implementation Plan

1. Keep the export data contract unchanged.
2. Update the pending/success/partial export receipt copy to say diagnostic/profile sections are written to the downloaded JSON, not written back to Memory Service.
3. Show a manifest ID check in the success/partial receipt so the user can match the visible receipt to the file content.
4. Extend the existing export E2E assertions for the manifest ID and local-JSON wording.
5. Update `docs/features/user_profile_system.md` with the new post-download verification behavior.
6. Verify with the User Profile E2E, first successful `npm start` compile, and scoped `git diff --check`.
