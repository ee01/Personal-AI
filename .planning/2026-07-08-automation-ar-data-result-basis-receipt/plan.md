# AR Data result-basis receipt plan

Run time: 2026-07-08T23:00:00+08:00

## Selected feature

- `docs/features/ar_data_overlay.md` / Personal AI AR Data.
- No carry-over item existed in `docs/progressing/to-verify.md`.
- Reminder branch: AppleScript listed Reminder lists but no `Personal AI` list; the local Python EventKit binding was unavailable.

## Experience finding

As a user checking a Jira metric embedded back into a page, I can see the AR value but cannot tell whether it is a current result, an older `lastResult`, or a refresh already in flight. The existing spinner is too small and only implies activity; it does not say that the visible value remains historical until Memory Service / OpenClaw confirms a new result.

## Improvement plan

1. Add a compact AR result state to the always-visible badge: `旧`, `刷新中`, or `失败`.
2. Add a visible result-basis line to visual overlays so media targets explain whether the displayed value is historical, pending, failed, or current.
3. Keep DOM replacement, visual overlay placement, manual refresh, remove, and ON/OFF behavior unchanged.
4. Extend the AR Data E2E to cover stale visual overlays and an auto-refreshing stale text binding with a delayed AgentTask response.
5. Update the feature doc with the result-basis receipt contract.

## Validation target

- `node --check tools/verify-ar-data-overlay-e2e.mjs`
- `npm start` until first successful compile, then stop it.
- `npm run verify:ar-data-overlay:e2e`
- scoped `git diff --check`
