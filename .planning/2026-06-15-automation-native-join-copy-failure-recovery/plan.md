# Native Join Copy Failure Recovery Plan

## Scope

- Selected feature: `Native Join` / `NC 加会浏览器回退`.
- Target files: `src/ringcentralNativeJoin.ts`, `src/__tests__/ringcentralNativeJoin.test.ts`, `tools/verify-ringcentral-native-join-e2e.mjs`, and `docs/features/meeting_native_join.md`.
- Reminder status: local Reminders was readable, but no `Personal AI` list was visible on this machine.

## External Signals

- RingCentral positions browser join as a no-download path for external guests and blocked app-download environments.
- Zoom exposes `Join from your browser` after the app-launch path and lets admins control whether browser join is available.
- Teams deep-link docs distinguish HTTPS links with a browser choice screen from native protocol links that can strand users without the desktop client.
- Deep-link security research highlights that scheme URLs are not a trustworthy proof of the intended app handling the link.

## Improvement Plan

1. Preserve the existing default behavior: native app first, browser fallback visible, passcode/query hidden in the displayed URL.
2. Fix the manual recovery gap: when `Copy link` fails and the visible browser URL is sanitized, automatically reveal the full browser link so manual copy remains viable.
3. Make the status copy explicit: no clipboard write happened, the full recovery link is now visible, and the user should hide it before screen sharing.
4. Keep reveal-link clicks out of page-level native-join interception.
5. Update the feature doc and prove the path through unit/E2E validation.
