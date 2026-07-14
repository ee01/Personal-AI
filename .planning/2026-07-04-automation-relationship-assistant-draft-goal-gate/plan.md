# Relationship Assistant Draft Goal Gate

## Target

- Random feature: `人脉关系 Assistant Draft` in `docs/features/relationship_radar.md`.
- Carry-over check: `docs/progressing/to-verify.md` says no pending verification.
- Recent automation memory covered Project Dashboard, Message Analysis, Compose Assist, Jira, Task Scheduler, Doubao, Topic Messages, Coverage, Prompt Config, and Memory Lens; this target avoids those exact recent sweeps.

## Reminder State

- AppleScript Reminders list enumeration did not include `Personal AI`.
- EventKit found the `Personal AI` list with 4 items, all already completed historical Doubao / digest / sync feedback.
- No open or Relationship Assistant Draft-related Reminder item is incorporated or marked complete.

## External Scan

- Microsoft Copilot in Outlook and Google Gemini in Gmail both keep AI drafting in the composer/reply flow rather than as an automatic send path; Gmail also exposes personalized sources for draft context.
- Salesforce Einstein Relationship Insights positions relationship evidence as surfaced context for human action, not as an automatic relationship mutation.
- AI-mediated communication and Smart Reply research show generated language can change interpersonal perception and tone, so relationship-aware drafts need visible review and source boundaries before the user sends them.

## Plan

1. Add a local goal snapshot when an Assistant Draft successfully returns.
2. If the user edits `你要达成什么` after generation, show a `草稿目标变更回执` before the old draft body.
3. Lock old-draft copy while the current goal no longer matches the generated snapshot; keep the old draft visible only for comparison.
4. Re-enable copy only after regenerating for the current goal.
5. Update the Relationship Radar E2E to cover stale-goal lock, regeneration, and correct second request payload.
6. Update the canonical feature doc with the user-visible behavior.

## Validation

- `node --check tools/verify-relationship-radar-e2e.mjs`
- `npm run verify:relationship-radar`
- `npm start -- --progress` until first successful compile, then stop
- `npm run verify:relationship-radar:e2e`
- scoped `git diff --check`
