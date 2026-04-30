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

- 首页“未读主题推送”按热度展示主题，点击主题会标记为已读并进入详情。
- 主题列表默认显示“仅未读”，支持切换到“全部主题”，支持按最新消息、热度、未读数量排序。
- 主题卡片上的“阅”按钮只处理对应主题的已读状态。
- 今日概览卡片右上角的 `×` 只表示“今日不再显示”，不会伪装成已读操作。
- 主题详情展开某条聊天上下文时，自动标记该条消息已读；“全部已阅”会标记当前主题已读。

## 持久化与同步

前端标记已读后会发送 `CACHE_ENTITY` 消息，把更新后的实体交给 `memory-exploring-messageHandler.ts`。当前后端还没有专用的 read-status mutation API，所以这是一个兼容式同步路径。

今日卡片关闭状态只保存在浏览器 `localStorage`，按自然日重置。

## 业内参考

这类功能更接近“消息/信息 triage”，而不是普通搜索页：

- Slack Unreads 支持按未读聚合、排序过滤、批量已读和撤销，说明已读操作需要低成本且可恢复。
- Slack Later 和 Gmail Snooze 把“已读”和“稍后处理”拆成两种心智，避免用户用未读状态当待办清单。
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
- 目前没有“稍后处理/静音主题/撤销已读”的完整 UX。

## 建设性改进方向

1. 增加专用 API：`PATCH /entities/:id/read-status` 和 `PATCH /entities/:id/conversations/:messageId/read-status`，避免用实体 ingest 承担读状态同步。
2. 拆分“已读”和“稍后处理”：已读用于清理信息流，稍后用于待办回访。
3. 增加主题静音：低价值主题可以静音一段时间，减少首页未读瀑布流噪声。
4. 增加撤销入口：批量已读后短时间允许 undo，降低误操作成本。
5. 给未读预览补 `messageId`：支持单条消息已读后精确移除对应预览。

## 验证

主题读状态的 targeted 验证脚本：

```bash
npm run verify:topic-based-messages
```

运行时代码改动后仍需按 `AGENT.md` 运行 `npm start`，等待首次 webpack 编译成功后停止。
