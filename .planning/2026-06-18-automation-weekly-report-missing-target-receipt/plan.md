# Weekly Report Notification Target Receipt Plan

Goal: improve `周报与梦境摘要推送` by making the weekly-report notification landing page honest when the report file referenced by the notification can no longer be read.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read automation memory, repo guidance, feature index, `to-verify`, Reminders list state, and prior planning context |
| 2 | completed | Inspect Notification Center docs, Reports/Dream pages, backend notification routing, and existing weekly-report E2E |
| 3 | completed | Check current product/research references for low-interruption digests and notification triage |
| 4 | completed | Implement the missing report target receipt and fallback selection |
| 5 | completed | Update docs and E2E coverage |
| 6 | completed | Run targeted verification, first dev compile, E2E, and diff checks |
| 7 | pending | Update automation memory and archive when available |

## Decisions

- Selected feature: `周报与梦境摘要推送` / Notification Center.
- Source doc: `docs/features/notification_center.md`.
- Reminder branch: Reminders is readable, but no visible list named `Personal AI` exists, so no Reminder item can be incorporated or marked done.
- Implementation slice: mirror the Dream Digest missing-file behavior for weekly reports. If a notification deep-link points to a missing report, show a visible read receipt and fall back to the latest available report instead of trapping the user on a synthetic missing item.
- Boundary: this is a read-only report-page fallback. It must not regenerate reports, create Notification Center records, write channel delivery receipts, send Bot/Chrome/Doubao notices, or change global notification handling state.

## External Notes

- Slack Activity and Teams-style activity feeds support treating notifications as triageable queues with filters and clear state.
- Apple Scheduled Summary and notification batching research support low-interruption summaries, but those summaries must remain predictable and recoverable.
- Microsoft Viva digest opt-out patterns reinforce that digest delivery target/availability must be user-visible rather than hidden behind copy.

## Verification

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/__tests__/backendNotifications.test.ts` passed, 15/15.
- `npm start` reached first successful webpack dev compile and was stopped.
- `node tools/verify-weekly-report-notification-e2e.mjs` passed for normal and missing report notification deep-links.
- `npm --prefix memory-service test -- --run src/__tests__/weeklyReporter.test.ts src/__tests__/notificationCenter.test.ts` initially exposed a date-sensitive Dream Digest fixture; after changing the fixture to use the current date, it passed, 24/24.
- Scoped `git diff --check` passed for touched files, and no webpack watch process remained.
