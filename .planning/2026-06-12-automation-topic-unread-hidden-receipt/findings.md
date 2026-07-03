# Findings

## Repository

- `docs/progressing/to-verify.md` says `暂无。`.
- The working tree was already broadly dirty before this run.
- `docs/features/topic_based_messages.md` already documents local Later/Mute state and verification commands.
- `EntityListPage.vue` currently shows `✅ 太棒了！所有主题都已阅读完毕` whenever the `仅未读` view has no visible topics. This is misleading when unread topics are hidden by local Later/Mute state.

## Reminders

- AppleScript Reminders list probe succeeded.
- Lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No `Personal AI` list exists, so no Reminder items were incorporated or marked done.

## External References

- Slack Unreads separates read, later/skip, and undo actions.
- Zulip topic mute hides muted-topic unread messages from main feeds/counters unless explicitly included.
- Microsoft Research email deferral paper frames deferred messages as pending tasks users need to revisit later, not as read/complete messages.
