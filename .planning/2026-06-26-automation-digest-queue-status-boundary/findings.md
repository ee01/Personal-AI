# Notification Center Digest Queue Status Boundary Findings

## Repo Findings

- `docs/progressing/to-verify.md` currently says there are no pending verification items.
- `docs/features/index.md` lists `DigestQueueService 本地摘要` as a Notification Center feature implemented by the extension-local digest queue.
- `docs/features/notification_center.md` already correctly separates service-side Notification Center from extension-local `DigestQueueService`.
- Current code already preserves queue safety: `DigestQueueService.processTask()` keeps items when notification delivery fails, and waiting items remain queued when they are not due.
- Current popup presentation uses `formatDigestQueueStatusSummaryForUi()` to collapse total items, due count, earliest release, task breakdown, and no-send boundary into one long text line. The queue is safe, but the UX is hard to scan when due and future items coexist.
- Existing targeted coverage lives in `tools/verify-digest-queue-service.ts`; it already asserts the pending queue status summary and can be extended without adding a new harness.

## Reminder Findings

- AppleScript list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be applied or completed.

## External Reference Findings

- Google Calendar notification docs distinguish reminder alarms from notifications about event changes, supporting clear labels for what kind of alert is being shown: https://developers.google.com/workspace/calendar/api/concepts/reminders
- Slack reminder docs emphasize setting a specific date/time and managing reminders, supporting a visible "when will this return" path: https://slack.com/help/articles/208423427-Set-a-reminder
- Zapier Zap history exposes workflow runs and task usage for troubleshooting, supporting status/history surfaces for automation queues: https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history
- Notification batching research reports that three daily batches can improve attention and sense of control compared with continuous delivery, but full suppression can increase anxiety/FoMO; this supports batching plus transparent pending state: https://scholars.duke.edu/display/pub1402953
- Notification-interruption research shows reducing notification-caused interruptions benefits performance and strain, supporting a local delayed digest rather than immediate sends: https://pmc.ncbi.nlm.nih.gov/articles/PMC10244611/

## UX Gap

The popup should make the local digest queue readable at first glance: total pending items, due-now count, earliest future release, per-task breakdown, and the non-effect boundary should be separate UI rows. This is a presentation-layer fix; the existing queue semantics are correct.
