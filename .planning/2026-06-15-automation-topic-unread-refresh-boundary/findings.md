# Topic Messages Unread Refresh Boundary Findings

## Requirements

- Pick a random feature from `docs/index.md`.
- Check that docs match current code.
- Search similar product and research references.
- Implement unfinished or low-decision improvements when practical.
- Inspect for defects, blocked operations, design issues, and UX path problems.
- Check local `Personal AI` Reminders feedback and complete relevant items when used.
- Plan first, then implement, then validate as completely as practical.

## Initial Findings

- `docs/progressing/to-verify.md` says `暂无。`; there is no carry-over verification item.
- Automation memory shows recent completed runs for Agent Workflow, Rehearsal, Doubao, Action Queue, Memory Coverage, Relationship Radar, Scheduled Messages, and Task Scheduler; this run avoids those families.
- Random eligible candidates returned `主题式未读阅读` first, so the selected feature family is Topic Messages.
- Local Reminders list names are readable, but none is named `Personal AI`; no Reminder item can be incorporated or marked done in this run.
- The repo worktree is already very dirty across many feature families. Treat existing changes as user/automation-owned and keep this run scoped.

## Code And UX Findings

- `docs/features/topic_based_messages.md` is broadly current for Topic list/read/defer/mute/search/deep-link behavior. It already describes unread queue receipts, local defer/mute boundaries, participant filtering, trusted source links, and deep-link read-sync receipts.
- Main implementation files inspected: `src/modals/memory-store.ts`, `src/modals/components/EntityListPage.vue`, `src/modals/topic-detail-data.ts`, `src/modals/topic-list-search.ts`, `src/modals/topic-triage.ts`, `src/modals/topic-unread-preview.ts`, and `tools/verify-topic-based-messages*.`
- UX defect found: `memory-store.loadEntitiesByType()` silently falls back to generated mock entities when `GET_ENTITIES_BY_TYPE` fails or returns unsuccessful. For Topic Messages, that can display fake unread topics and fake read/defer/mute state, which violates the product's no-fake/no-claimed-state boundary.
- Bounded improvement candidate: for `Topic` entity-list load failures, keep an existing same-type snapshot only if one was already loaded, mark it as stale/failed, and never generate mock Topic unread data. On first failure, show a clear load-failure empty state instead of `暂无主题数据` or `所有主题都已阅读完毕`.

## External Reference Findings

- Slack Unreads supports filtering unread messages, undoing accidental mark-read, and refreshing for new unread batches; this reinforces that unread views should distinguish current confirmed state from pending refresh/freshness.
- Gmail Snooze temporarily removes a message from inbox and returns it at the chosen time; this supports the current local defer model, but also makes state provenance/freshness important.
- Zulip reading strategies and Recent conversations separate unmuted, muted/followed, unread, participated, and participant filters; Topic Messages is aligned with this, but should not let a failed data load look like a valid filtered state.
- Microsoft Research's CHIIR 2019 email triage work frames triage as deciding what to do with unhandled messages; fake Topic data would corrupt that decision point.
- Email deferral research reports deferral is common in enterprise triage and includes strategies such as marking unread/flagging; this supports keeping defer/mute separate from read state and making failure boundaries explicit.
- Intelligent notification systems research highlights interruption cost and the need to filter uninteresting/irrelevant notifications; this supports conservative Topic unread refresh behavior over noisy fabricated results.

## Resources

- Feature index: `docs/index.md`
- Selected feature doc: `docs/features/topic_based_messages.md`
- Slack Unreads: https://slack.com/help/articles/226410907-View-all-your-unread-messages
- Gmail Snooze: https://support.google.com/mail/answer/7622010
- Zulip reading strategies: https://zulip.com/help/reading-strategies
- Zulip Recent conversations: https://zulip.com/help/recent-conversations
- Email Triage: Challenges and Opportunities: https://www.microsoft.com/en-us/research/publication/email-triage-challenges-and-opportunities/
- Characterizing and Predicting Email Deferral Behavior: https://arxiv.org/abs/1901.04375
- Intelligent Notification Systems survey: https://arxiv.org/pdf/1711.10171
