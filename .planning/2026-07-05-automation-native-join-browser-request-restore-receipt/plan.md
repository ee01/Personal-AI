# Native Join Browser Request Restore Receipt Plan

## Target

- Feature index row: `NC 加会浏览器回退`
- Canonical doc: `docs/features/meeting_native_join.md`
- Main source: `src/ringcentralNativeJoin.ts`
- Main proof: `tools/verify-ringcentral-native-join-e2e.mjs`

## Current State

- `docs/progressing/to-verify.md` has no carry-over items.
- AppleScript did not list `Personal AI`; EventKit found the list with 0 incomplete reminders.
- Native Join already has a compact `Browser join requested` receipt after `Join in browser`, but restoring recovery from that receipt reused the generic hidden-panel restore copy.

## Experience Gap

A cautious meeting user may click `Join in browser`, then restore recovery from the source page. The restored panel should not say it was restored after being hidden, because the user already made a browser-join request. It should preserve the exact boundary: no second browser window opened, no app retry happened, and the earlier browser request is still unconfirmed.

## Implementation Plan

1. Pass the compact receipt source into restored fallback state.
2. Show a browser-request-specific restored receipt when recovery is restored from `Browser join requested`.
3. Keep the existing hidden-handoff restore copy unchanged.
4. Extend the Native Join E2E to prove restore does not open another browser window or relaunch the app.
5. Update the Native Join feature doc with the restored-source boundary.

## Validation Plan

- `node --test src/__tests__/ringcentralNativeJoin.test.ts`
- `node --check tools/verify-ringcentral-native-join-e2e.mjs`
- `npm start` until first successful compile, then stop it.
- `npm run verify:ringcentral-native-join:e2e`
- Scoped `git diff --check` for touched files.
