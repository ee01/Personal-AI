# Findings

## Repo State

- `docs/progressing/to-verify.md` is empty.
- Automation memory recently covered Agent Thinking approval queue, Notification digest push, User Profile load-all, Storyline target handoff, Meeting Pilot RC transcript, Reflection evidence adoption, Watch, Quick Ask, and Scheduled Messages queue actions. This run intentionally avoids those exact targets.
- The worktree was already broadly dirty before this run; keep changes scoped to Auto Reply review UX and matching docs/tests.

## Reminders

- AppleScript listed several reminder lists but did not show `Personal AI`.
- EventKit read access was granted and found `Personal AI` with 4 total items, all completed.
- No incomplete Reminder item is related to Auto Reply, PendingReview, reply approval, scheduled-message review, or Message Reaction.

## Existing Auto Reply Behavior

- Feature docs already describe toolbar launch, prefill loading/failure/ready receipts, pre-save rule boundary receipts, content readiness, AI fallback/skip behavior, and aggregate delivery receipts.
- `ScheduledMessagesManager.tsx` already blocks generic pause/resume toggles for `PendingReview` rows and exposes approve/reject buttons.
- Current `buildAutoReplyReviewReceipt` only says approve changes the row to `Active` next minute and reject marks it `Done`; it does not show the current body/schedule/method snapshot directly at the approval boundary.

## External Scan

- Gmail / Google Smart Reply and the Kannan et al. Smart Reply paper frame generated replies as suggestions, not silent sends; this supports putting current generated text in front of the user before execution.
- Microsoft Outlook suggested replies documentation says users can edit before sending; this reinforces editable/reviewable answer copy before send.
- Intercom Fin human-in-the-loop approvals pause high-risk procedures until a teammate acts; this supports treating `PendingReview` as a visible approval gate with clear action effects.
- Microsoft Human-AI interaction guidelines emphasize state clarity, feedback, and recovery when AI is wrong; the review row should say what is snapshot vs what will be written.
