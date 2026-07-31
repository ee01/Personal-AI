# 主题式消息阅读系统

## 功能定位

主题式消息阅读把分散的消息、网页和资源按 `Topic` 聚合，让用户从“哪些主题还有新内容”开始阅读，而不是逐条翻原始聊天记录。

当前入口：

- 首页概览：`src/modals/components/OverviewPage.vue`
- 主题列表：`src/modals/components/EntityListPage.vue` 的 `/entity/Topic`
- 主题详情：`src/modals/components/TopicDetailPage.vue` 的 `/topic/:id`
- 状态管理：`src/modals/memory-store.ts`

## 大白话运行逻辑

主题阅读系统不是搜索，而是“把消息按主题收拢后帮用户处理未读压力”。系统根据 Topic 实体上的未读状态、最近讨论、资源和热度，把用户带到最需要看的主题，而不是要求逐条翻聊天。

结果主要受这些因素影响：

1. Topic 实体质量：消息、网页和资源能否正确归到同一个 Topic，是阅读体验的基础。
2. 未读信号：`readStatus.unreadCount`、`unreadDiscussions` 和明确 `isRead: false` 会共同决定是否进入未读流。
3. 最近更新时间和热度：排序会综合未读数、热度、最近更新和讨论量。
4. 本地状态：稍后处理、静音、今日不再显示和撤销状态目前多在浏览器本地保存。
5. 来源链接可信度：只有可信 http(s) 来源会展示成可点击链接，避免聚合页制造空跳转。

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
- 主题列表默认显示“仅未读”，支持切换到“全部主题”、“稍后”和“静音”视图，默认用“优先处理排序”综合未读数、热度、最近更新时间和讨论量；也可改按最新消息、热度、未读数量排序。
- 主题列表会持续显示“未读队列口径”回执，区分当前可处理未读、被本机稍后隐藏的未读、被本机静音隐藏的未读，并说明稍后/静音不会标记已读、不会同步后端或改写原始聊天平台。这样“仅未读”为空时，如果只是被稍后/静音隐藏，不会误报成所有主题都已读。
- 主题列表加载失败时不会生成示例 Topic 或示例未读。首屏失败会显示“加载失败 · 未确认”，说明未确认 Memory Service 的未读状态；如果是在已有 Topic 快照后刷新失败，会保留上次成功加载的主题并显示“刷新失败 · 上次快照”，避免把旧列表或空列表误当成当前真实状态。
- 优先处理排序会把低热度、超过 7 天没有更新且未读很多的主题标成“积压待整理”，并降低它挤占近期未读主题的权重；高热度旧主题仍可保留优先级。卡片会直接显示最多两个排序原因，例如“近期更新”或“积压超过7天”，不只依赖 hover 提示。
- 在主题列表页直接输入搜索词会先做本页快速过滤，匹配主题名称、描述、标签、参与者/来源人、未读讨论、聊天上下文、资源、项目、Ticket、网页标题和来源字段；页面会显示“本页过滤”回执，说明当前只查已加载主题和当前视图，稍后/静音主题仍按视图隐藏；点击搜索按钮仍走全局/后端搜索。这样用户记得一句未读消息、参与人或 runbook 链接时，不必先猜主题名，也不会把本地过滤误解成完整后端召回。
- 主题卡片会展示简短优先级提示，例如“优先处理”“多条未读”“近期更新”，鼠标悬停可看到排序原因。
- 主题卡片会在数据可用时显示参与者/来源人 chips，来源包括 `people`、`participants`、co-occurring Person 实体、聊天发送人和上下文消息发送人。这个提示只用于当前页识别和过滤，不代表完整成员列表。
- 主题卡片上的“未读”会直接进入详情页的“仅未读”聊天视图；“已阅”只处理对应主题的已读状态，并在短时间内提供“撤销”；“稍后”按钮在 hover / 读屏口径里先说明点击只打开本机稍后时间菜单，选择时间前不会写入、标记已读或同步；菜单会继续显示“稍后处理边界”，说明只写入本机浏览器状态、不标记已读、不同步 Memory Service 或原始聊天平台，然后才让用户选择 1 小时后、今天晚些时候、明天上午、下周一或自定义时间；确认后主题会临时移出未读流，并提供短时间“查看稍后”和“恢复”提示，两个按钮也会说明只是切换本页视图或删除本机稍后状态，用户可马上核对主题去了稍后视图，也可撤回误点。
- “静音”用于降噪，支持静音 1 天、1 周或直到手动恢复；静音时可选择“暂不关注”“低相关度”“重复讨论”作为原因。列表卡片的静音菜单会先显示“静音边界”，说明这只调整本机未读流和降噪过滤，不写回 Memory Service 或原始聊天平台；静音入口、原因、时长、查看静音和取消静音按钮都有 hover / 读屏边界，区分只打开菜单、只选原因、写入本机静音、切到静音视图和删除本机过滤。静音主题会从未读流隐藏并进入“静音”视图，不会被标记为已读，卡片会展示静音原因、恢复时间和持续可见的恢复边界，说明未读保留在本机静音视图、未同步且可点“取消静音”回到未读流。静音后顶部会短暂显示“查看静音”和“取消静音”，成功提示也会说明本机过滤、未读保留、未同步或标记已读；从提示或静音视图取消静音后，列表页会显示“取消静音回执”，说明只删除本机过滤、未读保留且没有同步或写回原始平台。
- 今日概览卡片右上角的 `×` 只表示“今日不再显示”，不会伪装成已读操作。
- 主题详情展开某条聊天上下文时，自动标记该条消息已读，并提供短时间撤销；如果用户正在“仅未读”视图里阅读，刚展开的讨论会临时保留在列表中，避免上下文在已读同步后立刻消失；“全部已阅”会标记当前主题已读，并提供短时间撤销。
- 主题详情页在当前主题仍有未读时，可以直接把这个主题“稍后处理”或“静音”。稍后处理复用主题列表的快捷时间；静音复用 1 天、1 周、一直静音和原因选择。两者都写入本地状态但不标记已读，并在详情页给出短时间恢复/取消静音提示，避免用户发现暂时不想处理或确认是噪声时必须先回列表再找同一个主题。详情页会持续显示“已稍后到 …（本机）”和“恢复未读”动作，避免 10 秒提示消失后看不出该主题已经被临时移出未读流；“稍后处理”、预设时间、“恢复未读”、“静音”、静音原因、静音时长和“取消静音”按钮都有 title / 读屏边界，区分打开菜单、选择原因、写本机状态和删除本机过滤；如果主题已经被本机静音，即使当前未读数为 0，详情页也会保留“取消静音”入口并提示未来未读仍会被本机过滤，避免永久静音只能去列表页找回；下拉菜单在点击具体时间/原因前会先显示处理边界，说明这只是本机未读流过滤，不会同步 Memory Service 或原始聊天平台。点击“恢复未读”或“取消静音”后，详情页会显示本地恢复回执，说明只删除本机稍后/静音过滤、未读信号保留、不会标记已读、不会同步 Memory Service 或写回原始聊天平台。
- 主题详情支持 `?readFilter=unread|read|all`，用于从主题列表直达未读阅读流；`?messageId=` 深链会自动切到聊天记录、解除搜索/状态筛选、展开对应讨论、短暂高亮并把该讨论标记为已读。路由层也接受 `message_id`、`conversationId`、`sourceMessageId`、`ts`、`thread_ts` 等 query 兼容别名；如果使用别名，定位回执会直接说明本次读取的是哪个参数。命中后页面会显示“消息定位回执”，说明命中的是父聊天记录还是上下文消息、筛选被临时重置、实际命中依据、以及是否通过当前实体缓存路径同步已读；如果这次定位确实触发了已读同步，回执内会直接提供“撤销这次已读”，不用只依赖顶部短暂 toast。高亮约 6 秒后淡出，但定位回执会保留到用户收起、撤销或打开新的深链，避免用户错过已读边界。如果当前详情数据没有这条消息，会显示“消息定位未完成”、实际请求锚点、未额外补拉/未同步/未写回边界和“查看全部聊天记录”恢复入口，不会改写已读状态。空白消息定位参数会显示“消息定位请求无效”，保留当前阅读视图并说明没有已读同步或历史补拉。深链和展开状态兼容 `id`、`messageId`、`conversationId`、`sourceMessageId` 以及常见导入数据里的 `message_id`、`conversation_id`、`source_message_id`；同一套 identity helper 也会识别 URL 编码后的 ID、来源 permalink 里的 `message_id` / `messageId` 等参数、hash 目标和像消息 ID 的 URL 末尾片段，并把 Slack permalink 的 `p<秒><微秒>` 片段与 `秒.微秒` timestamp 当成同一条消息，确保定位、DOM 高亮和已读同步不会各用一套规则；如果父讨论没有稳定 ID 但上下文消息有 ID，会优先用上下文消息 ID 作为父讨论渲染锚点，避免已读同步后排序变化导致展开或高亮丢失。
- 主题列表里的未读讨论预览会展示真实未读总量和当前预览数；如果后端 `readStatus.unreadCount`、`unreadDiscussions` 和已返回聊天记录里的显式 `isRead: false` 短暂漂移，列表和排序会保守采用更高的未读信号，避免旧实体或部分同步数据里的未读主题被隐藏。预览项带有稳定消息 id 时可直接跳到详情页对应聊天上下文，并复用 `?messageId=` 定位和已读同步路径。
- 主题列表本页搜索只过滤当前已加载的主题，不会静默补拉所有历史主题；需要跨全部记忆检索时，用户仍应点击搜索按钮进入后端召回结果页。
- 主题详情里的聊天记录如果带有可信的 `teamUrl` / `sourceUrl` / `permalink` / `url`，会展示“来源”链接并直接露出目标域名，便于从聚合视图追溯到原始消息；链接自身的 hover / 读屏说明会在点击前写清只打开外部标签页、不会重新读取来源、同步 Memory Service、标记已读、确认结论或写回原始平台。如果前面的候选是 `#`、非 `http(s)`、解析失败或带有 URL 账号信息，会继续检查后续字段，并可用上下文消息里的可信来源兜底。链接如果来自上下文消息会标成“上下文来源”并同样显示域名；如果同组里有候选被过滤但仍找到了安全兜底，链接旁会显示“候选已过滤”及主要原因，避免把 fallback 误读成全部候选都可信。只有不可信候选且没有可用兜底时才显示不可点击的“来源已隐藏”，并在徽标上说明隐藏数量和主要原因。
- 主题详情里点击可信聊天、资源或网页来源后，会在页内显示“来源打开回执”：只请求浏览器打开外部标签页，不会重新读取原始消息、网页或资源，不会同步 Memory Service、标记已读、确认结论或写回原始平台。
- 主题详情里的资源和网页记录只会把可信的 `http(s)` 地址展示成外部链接，并像聊天来源一样露出目标域名和预点击无副作用边界；如果候选链接为空、非 `http(s)`、格式无效或带账号信息，会显示“来源已隐藏”及可见原因，而不是把不可信 URL 明文展示或做成可点击入口。
- 主题列表卡片里的资源预览也只会打开可信的 `http(s)` 来源；点击前直接显示目标域名和“仅打开标签页”边界，不可信 URL 会显示隐藏原因而不露出 raw URL；打开后会在列表页显示“来源打开回执”，说明这只是请求浏览器打开外部标签页，不会重新读取原始消息、同步 Memory Service、标记已读或写回原始平台；没有可信链接的资源预览会进入主题详情，避免点击后没有反馈。
- 主题详情里的聊天记录会显示“未读 / 全部”计数，支持按阅读状态筛选，并把父消息或上下文消息任一未读的讨论排到前面；详情页未读数会从 `readStatus`、未读预览和已返回聊天记录共同推断，避免旧实体缺少 `readStatus` 时阻塞“全部已阅”；“查看上下文”和“全部已阅”按钮会在 hover / 读屏口径里说明当前实体缓存写入、短时间撤销、仅未读视图暂留、不会补拉历史或改写原始聊天平台；上下文消息本身未读时也会保留未读标识。
- 主题详情聊天页会先显示“阅读批次回执”，说明当前只是在已加载详情里按未读/已读、群组和本页搜索形成阅读批次；回执会展示已加载、当前显示、明确未读聊天、主题未读信号、暂留讨论和未知读状态，并说明本页排序是明确未读聊天优先、同状态保留详情返回顺序，不会补拉历史消息或重排后端主题。展开上下文才会通过当前实体缓存路径把对应消息标记已读，“全部已阅”也只更新当前主题已知未读信号并保留短时间撤销，不会改写原始聊天平台、发送、删除或同步外部系统。
- 如果详情页的本页搜索、阅读状态或群组筛选把当前聊天批次过滤为空，但主题详情里仍有已加载聊天，会显示“空批次恢复回执”。回执说明哪些本页筛选隐藏了当前批次、未读没有因此被标记已读，并提供清空本页搜索、显示全部群组、恢复未读批次或查看全部聊天的本页恢复动作；这些动作只恢复当前阅读视图，不刷新后端、不同步 Memory Service，也不改写原始聊天平台。
- 历史聊天记录如果缺少 `isRead` 字段，会被视为未知读状态而不是未读；只有明确 `isRead: false`、`unreadDiscussions` 或 `readStatus.unreadCount` 才会进入未读流，详情页上下文消息也只对明确未读项显示未读标识，避免旧数据把“仅未读”视图撑满或制造虚假未读压力。
- 主题详情里的聊天搜索覆盖摘要、发送者、群组、上下文消息和来源字段；命中上下文时会在聊天条目上提示，避免用户搜索到结果却不知道为什么匹配。
- 主题详情里的相关项目、资源和 Ticket 当前是只读引用面板；尚未接入编辑/新增/解绑 API 的操作不会展示成可点击按钮。
- 聊天摘要和上下文在高亮搜索词前会先做 HTML 转义，避免消息正文中的标签被当作页面内容执行。
- 主题列表和主题详情里的缺失、异常、未来漂移或 Unix 秒级时间戳会被安全格式化；无法判断时降级为“未知时间”，避免把缺失时间误报成“刚刚”。

