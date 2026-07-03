# Scheduled Messages status toggle receipt plan

## Target

- Random feature: `Scheduled Messages -> 列表状态动作`
- Canonical doc: `docs/features/scheduled_messages_manager.md`
- Main surfaces: `src/scheduled-messages/ScheduledMessagesManager.tsx`, `tools/verify-scheduled-messages-status-actions-e2e.mjs`

## Context checked

- `AGENT.md` validation policy.
- `docs/progressing/to-verify.md`: no carry-over items.
- Automation memory: avoid freshest feature families; `Scheduled Messages` was the remaining feasible candidate after excluding recent exact targets.
- webpage-mcp: available for HTTP(S) tabs, but `scheduled-messages.html` is a Chrome extension page, so the practical full-experience path is the unpacked-extension Playwright harness.

## User-experience gap

As a user managing scheduled message rows, clicking the inline pause / resume button performs a real state change in `Messages`, may also touch Jira Rule state, and may sync an Outreach runtime template. Before this change, the success path only changed the row state; it did not leave a durable receipt explaining what wrote, what downstream sync was confirmed, and what did not happen.

## Implementation steps

1. Add a persistent `定时消息状态回执` after successful pause / resume.
2. Include the `Messages` row state transition plus Jira Rule and Outreach runtime sync status when applicable.
3. Preserve existing behavior: no immediate send, no Logs mutation, no PendingReview approve/reject bypass, no direct Done reactivation.
4. Treat Outreach mirror failure after a Sheet state write as a warning receipt instead of losing the real write boundary.
5. Extend the status-actions E2E and update the canonical feature doc.

## Validation plan

- Run the focused status action unit test.
- Run `npm start` until the first successful dev compile, then stop it.
- Run the status-actions unpacked-extension E2E.
- Run scoped `git diff --check`.
