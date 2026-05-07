# 主题式消息阅读系统

## 功能定位

主题式消息阅读把分散的消息、网页和资源按 `Topic` 聚合，让用户从“哪些主题还有新内容”开始阅读，而不是逐条翻原始聊天记录。

当前入口：

- 首页概览：`src/modals/components/OverviewPage.vue`
- 主题列表：`src/modals/components/EntityListPage.vue` 的 `/entity/Topic`
- 主题详情：`src/modals/components/TopicDetailPage.vue` 的 `/topic/:id`
- 状态管理：`src/modals/memory-store.ts`

## 当前实现

主题实体主要依赖这些字段：

```ts
interface TopicReadStatus {
  isRead?: boolean;
  unreadCount: number;
  lastReadTime: number | null;
  lastUpdateTime: number;
}
```

阅读状态在实体上通过 `readStatus` 表示；未读预览通过 `unreadDiscussions` 展示。聊天记录当前主要来自 `recentDataDetails.conversations`，store 也兼容旧的 `relatedData.conversations`。

核心交互：

- 首页“未读主题推送”按热度展示主题，点击主题只进入详情，不会自动清空未读。
- 主题列表默认显示“仅未读”，支持切换到“全部主题”、“稍后”和“静音”视图，支持按最新消息、热度、未读数量排序。
- 主题卡片上的“已阅”只处理对应主题的已读状态，并在短时间内提供“撤销”；“稍后”会先让用户选择 1 小时后、今天晚些时候、明天上午、下周一或自定义时间，再把主题临时移出未读流，但不修改已读状态。
- “静音”用于降噪，支持静音 1 天、1 周或直到手动恢复；静音主题会从未读流隐藏并进入“静音”视图，不会被标记为已读。
- 今日概览卡片右上角的 `×` 只表示“今日不再显示”，不会伪装成已读操作。
- 主题详情展开某条聊天上下文时，自动标记该条消息已读，并提供短时间撤销；“全部已阅”会标记当前主题已读，并提供短时间撤销。
- 主题详情支持 `?messageId=` 深链：进入后自动切到聊天记录、展开对应讨论、短暂高亮并把该讨论标记为已读；如果当前详情数据没有这条消息，会显示提示并回到全部聊天记录。
- 主题详情里的聊天记录如果带有可信的 `teamUrl` / `sourceUrl` / `permalink` / `url`，会展示“来源”链接，便于从聚合视图追溯到原始消息。
- 主题详情里的聊天搜索覆盖摘要、发送者、群组、上下文消息和来源字段；命中上下文时会在聊天条目上提示，避免用户搜索到结果却不知道为什么匹配。
- 主题详情里的相关项目、资源和 Ticket 当前是只读引用面板；尚未接入编辑/新增/解绑 API 的操作不会展示成可点击按钮。
- 聊天摘要和上下文在高亮搜索词前会先做 HTML 转义，避免消息正文中的标签被当作页面内容执行。

## 持久化与同步

前端标记已读后会发送 `CACHE_ENTITY` 消息，把更新后的实体交给 `memory-exploring-messageHandler.ts`。当前后端还没有专用的 read-status mutation API，所以这是一个兼容式同步路径。

今日卡片关闭状态只保存在浏览器 `localStorage`，按自然日重置。

主题“稍后处理”也保存在浏览器 `localStorage`，到期后会重新回到未读流；用户也可以在主题列表的“稍后”视图手动恢复。快捷时间由 `getTopicDeferPresetOptions()` 生成：1 小时后、今天 18:00（如果已过则明天 09:00）、明天 09:00、下周一 09:00；列表和首页还支持输入任意未来日期时间。

主题“静音”保存在浏览器 `localStorage`，到期后会自动重新回到未读流；永久静音需要用户在“静音”视图手动恢复。快捷时间由 `getTopicMutePresetOptions()` 生成：1 天、1 周、一直静音。

