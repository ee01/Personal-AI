# Native Join Default Save Failure Receipt Findings

- Selected feature: `NC 加会` / RingCentral Native Join from `docs/index.md`.
- Source doc: `docs/features/meeting_native_join.md`.
- Main implementation: `src/ringcentralNativeJoin.ts`.
- Existing targeted coverage: `src/__tests__/ringcentralNativeJoin.test.ts` and `tools/verify-ringcentral-native-join-e2e.mjs`; package script is `npm run verify:ringcentral-native-join:e2e`.
- Reminder state: AppleScript list scan did not show `Personal AI`; Swift/EventKit fallback did. The list has 4 completed items, all unrelated to Native Join.
- External references checked: RingCentral browser join support, Zoom browser join / app prompt behavior, Teams browser/app and Meeting ID + passcode join, and deep-link hijacking/security guidance.
- UX gap: failed default-path save currently only changes the status line. A user cannot see a durable receipt confirming that no preference changed and no join/retry/copy/open side effect happened.
