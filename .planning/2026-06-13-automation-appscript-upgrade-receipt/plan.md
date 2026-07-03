# App Script upgrade receipt plan

## Target

- Feature: Scheduled Messages / App Script 自动更新
- Source doc: `docs/features/scheduled_messages_manager.md`
- Main code: `src/scheduled-messages/ScheduledMessagesManager.tsx`, `src/scheduled-messages/AppScriptUpdater.ts`

## Current findings

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is reachable, but there is no `Personal AI` list on this Mac, so no Reminder item can be merged or marked done.
- The updater already fails closed for the important mutation risks: anonymous `getVersion`, Web App deployment matching, Personal AI project ownership, Project History capacity, post-deployment version verification, and rollback.
- The UX gap is after the user starts the upgrade: result details are shown in blocking alerts and can disappear after the page refresh/re-initializes. A user who needs to recover from Project History, deployment mismatch, or version verification failure has to remember the alert.

## External signals

- Google Apps Script versions are immutable snapshots and deployments point to a version; update flows should keep these concepts separate and confirm which deployment is served.
- Apps Script projects have a 200-version cap, so upgrade UX should keep Project History capacity and cleanup paths visible.
- Zapier-style automation products expose run history, replay status, and summaries rather than relying on transient alerts.
- Trigger-action debugging research emphasizes that end users need explicit why/why-not explanations and recovery paths for automation failures.

## Implementation steps

1. Add a dismissible App Script upgrade receipt banner using the existing notice visual language.
2. Include result status, mutated/skipped boundaries, App Script recovery URL when available, and next step.
3. Keep the existing alert/confirm path for compatibility, but make the visible page state durable after dismissal.
4. Extend `verify:appscript-auto-update` with source assertions for the new receipt contract.
5. Extend the App Script auto-update E2E to perform an upgrade in the Project History near-limit state and assert the visible receipt.
6. Update `docs/features/scheduled_messages_manager.md` to describe the post-upgrade receipt behavior.
7. Verify with targeted script, first successful `npm start`, E2E, and scoped `git diff --check`.
