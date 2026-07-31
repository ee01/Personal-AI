# Findings

## Repo

- `docs/progressing/to-verify.md` is empty.
- Root `task_plan.md` and `.planning/.active_plan` both point to completed/stale work, so this run uses a dedicated planning directory.
- Native Join source of truth:
  - `src/ringcentralNativeJoin.ts`
  - `src/contentScriptRingCentralVideoHome.ts`
  - `src/contentScriptGlip.tsx`
  - `tools/verify-ringcentral-native-join-e2e.mjs`
  - `docs/features/meeting_native_join.md`
- Current fallback panel already has strong post-click receipts and button boundaries. The remaining UX gap is before click on RingCentral Video Home: the native interception is not visible on the actual Join button until after Personal AI has already launched the app handoff.

## Reminders

- AppleScript listed local reminder lists but not `Personal AI`.
- EventKit fallback found `Personal AI` with 4 total items and 0 incomplete items.
- Existing completed items are about Doubao sync, Weekly Dream Digest detail sync, and local app log/sync issues. None are related to Native Join, RingCentral app handoff, browser fallback, Meeting ID/passcode recovery, or default join preference.

## External References

- RingCentral support says users can join RingCentral video meetings from desktop, web, mobile apps, and a web browser. This supports keeping browser recovery explicit even when app-first is preferred.
- Zoom support documents cancelling the app prompt and using "Join from your Browser". This supports app prompt plus browser fallback as a normal recovery path.
- Microsoft Teams documents joining with meeting ID/passcode from web or in-product entry points. This supports keeping manual Meeting ID/passcode recovery visible and scoped.
- USENIX Security 2017 deep-link research treats custom app links as a security-sensitive handoff with hijacking/uncertainty risks. This supports labeling native app launch as attempted but not verified.

## Improvement Plan

- Annotate validated RingCentral Video Home Join buttons with a dynamic `title` / `aria-label` before click.
- Boundary copy should say Personal AI will try the RingCentral app first using the validated full meeting link, Chrome may ask to open RingCentral, browser recovery stays available, hidden URL details stay hidden until explicit recovery action, and the click does not confirm joining, copy materials, or change default join path.
- Restore original button title/ARIA when the button is no longer a validated Native Join target or native join is disabled.
- Prove it in `tools/verify-ringcentral-native-join-e2e.mjs` before the click, then keep existing post-click proof intact.
