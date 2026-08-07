# RingCentral Native Join Dismissed Recovery Plan

## Target

- Feature: `NC 加会` / RingCentral Native Join from `docs/index.md`.
- Reminder branch: local Reminders did not contain a `Personal AI` list, so no Reminder item is linked or marked done.
- Existing state: current code already has native handoff receipt, safe browser fallback, hidden passcode display, copy full link, Meeting ID copy, app retry, and browser-default toggle.

## External Scan

- RingCentral emphasizes browser join as a no-download path for users who cannot or do not want to use a native app.
- Zoom keeps `Join from your browser` available after the app/open prompt path, including the common cancel-prompt recovery flow.
- Teams offers `Continue on this browser`, `Join on the Teams app`, and an ID/passcode path when the invite link is not working.
- USENIX Security 2017 deep-link work and Android deep-link security guidance support treating custom scheme handoff as unconfirmed and keeping strict validation plus a web recovery path.

## UX Problem

When the user clicks `x` on the fallback panel, the full recovery surface disappears immediately. If the Chrome external-protocol prompt was cancelled, ignored, or hidden behind another window, the user has to find and click the original meeting entry again. Because the extension cannot confirm app takeover or actual meeting join, a closed panel should leave a small, time-bounded recovery affordance.

## Implementation Plan

1. Add a compact dismissed-recovery strip after the top-right close action.
2. The strip must say the handoff panel was hidden, no join was confirmed, and the default path is unchanged.
3. `Restore recovery` must rebuild the recovery controls without relaunching the app.
4. Restored recovery should explicitly say no new app attempt, browser join, copy, or preference write happened; `Try app again` remains the explicit retry path.
5. Do not change URL parsing, native scheme validation, browser fallback URL construction, copy semantics, or default preference persistence.
6. Update unit/E2E tests and `docs/features/meeting_native_join.md`.

## Validation

- Targeted Native Join unit test.
- `npm start` until first successful compile, then stop.
- `npm run verify:ringcentral-native-join:e2e`.
- Scoped `git diff --check` for changed files.
