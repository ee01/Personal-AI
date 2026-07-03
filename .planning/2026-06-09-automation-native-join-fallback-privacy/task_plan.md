# Native Join Fallback Privacy Plan

Run started: 2026-06-09T14:30+08:00

## Goal

Improve the randomly selected `NC 加会浏览器回退` feature so RingCentral native join remains recoverable when the app handoff fails, while avoiding unnecessary visible exposure of meeting passcodes or query parameters in the fallback overlay.

## Scope

- Feature doc: `docs/features/meeting_native_join.md`
- Runtime: `src/ringcentralNativeJoin.ts`
- Focused tests: `src/__tests__/ringcentralNativeJoin.test.ts`
- E2E proof: `tools/verify-ringcentral-native-join-e2e.mjs`

## Plan

1. Complete discovery and planning.
   - Status: complete
   - Notes: Selected `NC 加会浏览器回退`; no `docs/progressing/to-verify.md` carry-over; local Reminders has no `Personal AI` list.
2. Implement safer fallback-link disclosure.
   - Status: complete
   - Notes: Keep full `browserUrl` for `Join in browser` and `Copy link`, but display a query-stripped browser URL by default with a privacy note and explicit reveal action.
3. Update docs and focused assertions.
   - Status: complete
   - Notes: Document the hidden query/passcode behavior without over-detailing internals.
4. Validate.
   - Status: complete
   - Checks: Native Join unit test, first successful `npm start` compile, Native Join E2E, `git diff --check`.

## Risks / Boundaries

- Do not change URL parsing, trusted host validation, meeting ID safety, or default app/browser preference semantics unless needed.
- Do not expose the full passcode-bearing URL until a user explicitly asks to reveal it.
- Do not stage or revert unrelated dirty worktree changes.

## Errors Encountered

None.
