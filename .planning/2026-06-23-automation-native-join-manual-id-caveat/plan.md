# Native Join manual ID caveat plan

## Target

- Random feature: `NC 加会浏览器回退`
- Capability: Native Join
- Source doc: `docs/features/meeting_native_join.md`

## Context

- `docs/progressing/to-verify.md` currently says `暂无。`
- Local Reminders is reachable, but there is no list named `Personal AI`, so this run has no Reminder item to complete or annotate.
- Existing Native Join code already covers app handoff receipts, browser fallback, hidden passcode/query display, `Copy link`, `Copy ID`, `Try app again`, and default-path toggling.

## External scan

- RingCentral, Zoom, and Teams all preserve a browser/web join path when app join is unavailable or undesired.
- Teams exposes both Meeting ID and Passcode in its manual join entry point, so a copied ID alone should not imply complete manual join material.
- Teams Rooms notes that security scanners/wrappers can make meeting links unrecognizable, supporting the existing conservative unwrap-and-revalidate path.
- Deep-link security research and OWASP guidance reinforce the current trusted-host validation and parameter-minimization approach.

## Improvement Plan

1. Add a first-visible Meeting ID caveat in the Native Join fallback panel. [done]
   - If the meeting link has hidden query/hash details, say the ID is only for manual app entry and that passcode/details stay in `Join in browser`, `Copy link`, or explicit `Show full link`.
   - If there are no hidden details, still state that copying the ID does not join or change defaults.
2. Update `Copy ID` success/failure receipts only if needed to align with the visible caveat. [done: existing click receipt already aligned]
3. Extend `src/__tests__/ringcentralNativeJoin.test.ts` and `tools/verify-ringcentral-native-join-e2e.mjs` so the cue is tested before click. [done]
4. Update `docs/features/meeting_native_join.md` and the Native Join index row. [done]
5. Validate with the Native Join unit test, dev compile, Native Join E2E, and scoped `git diff --check`. [done]

## Validation

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/__tests__/ringcentralNativeJoin.test.ts` passed, 20/20.
- `node --check tools/verify-ringcentral-native-join-e2e.mjs` passed.
- `npm start` reached first successful webpack dev compile and the watcher was stopped.
- `npm run verify:ringcentral-native-join:e2e` passed.
- Scoped `git diff --check` passed.
- Process cleanup check found no lingering webpack or Native Join E2E process.