## 持久化与同步

前端标记已读后会发送 `CACHE_ENTITY` 消息，把更新后的实体交给 `memory-exploring-messageHandler.ts`。当前后端还没有专用的 read-status mutation API，所以这是一个兼容式同步路径。

今日卡片关闭状态只保存在浏览器 `localStorage`，按自然日重置。

主题“稍后处理”也保存在浏览器 `localStorage`，到期后会重新回到未读流；主题列表页会按最近到期时间设置一次本地刷新，避免打开页面后必须再点一下才看见到期主题。用户也可以在主题列表的“稍后”视图手动恢复，或在刚设置稍后后的短时间提示里直接恢复；列表页恢复后会显示“恢复未读回执”，说明只删除本机稍后状态、未读信号保留、没有同步 Memory Service 或写回原始聊天平台。主题详情页的“稍后处理当前主题”复用同一份本地状态和恢复语义，并在当前主题头部持续展示本机稍后时间和恢复入口。快捷时间由 `getTopicDeferPresetOptions()` 生成：1 小时后、今天 18:00（如果已过则明天 09:00）、明天 09:00、下周一 09:00；列表和首页还支持输入任意未来日期时间。

主题“静音”保存在浏览器 `localStorage`，到期后会自动重新回到未读流；永久静音需要用户在“静音”视图手动恢复。快捷时间由 `getTopicMutePresetOptions()` 生成：1 天、1 周、一直静音；静音原因由 `getTopicMuteReasonOptions()` 生成，页面重载或浏览器重开后会继续展示，并兼容没有原因的旧本地记录。

