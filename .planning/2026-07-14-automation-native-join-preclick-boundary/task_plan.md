# Native Join Pre-click Boundary Plan

Goal: improve `NC 加会浏览器回退` by keeping docs current, using external product/research references, checking local `Personal AI` Reminders, then implementing a bounded UX/code fix with repo-native verification.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, stale planning state, automation memory, `docs/progressing/to-verify.md`, and `docs/features/index.md` |
| 2 | completed | Select `NC 加会浏览器回退` after rerolling away from fresh Relationship Radar targets |
| 3 | completed | Inspect `docs/features/meeting_native_join.md`, Native Join source, Video Home integration, and E2E verifier |
| 4 | completed | Check local Reminders with AppleScript plus EventKit fallback |
| 5 | completed | Scan current product/paper references for browser fallback, Meeting ID, and deep-link safety |
| 6 | completed | Implement Video Home pre-click Join button boundary without changing handoff semantics |
| 7 | completed | Update docs/index and E2E assertions |
| 8 | completed | Run targeted verifier, dev compile, E2E, diff checks, cleanup, and automation memory update |

## Decisions

- Selected feature: `NC 加会浏览器回退` under Native Join.
- Source doc: `docs/features/meeting_native_join.md`.
- Implementation slice: add hover/read-screen pre-click boundary to recognized RingCentral Video Home Join buttons whose target can be validated. Do not change URL parsing, app launch, fallback, storage, clipboard, or default preference semantics.
- Reminder state: AppleScript did not list `Personal AI`, but EventKit found it with 4 total items and 0 incomplete items. All completed items are historical Doubao/Notification/test feedback, not Native Join feedback, so no Reminder item will be incorporated or marked done.
- External direction: RingCentral/Zoom/Teams keep browser or Meeting ID recovery paths visible; deep-link research supports treating custom-scheme handoff as uncertain and user-confirmed only after explicit recovery/action evidence.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| AppleScript list scan did not show `Personal AI` | Reminder list enumeration | Used EventKit fallback, which found the list and confirmed 0 incomplete items |
| Random sample first viable Relationship Radar candidate was too fresh | Feature selection | Rerolled to Native Join to avoid duplicating today's Relationship Radar work |

## Verification

- `node --check tools/verify-ringcentral-native-join-e2e.mjs` passed.
- `npm start -- --progress` compiled successfully in 14554 ms and was stopped after the first successful compile.
- `npm run verify:ringcentral-native-join:e2e` passed.
- Scoped `git diff --check` passed for owned source/docs/planning files.
- Process cleanup found no remaining webpack watcher or Native Join E2E process.
