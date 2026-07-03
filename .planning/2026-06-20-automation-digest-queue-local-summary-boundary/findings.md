# DigestQueueService Local Summary Findings

## Requirements

- Pick one random feature from `docs/features/index.md`.
- Confirm docs match current code without over-detailing.
- Search comparable products and papers for constructive guidance.
- Identify and implement a no-extra-decision improvement if available.
- Review UX, code design, blocking bugs, and Reminder feedback.
- Test as completely as practical under `AGENT.md`.

## Initial Discovery

- `docs/progressing/to-verify.md` has no carry-over item.
- Random candidate accepted: `DigestQueueService 本地摘要` under Notification Center, source doc `docs/features/notification_center.md`.
- Local Reminder lists are: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be incorporated or marked done this run.
- Worktree is broadly dirty from prior work, including many feature docs and source files. Keep this run's diff scoped.

## Code And UX Notes

- `DigestQueueService` stores extension-local digest buckets in `chrome.storage.local`, exposes queue status snapshots, and is processed by `TaskScheduler`.
- Existing focused verifier: `tools/verify-digest-queue-service.ts`.
- Popup/task scheduler already display a digest queue summary, so the likely improvement surface is status clarity rather than another configuration page.
- Current popup summary includes count, due count, earliest release, source breakdown, and schedule breakdown.
- UX gap: the summary can still read like the queue is part of Notification Center or will be pushed immediately. It needs an explicit local/delayed/no-write/no-send boundary next to the status.

## External Reference Findings

- Slack notifications let users choose notification scope and schedules; outside the schedule, notifications pause. This supports predictable low-interruption timing.
- Microsoft Teams lets users set missed-activity summary email frequency and uses quick views that do not change notification settings. This supports separating "view/filter state" from "notification behavior changed".
- Iqbal and Bailey's CHI 2008 work found breakpoint scheduling can reduce frustration and reaction time compared with immediate delivery. This supports delayed digest release when the timing is explainable.
- Mehrotra and Musolesi's intelligent-notification survey frames notification timing as context/preference-aware delivery; the product implication here is to show why a digest waits and what will not happen until release.

## Resources

- `docs/features/notification_center.md`
- `docs/features/index.md`
- `src/services/DigestQueueService.ts`
- `src/services/TaskScheduler.ts`
- `src/popup.tsx`
- `tools/verify-digest-queue-service.ts`
- `tools/verify-task-scheduler-api.ts`
- `tools/verify-task-scheduler-popup-filters-e2e.mjs`
