# Watch Button Boundary Findings

## Repo Findings

- `docs/features/message_reaction.md` documents Watch creation, save, index readiness, management snapshot, hit status, and cancellation boundaries.
- `src/message-reaction/followThreadPresentation.ts` already builds downstream creation/save/list/status/cancel receipts.
- `src/message-reaction/MessageReactionUI.ts` only special-cases the Openclaw toolbar button in `getToolbarActionBoundaryLabel()`. Watch falls through to the plain visible label, so its `title` and `aria-label` do not expose pre-click consequences.
- `desktop-app/scripts/message-reaction-toolbar-check.mjs` already checks toolbar DOM labels and the config-page Watch boundary, making it the right verifier to extend.

## Reminder Check

- EventKit access granted.
- `Personal AI` list found.
- Total items: 4.
- Incomplete items: 0.
- No Reminder item applies to this run and nothing needs to be marked done.

## Industry / Research Signals

- Microsoft Teams Followed threads separates manual follow, central followed-thread view, unread filtering, unfollow, and global/channel settings: https://support.microsoft.com/en-us/teams/teams-channels/follow-threads-in-microsoft-teams
- Slack reminders can be created from a message and managed later with complete/edit/delete actions: https://slack.com/help/articles/208423427-Set-a-reminder
- AI-powered collaborative reminders need clear interaction expectations for asynchronous work: https://www.microsoft.com/en-us/research/publication/ai-powered-reminders-for-collaborative-tasks-experiences-and-futures/
- Multi-party chat thread detection is inherently ambiguous because simultaneous topics interleave, so Watch should keep matching routes and confidence boundaries visible: https://aclanthology.org/D19-1682.pdf

## Decision

Implement a presentation/accessibility-only fix at the toolbar button. This closes the exact remaining user-experience gap without widening Watch behavior.