主题整组已阅和单条讨论已阅的撤销状态只保存在当前前端会话里，默认保留约 10 秒；撤销时会恢复主题 `readStatus`、未读预览和已知聊天记录的读取状态，并通过现有 `CACHE_ENTITY` 路径同步。

主题详情的数据读取由 `src/modals/topic-detail-data.ts` 做轻量归一化，优先读取 `recentDataDetails`，并兼容旧的 `relatedData`、顶层 `relatedProjects` / `relatedResources` / `relatedTickets` / `webpages` / `conversations` 字段。详情接口成功但没有返回数据时会走 mock 详情兜底，避免旧实体或本地验证环境打开详情时空白或阻塞。已读同步也会兼容顶层 `conversations` / `latestConversations`，并能用上下文消息 id 清理对应未读预览；如果某个列表态主题没有能绑定到该消息的 conversation 或 unread preview，不会被误扣未读数。

## 业内参考

这类功能更接近“消息/信息 triage”，而不是普通搜索页：

- Slack Unreads 支持按未读聚合、排序过滤、批量已读和撤销，说明已读操作需要低成本且可恢复。
- Slack Later 和 Gmail Snooze 把“已读”和“稍后处理”拆成两种心智，并支持自定义回到视野的时间，避免用户用未读状态当待办清单。
- Gmail 的 Unread first / Priority Inbox 说明未读视图需要和重要性排序共存。
- Feedly AI Mute Filters 的价值在于降噪；主题阅读后续也应提供静音、隐藏低价值主题的能力。
- Notion AI Connectors 强调来源引用和权限边界；主题聚合页后续展示 AI 摘要时，也应该保留可追溯来源。

相关研究给出的启发：

- Email triage 研究反复指出，未读数只是压力信号，用户真正需要的是快速判断“是否要处理、何时处理”。
- unread email prioritization 研究显示用户常被“紧急”信号驱动，主题排序不能只看数量，还要结合重要性和时效。
- attention management 研究建议把低优先级通知延后或降级呈现，避免每条新内容都争抢注意力。
- short-text topic modeling 研究提醒：聊天消息很短，单条消息聚类不稳定，主题聚合应更多利用上下文、参与者、项目和历史实体关系。

## 当前限制

- `GET_ENTITIES_BY_TYPE` 返回的主题列表可能没有完整 conversation 明细，未读数以实体 `readStatus` 为准。
- `CACHE_ENTITY` 仍是通用实体缓存/ingest 路径，不是精确的 read-status API。
- 未读预览如果没有绑定 message id，只能在整主题已读时清空，无法精确移除单条预览。
- 稍后处理和静音目前是本机浏览器状态，还没有同步到后端。
- 相关项目、资源、Ticket 只读展示，暂不支持在主题详情里手动增删关系。
- `?messageId=` 只能定位到当前详情数据里已返回的讨论；如果后端详情接口没有带出该消息，前端会提示但不会额外补拉。

## 建设性改进方向

1. 增加专用 API：`PATCH /entities/:id/read-status` 和 `PATCH /entities/:id/conversations/:messageId/read-status`，避免用实体 ingest 承担读状态同步。
2. 给“稍后处理”和“静音”补跨设备同步，避免只依赖当前浏览器。
3. 给静音主题补原因或规则来源，例如“低相关度”“重复讨论”“暂不关注”，方便后续做自动降噪建议。
4. 给未读预览补稳定 `messageId` 和来源类型：支持单条消息已读后精确移除对应预览，也能在 AI 摘要中显示可追溯来源。
5. 后端排序可同时考虑未读数、重要性、时效和用户对静音/恢复的反馈，避免只按热度推送噪声主题。

## 验证

主题读状态的 targeted 验证脚本：

```bash
npm run verify:topic-based-messages
```

运行时代码改动后仍需按 `AGENT.md` 运行 `npm start`，等待首次 webpack 编译成功后停止。
