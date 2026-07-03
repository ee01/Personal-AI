# Glip AI Marker Research Notes

- Slack reminders and Later keep saved/reminded items recoverable from `Later` / `In progress`, where users can complete, edit, or delete reminders. Takeaway: a message marker should point users to the management surface, not only describe the badge.
- Gmail Snooze temporarily removes an email from Inbox and brings it back at the chosen time. Takeaway: deferred work is a state with a return path and timing, not just a static label.
- Microsoft Teams recap/follow-up patterns keep AI notes, recommended tasks, and thread follow state anchored to a reviewable Teams surface. Takeaway: AI-derived follow-up markers should say where the source/session can be reviewed.
- MobileHCI 2018 snooze research studies user-defined deferral to a duration or point in time and reissues notifications later. Takeaway: deferral UI should preserve both due timing and recovery route.

## This Run's UX Decision

Glip AI markers already expose status meaning, source, cache freshness, and local-snapshot boundaries. The constructive next improvement is a `下一步 / Next step` line in tooltip and `aria-label`:

- Snooze: manage completion, reschedule, or deletion in Scheduled Messages.
- Outreach follow-up: review the Outreach session for goal satisfaction or next checks.
- Scheduled execution log: verify delivery and failures in Scheduled Messages logs.
- Watch markers: manage local watch rules in Follow Threads.

This keeps the content script read-only and avoids live remote polling from the RingCentral page.