主题“静音”的即时撤销提示只保存在当前前端会话里，列表页和详情页默认都保留约 10 秒；撤销会删除本地静音状态，让仍然未读的主题回到未读流。已静音但当前没有未读的主题在详情页仍可直接取消静音，因为静音状态还会影响未来未读是否进入主未读流。列表页和详情页的“取消静音”恢复回执同样只保存在当前前端会话里，用来确认本机过滤已删除和 no-sync/no-platform-write 边界，不代表后端已持久化新的跨设备状态。

主题整组已阅和单条讨论已阅的撤销状态只保存在当前前端会话里，默认保留约 10 秒；撤销时会恢复主题 `readStatus`、未读预览和已知聊天记录的读取状态，并通过现有 `CACHE_ENTITY` 路径同步。已知聊天记录包括 `conversation.contextMessages`，展开命中上下文消息时也会同步它的 `isRead` / `readTimestamp`，撤销会恢复原状态。

主题详情的数据读取由 `src/modals/topic-detail-data.ts` 做轻量归一化，优先读取 `recentDataDetails`，并兼容旧的 `relatedData`、顶层 `relatedProjects` / `relatedResources` / `relatedTickets` / `webpages` / `conversations` 字段。后台 `GET_TOPIC_DETAIL` 会保留后端已返回的 `recentDataDetails`，只对缺失数组补空值；详情接口成功但没有返回数据时会走 mock 详情兜底，避免旧实体或本地验证环境打开详情时空白或阻塞。已读同步也会兼容顶层 `conversations` / `latestConversations`，并能用上下文消息 id 清理对应未读预览；如果某个列表态主题没有能绑定到该消息的 conversation 或 unread preview，不会被误扣未读数。

