# Native Join safe-link recovery plan

## Target

- Feature: `NC 加会` / RingCentral Native Join.
- Doc: `docs/features/meeting_native_join.md`.
- Code: `src/ringcentralNativeJoin.ts`, existing Native Join test and E2E harness.

## Findings

- Standard RingCentral Video links are documented as `https://v.ringcentral.com/join/{meeting_id}` and may include a password query.
- Native Join already keeps a browser fallback, hides query/hash in the visible panel, and validates host/path/meetingId before launching `rcvdt://`.
- Current extraction handles JSON slash/unicode escapes but misses Google / Outlook / security-scanner redirect wrappers where the real RingCentral link is percent-encoded in `q`, `url`, `target`, or similar parameters.
- External deep-link guidance argues for strict validation and graceful recovery, so the widening must unwrap only bounded redirect params and then reuse the existing trusted-host parser.

## Plan

1. Add conservative redirect-param unwrapping to `extractRingCentralVideoJoinUrl()`.
2. Keep the allowlist unchanged: only decoded `v.ringcentral.com` `/join`, `/launcher`, or `/conf/on` targets can convert to native join.
3. Add targeted tests for Google redirect, Outlook Safe Links, standalone percent-encoded URLs, and wrapper-param leakage.
4. Update the Native Join E2E fixture to use a Safe Links-wrapped calendar URL.
5. Sync `docs/features/meeting_native_join.md` with the new behavior and boundary.
6. Validate with the native-join unit test, `npm start` first compile, native-join E2E, and `git diff --check`.
