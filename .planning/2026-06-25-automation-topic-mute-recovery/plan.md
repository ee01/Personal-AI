# Topic Messages mute recovery plan

## Target

- Random feature: `Topic Messages -> 主题静音`
- Canonical doc: `docs/features/topic_based_messages.md`
- Main surfaces: `src/modals/components/EntityListPage.vue`, `src/modals/memory-store.ts`, `tools/verify-topic-based-messages-e2e.mjs`

## Context checked

- `AGENT.md` verification policy.
- `docs/progressing/to-verify.md`: no carry-over items.
- Automation memory: avoid freshest feature families.
- Local Reminders: `NO_PERSONAL_AI_LIST`, so no Reminder item can be applied or completed.
- Existing docs/code: mute/defer are local browser state; unread is preserved; no backend or original chat writeback.
- External scan:
  - Slack Later keeps deferred items in a dedicated recoverable place.
  - Zulip muted topics are hidden from primary unread/feed surfaces but recoverable by explicitly including muted topics.
  - Email triage and deferral research treats later/mute decisions as normal overload handling, not read completion.
  - Notification interruption research supports reducing interruptions while keeping recovery clear.

## User-experience gap

After a user mutes a topic, the short undo toast explains the trust boundary. Once that toast disappears, the persistent muted card only says the topic is muted. A real user returning later has to infer that unread was preserved, that the state is only local, and that `取消静音` is the recovery path.

## Implementation steps

1. Add a persistent muted-card helper line that says unread is preserved, the mute is local, and `取消静音` restores the topic to the unread flow.
2. Keep the existing storage and filtering behavior unchanged.
3. Extend the topic E2E to assert the persistent helper line before and after reload.
4. Update the canonical topic feature doc with the new persistent recovery boundary.
5. Run targeted verifier, webpack dev compile, E2E, and scoped whitespace checks.
