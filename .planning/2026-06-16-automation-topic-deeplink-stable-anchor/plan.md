# Topic deep link stable anchor plan

## 目标

随机命中的功能是 `Topic Messages` / `主题详情深链定位`。本轮只处理 `?messageId=` 从未读预览或外部链接进入主题详情时的定位可靠性，不扩展到后端历史补拉或跨设备 read-status API。

## 代码与文档现状

- `docs/features/topic_based_messages.md` 已经描述深链会切到聊天记录、清空筛选、展开目标讨论、显示定位回执，并说明当前只定位详情 payload 里已返回的消息。
- `src/modals/components/TopicDetailPage.vue` 已经有 `messageFocusNotice`、上下文消息高亮、读状态同步和失败回执。
- `src/modals/topic-detail-data.ts` 已经能从 `message_id`、URL query、hash 和 URL path tail 提取消息身份。
- 发现的缺口：父聊天记录没有稳定 ID、只能靠上下文消息 ID 定位时，组件仍可能用 `conversation-${index}` 作为父讨论 render id。定位后如果 `markConversationAsRead()` 改变未读排序，index 会变化，展开态和高亮锚点可能丢失。

## 外部参考

- Microsoft Teams deep links and copied message links show that a message link should bring the user back to a specific chat/message context: https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-link-teams
- Zulip documents permanent links to messages/topics/channels; message links should survive topic moves and remain a stable anchor: https://zulip.com/help/link-to-a-message-or-conversation
- Email/message triage research (`Go with the Flow`) identifies glance/scan/defer behavior, reinforcing that unread/deep-link views should preserve context while the user decides whether to read now or later: https://www.cs.ubc.ca/sites/default/files/tr/2005/TR-2005-22_0.pdf

## 实施步骤

1. 在 `topic-detail-data.ts` 增加 `getTopicConversationRenderIdentity()`：优先父消息身份，其次上下文消息身份，最后才退回 `conversation-${index}`。
2. 让 `TopicDetailPage.vue` 的 `getConversationRenderId()` 使用该 helper，使 deep link 展开、高亮和 DOM scroll 使用同一稳定锚点。
3. 在 `tools/verify-topic-based-messages.ts` 增加父讨论无 ID、上下文 ID 稳定 render identity 的 targeted 校验。
4. 更新 `tools/verify-topic-based-messages-e2e.mjs` 的 legacy deep-link 断言，证明无父 ID 的上下文 deep link 不再依赖排序 index。
5. 更新 `docs/features/topic_based_messages.md`，保持文档简洁但写清这个边界。

## 验证计划

1. `npm run verify:topic-based-messages`
2. `npm start` 等首次 webpack dev compile 成功后停止
3. `npm run verify:topic-based-messages:e2e`
4. `git diff --check -- <本轮涉及文件>`
