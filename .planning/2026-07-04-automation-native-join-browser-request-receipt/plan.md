# Native Join Browser Request Receipt Plan

## Target

- Feature index row: `NC 加会浏览器回退`
- Canonical doc: `docs/features/meeting_native_join.md`
- Main source: `src/ringcentralNativeJoin.ts`
- Main proof: `tools/verify-ringcentral-native-join-e2e.mjs`

## Current State

- `docs/progressing/to-verify.md` has no carry-over items.
- AppleScript did not list `Personal AI`; EventKit found `Personal AI` with 4 completed historical Doubao / Notification items and no Native Join feedback.
- Existing Native Join UI already explains app handoff uncertainty, hidden passcode/details, `Copy ID`, `Copy passcode`, `Try app again`, default-path save failures, and close/restore recovery.

## External Scan

- RingCentral, Zoom, and Teams keep browser or meeting-ID join as a recovery path when app launch is unavailable or not desired.
- Deep-link security research emphasizes that custom scheme handoff can be hijacked or fail silently, so the UI should not present scheme launch as confirmed execution.
- Constructive takeaway: after a user explicitly chooses browser fallback, the source page should still state that only a browser window request happened. It should not imply the user joined, the app was retried, or defaults changed.

## Implementation Plan

1. Add a compact `Browser join requested` receipt after `Join in browser` successfully opens a new browser window.
2. Reuse the existing restore behavior so the full recovery panel can be restored without launching the app again.
3. Keep popup-blocked same-tab fallback unchanged.
4. Update the Native Join doc with the new browser-request boundary.
5. Extend the existing Native Join E2E to assert the compact receipt.

## Validation Plan

- `node --test src/__tests__/ringcentralNativeJoin.test.ts`
- `node --check tools/verify-ringcentral-native-join-e2e.mjs`
- `npm start -- --progress` until first successful compile, then stop it.
- `npm run verify:ringcentral-native-join:e2e`
- Scoped `git diff --check` for touched files.