## 业内参考

这类功能更接近“消息/信息 triage”，而不是普通搜索页：

- Slack Unreads 支持按未读聚合、排序过滤、批量已读和撤销，说明已读操作需要低成本且可恢复。
- Slack Later 和 Gmail Snooze 把“已读”和“稍后处理”拆成两种心智，并支持自定义回到视野的时间，避免用户用未读状态当待办清单；Slack 的 Later 还把待处理、归档和完成状态集中在一个可找回入口里，说明延后动作需要明确恢复路径。
- Gmail 的 Unread first / Priority Inbox 说明未读视图需要和重要性排序共存。
- Feedly AI Mute Filters 的价值在于降噪；主题阅读后续也应提供静音、隐藏低价值主题的能力。
- Zulip 的 topic mute 把静音主题保留在可显式包含的 Recent conversations 过滤里，并支持在单个 topic 视图里操作 mute/unmute，说明“隐藏噪声”不能等于“用户找不回来”，上下文内也应能直接降噪。
- Microsoft Teams 的单条消息链接会把用户带到会话历史里的具体消息并高亮；主题详情的 `messageId` 深链也应让用户一眼看到被定位的是父讨论还是上下文消息。
- Zulip 的永久消息/话题链接围绕 message ID 定位当前所在会话；这支持主题详情继续把 `messageId` 作为稳定锚点，而不是依赖可变的主题名或筛选状态。
- Notion AI Connectors 强调来源引用和权限边界；主题聚合页后续展示 AI 摘要时，也应该保留可追溯来源。
- Microsoft Defender Safe Links 在 Teams / Office 链接点击路径上做安全检查；主题来源链接也应坚持只暴露可信协议，并在隐藏时解释原因。
- RFC 3986 把 `user:password@host` 形式的 userinfo 标为不应明文展示且可被伪造成可信域名；因此主题来源链接即便是 `http(s)`，只要带账号信息也应隐藏并继续寻找下一个可信候选。
- 开发者即时通讯的 short-text topic modeling 研究表明，聊天消息很短且依赖上下文；详情页不能只看父消息摘要，还要把上下文消息纳入阅读状态和搜索判断。
- Slack 的 Unreads / Catch up 交互把“阅读当前批次”和“稍后回来”分开，并提供撤销；主题详情里的未读筛选也应避免把用户刚打开的讨论从当前阅读流里瞬间移走，详情页本身也要提供不离开上下文的稍后处理入口。
- 2026-06-06 检查：Slack Unreads、Zulip topic mute、邮件 defer 研究和 unified messaging attention-management 研究都指向同一个原则：未读队列要帮助用户决定“现在看什么”和“以后整理什么”。因此主题排序不应让低热度旧积压长期压过近期小批量未读，而要把积压状态显式露出并保留可恢复入口。
- 2026-06-11 检查：Teams 和 Zulip 都把消息/话题链接作为回到具体上下文的锚点；Slack Later 与 email triage 研究强调阅读、稍后和回访是不同状态。因此 Topic deep link 不应只闪一下高亮，还要说明这次定位改了哪些本页筛选、是否同步已读，以及失败时怎么回到当前主题的可读视图。
- 2026-06-27 检查：Slack message permalink、Teams message deep links 和 Zulip message ID search 都把消息链接作为可复现锚点；InsightLens 等 conversational context 可视化研究也说明用户需要看到上下文组织依据。因此 Topic deep link 命中后要展示本次实际匹配依据，并把定位回执保留到用户收起，而不是和 6 秒高亮一起消失。
- 2026-07-03 检查：Slack 的“标为未读后回来处理”、Teams deep links 和 Zulip message links 都把消息链接视为可恢复的上下文入口；email deferral 和 conversation curation 研究也说明用户经常在 triage 后需要回访。因此 Topic deep link 自动同步已读时，撤销入口应贴在定位回执里，命中失败或空白请求也要显示原始请求锚点、未补拉历史和 no-platform-write 边界，避免用户把失败链接误读成后端查空或已读同步。
- 2026-07-10 检查：[Slack permalink API](https://docs.slack.dev/reference/methods/chat.getPermalink/)、[Teams deep-link 文档](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links) 和 [Zulip message/topic links](https://zulip.com/help/link-to-a-message-or-conversation) 都把消息链接建立在各自平台的稳定 message id / timestamp 上；因此 Topic deep link 的路由层也要接受 `message_id`、`ts`、`thread_ts` 等常见别名，而不是只在内部 identity helper 里支持这些别名。
- 2026-06-28 检查：[Slack Unreads](https://slack.com/help/articles/226410907-View-all-your-unread-messages) 把筛选、批量已读、撤销和稍后回来放在同一个 catch-up 场景里；[Zulip muted topics](https://zulip.com/help/mute-a-topic) 把静音主题从主未读计数拆开但保留可找回入口；[Zulip unread sync](https://zulip.readthedocs.io/en/9.2/subsystems/unread_messages.html) 也说明未读计数可能受客户端加载边界影响；[email deferral 研究](https://www.microsoft.com/en-us/research/uploads/prod/2018/11/Characterizing_and_Predicting_Email_Deferral_Behavior.pdf) 和 [conversation curation 研究](https://www.cs.cornell.edu/home/kleinber/wsdm13-threads.pdf) 强调 triage 后还要支持 re-entry。因此主题详情的空阅读批次不能只显示“没有匹配”，还要说明是不是本页筛选隐藏了已加载聊天，并给出恢复当前未读批次或查看全部聊天的低成本动作。
- 2026-06-30 检查：[Notion AI Connectors](https://www.notion.com/help/notion-ai-connectors) 强调跨工具 AI 结果应保留来源和权限边界；[Microsoft Defender Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about) 和 [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 也支持外链场景持续暴露目标和安全口径。因此 Topic 列表里的资源预览不能静默跳出，即使只是安全 `http(s)` 外链，也要把“只打开外部标签页、无同步、无已读、无写回”的回执放在列表上下文里。
- 2026-07-03 检查：[Zulip message/topic links](https://zulip.com/help/link-to-a-message-or-conversation) 和 [Notion AI Connectors](https://www.notion.com/help/notion-ai-connectors) 都强调聚合信息需要可追溯来源；[Microsoft Defender Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about)、[RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 与 [URL inspection 研究](https://www.usenix.org/system/files/conference/usenixsecurity25/sec25cycle1-prepub-1341-lain.pdf) 也支持让用户看到真实目标和被过滤原因。因此 Topic 详情在使用安全 fallback 来源时，也要显示同组被过滤候选的数量/原因，而不是只留下一个看似完全干净的链接。

相关研究给出的启发：

- Email triage 和 email deferral 研究反复指出，未读数只是压力信号，用户真正需要的是快速判断“是否要处理、何时处理”；企业邮件日志也显示 defer 是常见行为，因此到期回流和误操作恢复不应依赖用户记得去找本地状态。
- unread email prioritization 研究显示用户常被“紧急”信号驱动，主题排序不能只看数量，还要结合重要性、时效和讨论集中度。
- attention management 研究建议把低优先级通知延后或降级呈现，避免每条新内容都争抢注意力。
- short-text topic modeling 研究提醒：聊天消息很短，单条消息聚类不稳定，主题聚合应更多利用上下文、参与者、项目和历史实体关系。
- provenance / source attribution 研究提醒：聚合结果里要让用户知道“这个链接来自哪里”，否则上下文回退容易被误解成原始消息链接。
- URL inspection / phishing 研究提醒：用户常因没有注意到真实域名而误点钓鱼链接；来源徽标应尽量把“不可信链接被隐藏”的原因直接暴露出来，而不只依赖 hover。
- 2026-06-10 检查：Slack / Zulip 把消息、话题和资源链接作为可分享的上下文锚点；Microsoft Defender Safe Links 在 Teams/Office 对链接做点击时保护；URL reading / URL inspection 研究也说明用户不一定能从完整 URL 或 hover 中判断真实目的地。因此 Topic 聚合页的聊天、资源、网页来源都应保持同一条规则：可点时展示真实域名，不可点时直接给出隐藏原因。
- 2026-06-14 检查：Zulip Recent conversations 把参与者作为快速识别/过滤线索，Slack Catch Up 和 email defer 研究都强调 triage 需要帮助用户快速决定下一条要不要处理。因此 Topic 列表搜索应支持“我记得是谁说的”这种人名线索，并在卡片上露出参与者/来源人，但仍要说明这只是当前已加载 payload 的本页过滤。
- 2026-06-23 检查：Slack Later 和 Gmail Snooze 都把延后处理做成个人可恢复状态，邮件 deferral 研究也指出用户常因需要更多时间、信息或上下文切换而延后处理。因此 Topic 列表卡片的“稍后”菜单也必须在选择时间前先显示本机范围、未读保留、到期/恢复路径和 no-sync/no-platform-write 边界，不能只在详情页解释。
- 2026-06-21 检查：Zulip muted topics 不进入主 feed / unread count 但可通过 include/search 找回，Slack mute 也把通知隐藏和未读/提及行为拆开；notification snooze 研究提醒延后/静音可能带来二次打扰。因此列表卡片这个主静音入口也必须在点击前显示本机范围、未读保留和恢复路径，不能只在详情页解释。
- 2026-06-20 检查：[Microsoft Defender Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about) 强调链接点击时保护，[Zulip message/topic links](https://zulip.com/help/link-to-a-message-or-conversation) 把消息和 topic URL 当作稳定上下文锚点，[RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 对 `userinfo` URL 有安全提醒，URL inspection 研究也指出用户需要被引导关注真实域名。因此 Topic 来源链接要在可点时显示域名和打开回执，在不可点时直接露出主要隐藏原因。
- 2026-06-22 检查：[Slack Unreads](https://slack.com/help/articles/226410907-View-all-your-unread-messages) 把批量已读和撤销放在同一个阅读场景里，[Zulip muted topics](https://zulip.com/help/mute-a-topic) 把静音主题从主 feed 和 unread count 中拆出但保留可找回入口，email deferral 研究把“稍后处理”视为正常 triage 决策。因此主题详情进入未读流时，应先告诉用户这一批到底由哪些本页过滤形成，以及展开/全部已阅会写哪里、不写哪里。
- 2026-07-03 检查：[Slack Unreads](https://slack.com/help/articles/226410907-View-all-your-unread-messages)、[Slack Later](https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later)、[Zulip reading conversations](https://zulip.com/help/reading-conversations) 和 [Zulip unread sync](https://zulip.readthedocs.io/en/9.2/subsystems/unread_messages.html) 都把未读处理视为当前阅读切片，而不是完整历史重排；[email deferral 研究](https://www.microsoft.com/en-us/research/uploads/prod/2018/11/Characterizing_and_Predicting_Email_Deferral_Behavior.pdf) 与 [conversation curation 研究](https://www.cs.cornell.edu/home/kleinber/wsdm13-threads.pdf) 也强调 triage 后的 re-entry。因此 Topic 详情的阅读批次回执需要直接展示已加载/可见/未读/暂留/未知状态构成和排序依据，避免用户把本页批次误解成后端全量重算。
- 2026-06-25 检查：[Slack Later](https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later) 把稍后项放在专门入口，[Zulip muted topics](https://zulip.com/help/mute-a-topic) 把静音主题从主 feed 隐藏但可显式包含，[email triage / deferral 研究](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/02/Email_Triage_CHIIR19.pdf) 也强调延后项需要回访策略。因此静音成功后的持久卡片不能只写“已静音”，还要持续说明未读保留、只影响本机过滤，以及恢复动作。
- 2026-06-27 检查：[Zulip mute/unmute](https://zulip.com/help/mute-a-channel) 明确静音主题会从主 feed 和未读数里拆出，但仍可搜索和包含；[Topic notifications](https://zulip.com/help/topic-notifications) 还把关注/自动恢复作为独立设置；[Zulip mobile 的公开 issue](https://github.com/zulip/zulip-mobile/issues/3473) 也暴露过“能看到静音 topic 但找不到 unmute”的 UX 问题；[Slack Unreads](https://slack.com/help/articles/226410907-View-all-your-unread-messages) 把撤销和稍后回来放在未读场景中；[email deferral 研究](https://www.microsoft.com/en-us/research/uploads/prod/2018/11/Characterizing_and_Predicting_Email_Deferral_Behavior.pdf) 则说明回访策略是 triage 的关键。因此 Topic 详情页只要显示了“已静音”，就必须在同一上下文提供取消静音，不能因为当前未读数为 0 就隐藏恢复动作。
- 2026-07-05 检查：[Slack mute](https://slack.com/help/articles/204411433-Mute-channels-and-direct-messages)、[Zulip mute](https://zulip.com/help/mute-a-channel) 和 [Teams notification settings](https://support.microsoft.com/en-us/teams/notifications-settings/manage-notifications-in-microsoft-teams) 都把 mute 作为个人注意力控制；notification interruption 与 email deferral 研究也说明降噪必须配套清晰恢复。因此列表页取消静音后也要留下 no-write 回执，避免用户把本机恢复误读成跨设备同步、已读写入或原平台操作。
- 2026-07-06 检查：[Slack message permalinks](https://docs.slack.dev/reference/methods/chat.getPermalink)、[Zulip message ID search](https://zulip.com/help/search-for-messages)、[Notion AI Connectors](https://www.notion.com/help/notion-ai-connectors)、[Microsoft Defender Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-policies-configure)、[RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 与 [URL Inspection Tasks](https://arxiv.org/abs/2502.20234) 都支持在聚合视图点击前暴露真实目标、来源和安全口径。因此 Topic 列表资源预览也要在点击前显示目标域/隐藏原因和 no-sync 边界，而不是把这些信息只放进点击后的回执。
- 2026-07-07 检查：[Slack mute](https://slack.com/help/articles/204411433-Mute-channels-and-direct-messages) 和 [Zulip muted topics](https://zulip.com/help/mute-a-channel) 都把静音对话保留在可找回入口里；Zulip mobile 早期也暴露过“看得到静音 topic 但找不到 unmute”的问题。因此 Topic 列表从未读流静音后，toast 需要直接提供“查看静音”，让用户立刻核对主题去了哪里，而不是只给撤销。
- 2026-07-14 检查：[Slack mute](https://slack.com/help/articles/204411433-Mute-channels-and-direct-messages)、[Teams mute chat](https://support.microsoft.com/en-us/teams/chat/hide-unhide-mute-add-a-chat-to-favorites-or-mark-a-chat-as-unread-in-microsoft-teams) 和 [Zulip topic mute](https://zulip.com/help/mute-a-topic) 都把 mute 作为个人注意力控制，而不是已读或跨平台写回；[email deferral](https://arxiv.org/abs/1901.04375) 与 [conversation re-entry](https://arxiv.org/abs/1304.4602) 研究也强调 triage 状态必须可恢复。因此 Topic 静音的菜单、原因、时长、查看静音和取消静音控制点都要在点击前说明本机范围、未读保留、无 Memory Service 同步和无原平台写回。
- 2026-07-13 检查：[Slack Later](https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later)、[Gmail Snooze](https://support.google.com/mail/answer/7622010?co=GENIE.Platform%3DDesktop&hl=en)、[Teams Saved](https://support.microsoft.com/en-us/teams/chat/save-a-chat-or-channel-message-in-microsoft-teams) 都把“稍后 / 保存”做成可找回的个人状态；[email deferral 研究](https://arxiv.org/abs/1901.04375) 与 [conversation re-entry 研究](https://arxiv.org/abs/1304.4602) 也说明延后处理的价值在于回访路径。因此 Topic 的“稍后处理 / 查看稍后 / 恢复未读”不仅要在菜单和 toast 解释，也要在按钮 title / 读屏文案里提前说明本机范围、不标已读、不同步 Memory Service 和不写回原始平台。

## 当前限制

- `GET_ENTITIES_BY_TYPE` 返回的主题列表可能没有完整 conversation 明细，未读数仍优先以实体 `readStatus` 为准；如果列表 payload 已带出明确 `isRead: false` 的聊天记录，前端会把它作为补充未读信号。
- 如果 Topic 列表接口失败，前端不会回退到 mock Topic。没有上次同类型快照时列表保持空并展示失败回执；有上次同类型快照时只作为旧快照继续显示，直到重新加载成功。
- 如果 `readStatus.unreadCount` 和 `unreadDiscussions` 同时存在但不一致，前端会保守显示未读；最终仍需要后端专用 read-status API 消除漂移。
- `CACHE_ENTITY` 仍是通用实体缓存/ingest 路径，不是精确的 read-status API。
- 未读预览如果没有绑定 message id，只能在整主题已读时清空，无法精确移除单条预览。
- 主题列表未读预览没有稳定 message id 时，只能打开主题详情，无法直达具体上下文。
- 稍后处理和静音目前是本机浏览器状态，还没有同步到后端。
- “仅未读”视图会把本机稍后/静音主题排除；如果排除后为空但隐藏区仍有未读，页面会显示恢复入口而不是完成态。
- 相关项目、资源、Ticket 只读展示，暂不支持在主题详情里手动增删关系。
- 消息定位只能定位到当前详情数据里已返回的讨论；即便路由使用 `messageId`、`message_id`、`ts` 等 query key，或参数值是 URL 编码值、Slack timestamp、Slack permalink path、原始来源 permalink，也只是作为当前 payload 的身份别名匹配。若后端详情接口没有带出该消息，前端会给失败回执并恢复到当前详情的全部聊天记录，但不会额外补拉历史消息；父讨论缺少 ID 时也只会使用已返回的上下文消息 ID 稳定当前页渲染锚点。
- 本页快速搜索只覆盖当前列表 payload，并保留当前“仅未读 / 全部 / 稍后 / 静音”视图边界；参与者 chips 也只来自已加载的 people / conversation sender 等字段。如果当前视图没有匹配项，空状态会提示切到全部主题继续查找。某个老主题或参与者未加载到当前列表时，仍需要依赖后端搜索或后续专用 topic read/search API。

## 建设性改进方向

1. 增加专用 API：`PATCH /entities/:id/read-status` 和 `PATCH /entities/:id/conversations/:messageId/read-status`，避免用实体 ingest 承担读状态同步。
2. 给“稍后处理”和“静音”补跨设备同步，避免只依赖当前浏览器。
3. 给未读预览补稳定 `messageId` 和来源类型：支持单条消息已读后精确移除对应预览，也能在 AI 摘要中显示可追溯来源。
4. 后端排序可继续吸收前端“优先处理排序”的信号，并结合用户对稍后/静音/恢复及静音原因的反馈，避免只按热度推送噪声主题。
5. 后端 Topic 搜索可复用本页快速过滤的字段契约，把 unread preview、上下文消息、参与者/来源人和资源来源纳入可检索索引，减少“列表能过滤、全局搜不到”的漂移。
6. 后续如果接入专用 read-status API，可以把“积压待整理”的判断也持久化成轻量 triage signal，供跨设备排序和摘要使用。

## 验证

主题读状态的 targeted 验证脚本：

```bash
npm run verify:topic-based-messages
npm run verify:topic-based-messages:e2e
```

运行时代码改动后仍需按 `AGENT.md` 运行 `npm start`，等待首次 webpack 编译成功后停止。
