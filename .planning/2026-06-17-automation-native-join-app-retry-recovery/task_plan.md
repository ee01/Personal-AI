# Native Join App Retry Recovery Plan

## Goal

Improve `NC 加会浏览器回退` so a user who cancels or misses the external app prompt can explicitly retry the RingCentral app from the recovery panel without losing the browser fallback.

## Target Feature

- Feature index row: `NC 加会浏览器回退`
- Canonical doc: `docs/features/meeting_native_join.md`
- Main implementation: `src/ringcentralNativeJoin.ts`
- Verification: `src/__tests__/ringcentralNativeJoin.test.ts`, `tools/verify-ringcentral-native-join-e2e.mjs`

## Plan

1. Inspect current Native Join docs, implementation, unit tests, E2E, Reminder state, and recent automation memory. Status: complete.
2. Research comparable product and deep-link safety patterns. Status: complete.
3. Add a bounded recovery-state `Try app again` action that is only shown after the page remains active and app takeover is not detected. Status: complete.
4. Update the feature doc with the retry boundary and recovery behavior. Status: complete.
5. Verify with targeted unit test, `npm start` first successful compile, Native Join E2E, and scoped `git diff --check`. Status: complete.

## Design Constraints

- Do not auto-retry the external protocol.
- Do not change the user's default join preference when retrying.
- Do not hide or remove `Join in browser` / `Copy link`.
- Do not expose passcode-bearing browser URLs by default.
- Do not broaden accepted meeting hosts, schemes, or meeting-id parsing.

## Reminder Status

Local Reminders was readable, but no visible list named `Personal AI` exists. No Reminder item is incorporated or completed in this run.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `/Users/Esone/.codex/memories/phase2_workspace_diff.md` missing | Memory quick pass | Recorded as unavailable; continued with repo instructions and relevant memory files. |
| Unit test final auto-dismiss assertion used a brittle timer index after adding retry timers | First unit test run | Replaced the hard-coded index with the newest auto-dismiss timer before rerunning. |
