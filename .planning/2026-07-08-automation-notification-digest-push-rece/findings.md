# Findings & Decisions

## Requirements
- User asked for a random `docs/features/index.md` sweep: inspect code/docs, research comparable products and papers, check Reminders, plan first, implement, update docs, and run the strongest practical verification.
- Repository workflow requires `AGENT.md` first, `docs/progressing/to-verify.md`, automation memory, Reminder check, then a bounded feature improvement and focused verifier/E2E.
- Current `docs/progressing/to-verify.md` is empty.
- `.planning/.active_plan` pointed at a previous User Profile run and was stale.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items.

## Research Findings
- Selected random candidate: `周报与梦境摘要推送` under Notification Center.
- Current docs already describe manual push target gates: `none` should generate only, `group` requires a visible group id, pending receipts should replace stale result, and generated-but-partial delivery should show write/Bot rows separately.
- Current Options UI builds structured manual push receipts and blocks empty group targets before calling the backend.
- UX gap: after a successful/manual result, the receipt only shows the target used for that request. If the user changes the push target or group id afterward, the old receipt can be mistaken for the current visible config state.
- Microsoft Viva Digest supports user opt-out and opt-in controls, reinforcing that digest delivery should expose user-controllable scope.
- Apple notification summaries let users choose which apps are summarized and turn summaries on/off, reinforcing that summary scope is a visible preference, not just a backend result.
- Slack Activity exposes notification/reminder filters and clearing/mark-read actions, reinforcing that notification surfaces should distinguish visible queue state from processing state.
- Email batching/self-interruption research supports lower-interruption batching, but only when the cadence and state are understandable to the user.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a submitted-target snapshot to manual push receipts | Lets the result say what was actually submitted even if current controls later change. |
| Compare current controls at render time | Avoids changing backend contracts or storing extra global state while still warning about stale visible results. |
| Reuse the existing `.digest-push-receipt` component | Keeps the UI consistent and focused. |
| Extend the existing Options E2E | It already stubs weekly and dream push endpoints and verifies exact receipt copy. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Planning script was first run from the skill directory | Removed the misplaced plan and initialized the repo-local plan. |

## Resources
- docs/features/notification_center.md
- src/options.tsx
- tools/verify-notification-digest-push-options-e2e.mjs
- https://support.microsoft.com/en-us/viva/insights/digest-email
- https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios
- https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack
- https://www.microsoft.com/en-us/research/publication/email-duration-batching-and-self-interruption-patterns-of-email-use-on-productivity-and-stress/
