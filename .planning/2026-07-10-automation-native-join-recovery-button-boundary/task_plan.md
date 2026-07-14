# Native Join Recovery Button Boundary

## Selected Feature

- Index row: `NC 加会` / `NC 加会浏览器回退`
- Canonical doc: `docs/features/meeting_native_join.md`
- Runtime anchor: `src/ringcentralNativeJoin.ts`
- Verifier anchor: `tools/verify-ringcentral-native-join-e2e.mjs`

## Inputs Checked

- `docs/progressing/to-verify.md`: empty.
- Automation memory: avoided recently touched Followup, Today Pilot, Scheduled Messages, Doubao, Google Slides, Jira Design Links, Memory Search, Coverage, Agent Thinking, AR Data, Topic, and Message Analysis slices.
- Local Reminders via EventKit: `Personal AI` list exists, 4 total reminders, 0 incomplete; no Native Join feedback to incorporate or mark done.
- External scan:
  - RingCentral browser join positions web join as a no-download recovery path.
  - Zoom exposes `Join from your browser` after an app/download attempt.
  - Microsoft Teams supports meeting ID/passcode fallback.
  - Deep-link / app-protocol security discussions emphasize verified targets, fallback, and clear user-visible control boundaries.

## Plan

1. Add explicit hover and screen-reader boundaries to the `Join in browser`, `Copy link`, and `Try app again` buttons.
2. Keep the change presentation/accessibility-only: no parsing, native scheme launch, browser URL, copy payload, storage write, or timer semantics change.
3. Extend unit and Playwright E2E assertions so the button labels prove hidden passcode/details and no-join/no-default-change boundaries.
4. Update `docs/features/meeting_native_join.md` and `docs/features/index.md` concisely.
5. Verify with Native Join unit/E2E checks, `npm start` first successful compile, and scoped `git diff --check`.

## Implementation Notes

- Added a small local `setActionBoundary()` helper inside the fallback panel builder.
- The helper mirrors each action boundary into both `aria-label` and `title`.
- `Join in browser` now says it opens a new browser window with the full meeting link, including hidden passcode/details when present, and does not confirm joining or change defaults.
- `Copy link` now says it copies the full browser meeting link, including hidden passcode/details when present, and does not join, retry app, or change defaults.
- `Try app again` now says it only retries the validated app link and cannot confirm whether the user joined.

## Verification

- `node --check tools/verify-ringcentral-native-join-e2e.mjs` passed.
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/__tests__/ringcentralNativeJoin.test.ts` passed 22/22.
- `npm start -- --progress` compiled successfully in 14605 ms and was stopped after first success.
- `npm run verify:ringcentral-native-join:e2e` passed.
- Scoped `git diff --check` passed for this run's files.
- Process check found no remaining webpack watcher, Native Join E2E process, or matching Chromium process from this run.
