# Native Join Manual Recovery Boundaries

## Target

- Feature: `NC 加会` / `NC 加会浏览器回退`
- Docs: `docs/features/meeting_native_join.md`, `docs/index.md`
- Main code: `src/ringcentralNativeJoin.ts`
- Verifier: `tools/verify-ringcentral-native-join-e2e.mjs`

## Current State

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the freshest exact runs covered Memory Lens site controls, Meeting Panorama output buttons, safe search/timeline opens, Rehearsal card selection, Message Analysis observation refresh, and backup controls; Native Join was not the latest exact target.
- AppleScript did not list `Personal AI`; EventKit found it with 4 total items and 0 incomplete items. No Reminder feedback is related to Native Join.
- Current Native Join docs match the implementation at a high level: trusted RingCentral URL parsing, native app handoff, browser fallback, hidden passcode/details, manual ID/passcode copy, restore strip, and default-path receipt.

## External Scan

- RingCentral emphasizes no-download browser joining and broad browser support for external guests.
- Zoom exposes "Join from your browser" as a configurable fallback path after the app-oriented join flow.
- Microsoft Teams offers browser continuation and manual join with meeting credentials, reinforcing explicit fallback and manual-recovery affordances.
- Deep-link research and Android guidance both stress validation, hijack risk, and graceful failure handling for app links/custom schemes.

## Gap

`Join in browser`, `Copy link`, and `Try app again` already expose detailed hover/reader boundaries. The remaining controls are still uneven:

- `Copy ID` and `Copy passcode` have short accessible names but no hover title with the same no-join/no-default/no-full-link boundary.
- `Show full link` / `Hide full link` explains the state in nearby text, but the button itself does not say whether it reveals sensitive URL details or only hides them locally.
- `Use browser by default` / `Use app by default` has a short accessible name, but not a pre-click boundary that it writes a future preference and does not act on the current meeting.
- Compact `Restore recovery` and close controls do not expose the no-retry/no-browser/no-copy/no-default-change boundary at the control point.

## Implementation Plan

1. Add reusable Native Join boundary strings/helpers in `src/ringcentralNativeJoin.ts`.
2. Mirror those boundaries into both `aria-label` and `title` on the remaining manual recovery controls.
3. Keep all action handlers and storage/clipboard/protocol behavior unchanged.
4. Extend `tools/verify-ringcentral-native-join-e2e.mjs` to assert the new title/ARIA wording before clicking.
5. Update `docs/features/meeting_native_join.md` and the Native Join index row concisely.

## Validation Plan

1. `npm run test -- --run src/__tests__/ringcentralNativeJoin.test.ts` if available; otherwise use the repo's working `ts-node/esm` test invocation.
2. `node --check tools/verify-ringcentral-native-join-e2e.mjs`.
3. `npm start -- --progress`, stop after first successful compile.
4. `npm run verify:ringcentral-native-join:e2e`.
5. Scoped `git diff --check` on touched files and the new planning file.
