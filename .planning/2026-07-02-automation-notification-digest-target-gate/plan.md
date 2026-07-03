# Notification Digest Manual Target Gate

## Target

- Selected feature: `周报与梦境摘要推送`
- Feature doc: `docs/features/notification_center.md`
- Main UI: `src/options.tsx`
- E2E: `tools/verify-notification-digest-push-options-e2e.mjs`

## Inputs Checked

- `docs/progressing/to-verify.md` has no carry-over item.
- Automation memory shows recent exact targets in Prompt Config, Memory Capture, Scheduled Messages, Message Analysis, Memory Timeline, Jira Design Links, Agent Thinking, Meeting Pilot, Doubao, Skill Foundry, Native Join, and Rehearsal, so this run avoided those exact surfaces.
- Reminders: AppleScript did not list `Personal AI`; EventKit did. The relevant Weekly Dream Digest feedback item is already completed and notes the older payload-detail fix, so this run treats it as a regression constraint and does not mark it again.
- External scan: Apple notification summaries / Reduce Interruptions, Microsoft Viva digest controls, notification batching research, and intelligent notification research all point toward explicit target, timing, and non-effect receipts before sending summaries.

## Improvement Plan

1. Inspect current Options manual push behavior for Dream Digest and Weekly Report.
2. Fix the stale-target bug where clearing a custom group ID can fall back to the old saved group ID.
3. Add an in-section `手动门禁` receipt when the current visible target is `group` but the group ID is empty.
4. Keep backend generation, Notification Center writes, Bot delivery, and scheduling semantics unchanged.
5. Update the canonical feature doc with the blocked-request boundary.
6. Extend the existing E2E to prove blocked requests do not hit the backend and normal requests still work.

## Validation Plan

- `node --check tools/verify-notification-digest-push-options-e2e.mjs`
- `npm start -- --progress`, stop after first successful compile
- `npm run verify:notification-digest-push-options:e2e`
- Scoped `git diff --check`
