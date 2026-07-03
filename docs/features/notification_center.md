# Notification Center

## Summary

当前仓库里和“通知/待办推送”相关的能力，实际分成两层：

1. `memory-service` 里的 **Notification Center**
2. Chrome extension 里的 **DigestQueueService**

它们相关，但职责不同：

- Notification Center 负责把 `memory-service` 里的待处理事件，按渠道和语义统一分发给 `chrome`、`doubao`、`glip`
- DigestQueueService 负责 extension 本地的“延迟汇总推送”，主要处理 follow thread 和 concerned items 这类本地规则命中的摘要

这份文档替代旧的 `digest-queue-service.md`，把两层结构放在一起说明。

---

## 大白话运行逻辑

通知系统不是一个单一队列，而是两层：memory-service 负责把“应该通知/待处理”的事情标准化并投递到渠道；extension 本地 DigestQueueService 负责把本地规则命中的零散消息延迟汇总，减少打扰。

结果主要受这些因素影响：

1. 输入来源：`notification_records` 和 `proposed_actions` 决定服务端通知；follow thread / concerned items 决定本地摘要。
2. 通知语义：待办、告知、digest、action 的 lane/priority 不同，路由和处理状态也不同。
3. 渠道可用性：chrome、doubao、glip 的投递回执只说明渠道送达，不等于用户已处理。
4. 去重和回执：同一 sourceRef/sourceId 应避免重复推送，并保留每个渠道的独立状态。
5. 用户处理状态：处理、忽略、稍后等状态应和渠道投递分离，避免“发出去了”被误当“完成了”。

---

## 1. Notification Center

### 1.1 目标

Notification Center 是 `memory-service` 里的统一通知路由层。它解决的是这几个问题：

- 把不同来源的数据统一成同一套通知结构
- 区分“需要用户处理的待办”和“只需要告知的通知”
- 记录每个渠道是否已经成功投递，避免重复推送
- 保留“渠道已送达”和“用户已处理”两种不同状态，不把它们混在一起

### 1.2 输入来源

当前 Notification Center 主要汇总两类数据：

- `notification_records`
- `proposed_actions`

对应实现：

- `memory-service/src/core/NotificationCenterService.ts`
- `memory-service/src/repositories/NotificationRepository.ts`

### 1.3 统一结构

两类数据都会被映射成 `NotificationEnvelope`：

- `sourceRef`
- `sourceType`
- `sourceId`
- `lane`
- `priority`
- `title`
- `body`
- `dueAt`
- `createdAt`
- `sentAt`
- `type`
- `payload`

其中最重要的两个字段是：

- `lane`: `todo` 或 `notice`
- `priority`: `high` 或 `normal`

### 1.4 路由规则

当前分类规则在 `classifyNotificationRouting()` 中：

- `proposed_action:*` -> `todo/high`
- `truth_conflict` / `new_conflict` / `deadline` / `notify_user` -> `todo/high`
- `weekly_report` / `dream_digest` -> `notice/high`
- `project_update` / `property_change` -> `notice/normal`
- 其他默认 -> `notice/normal`

这表示：

- `todo` 是“需要用户处理的事情”
- `notice` 是“只需要同步和告知的信息”

### 1.4.1 代价不对称 Utility v2 (P1-8)

`ProactivityPolicy` 的单一 `utility = benefit − cost` 升级为**代价不对称**的两因子模型（开关 `utilityV2`，env `PROACTIVITY_UTILITY_V2`，**默认 OFF**——通知是最敏感的面，先影子模式再切）：

```
utility_v2 = needScore * missCost − (1 − needScore) * interruptCost * (1 + timingCost)
```

- `COST_MATRIX[type]` 给每类通知三个常量：`miss`（漏报代价）、`interrupt`（误打扰代价基数）、`quietSens`（安静时段敏感度）。deadline/truth_conflict 高 miss 低 interrupt（漏了会写错事实，深夜也值得早晨置顶）；dream_digest/weekly_report 低 miss 高 interrupt（纯资讯从严）。
- **保底通道**（书中「成本-静默」矛盾的工程答案）：`miss ≥ 0.9 && needScore ≥ 0.5` 的候选在安静时段既不深夜打扰、也不静默丢弃——降级为 `scheduled`（次晨置顶补投）。**省下的是深夜打扰，不是信息本身。**
- **校准回流**（`calibrate(windowDays, dryRun)`，月度）：按 type 聚合近 30 天 `notification_records` 的 dismissRate/clickRate，dismissRate>0.6 → interrupt +0.1，clickRate>0.5 → miss +0.05，每次调整写 `notification_policy_audit`（可解释可回滚）。
- **通知证据**：migration `045` 给 `notification_records` 加 `evidence_refs_json` / `weave_json`；feed item 会返回只读 `evidenceReceipt`，Provider / Doubao digest 显示「依据 N 条记忆」，Chrome context label 也显示同一依据数量。这个回执只解释通知触发依据，不确认、不忽略、不重发，也不改变渠道投递状态。
- 验证：`proactivityV2.test.ts`（5：深夜 deadline→scheduled、白天→notify、同分 dream 比 deadline 难 notify、v1 不返回 scheduled、校准 dryRun 提 interrupt）；`notificationCenter.test.ts` 覆盖 evidence receipt 的 feed / digest 展示。
- **仍在推进**：通知创建时系统性写入 evidence_refs、scheduled 状态的次晨实际投递管线。

### 1.5 渠道投递回执

Notification Center 不会把“已经发给某个渠道”直接视为“用户已经处理”。

它通过 `channel_delivery_records` 单独记录渠道投递状态：

- `source_ref`
- `channel`
- `lane`
- `status`
- `external_ref`
- `first_delivered_at`
- `last_delivered_at`
- `seen_at`
- `dismissed_at`

对应实现：

- `memory-service/src/repositories/ChannelDeliveryRepository.ts`
- `memory-service/src/storage/migrations/015_channel_delivery_records.sql`

当前支持的 channel：

- `chrome`
- `doubao`
- `glip`

当前支持的 delivery status：

- `delivered`
- `failed`
- `clicked`
- `dismissed`

回执 API 返回里还会带两个诊断字段：

- `status`: 最近一次该 channel/source/lane 收到的回执事件
- `effectiveStatus`: 对用户和调试更有意义的当前有效状态；如果此前已经送达、点击或忽略，后续一次失败不会把有效状态倒退成“从未送达”
- `hasSuccessfulDelivery`: 是否曾经有过送达、点击或忽略类成功回执
- `firstDeliveredAt` / `lastDeliveredAt` / `updatedAt`: 按回执事件时间记录，而不是按服务端收到请求的时间猜测；`POST /notification-center/delivery` 可以带 `recordedAt`
- `channelReceipts`: feed item 上的跨渠道回执摘要，按 Chrome / Doubao / Glip 分别说明未尝试、已送达、已查看、已忽略或发送失败；Chrome 通知和 Provider digest 会把“其他渠道已送达/失败”的关键信息露出来，便于用户和排障时区分“这个渠道第一次提醒”和“别的渠道已经试过”。Provider / Doubao markdown 摘要在其他渠道最近失败时还会带失败原因；如果该渠道此前已经送达、查看或忽略，摘要会说明有效状态没有被最近失败回滚。
- Chrome 系统通知的第一行 context label 也会带当前渠道上次失败原因，以及其他渠道的失败原因和有效状态边界，例如“Glip发送失败（bot_not_configured，未送达）”或“豆包已查看，最近失败（provider_retry_failed，已查看不回滚）”。这只是解释投递回执，不会自动确认、忽略、重发或改全局处理状态。
- 如果 feed item 带 `evidenceReceipt`，Chrome 系统通知 context label 会同时显示“依据 N 条记忆”；Provider / Doubao digest 会显示 `[依据 N 条记忆；只读依据]`。这条证据线和渠道回执一样只读，帮助用户判断为什么被提醒，不代表该通知已处理或证据已重新核验。

这避免了一个常见误读：例如 Doubao 或 Chrome 曾经成功展示过通知，但后面一次网络重试写入了 `failed`。此时 `status=failed` 说明最后一次尝试失败，`effectiveStatus=delivered` 才说明这条 source 对该渠道已经有过可用送达。

回执写入按事件时间处理乱序回调：更早发生但更晚到达的 provider 回调可以补齐 `firstDeliveredAt`，但不会覆盖较新的 `status` / `lastError` / `updatedAt`。这样失败排障和 todo 冷却不会被延迟回调改写。

### 1.6 API

Notification Center 对外主要暴露两个接口：

- `GET /api/v1/notification-center/feed`
- `POST /api/v1/notification-center/delivery`

对应实现：

- `memory-service/src/routes/notificationCenter.ts`

`feed` 的语义是：

- 给指定 channel 拉取还没有在该 channel 成功投递的 `todo` / `notice`
- `channel` 必须是 `chrome`、`doubao` 或 `glip`
- `lanes` 只接受 `todo` / `notice`，非法值会直接返回 400
- 对 `notice` 来说，已经成功送达、点击或忽略过的 source 不会因为后续失败回执又重新进入 feed
- 对 `todo` 来说，`delivered` 只是 6 小时短期冷却；如果用户没有点击或明确忽略，冷却后会重新进入 feed
- `clicked` / `dismissed` 是终止性的用户处理回执，不会因为冷却时间过去而重新进入 feed
- feed 会先排除该 channel 已成功投递的 source，再做 `limit` 截断，避免旧的未投递通知被新的已投递记录挡住
- 每个 feed item 会带 `deliveryContext`，说明它是全新通知、上次投递失败后重试、待办冷却结束后的再次提醒，还是每日摘要里“已提醒但仍未完成”的待办；Chrome 通知和 Provider digest 会把这个原因展示出来，避免用户误以为重复出现的待办是全新事件
- 如果某个待办曾经成功送达、后来又发生投递失败，等它重新进入 feed 时会优先显示“上次发送失败”，而不是只显示普通“再次提醒”；这样用户能区分“冷却后重复提醒”和“渠道最近确实失败过”
- `feed` 可以通过 `deliveryMode` 选择打扰策略：`retry_after_cooldown` 是默认实时提醒，`incremental` 只返回从未成功送达的新待办，`daily_digest` 返回仍未完成的待办用于低打扰汇总。`daily_digest` 只放宽 `todo` 的已投递过滤，`notice` 仍然保持送达后不重复进入 feed
- `daily_digest` 放宽的是“已送达但仍未完成”的待办，不会把该 channel 已经 `clicked` / `dismissed` 的待办重新拉回摘要；摘要排序也会把新待办和失败重试放在“已提醒过，仍待处理”的旧待办前面
- Provider / Doubao 摘要会按 token budget 只保留完整条目；如果放不下全部，会追加“已截断，还有 N 条未放入本次摘要”的回执，并且只把真正展示出来的 sourceRef 写入渠道送达回执。未展示的通知或待办会继续留在后续 feed，不会因为一次截断摘要被误判成已经送达。若不是 token budget，而是 digest 只取了 feed 前 N 条，正文会显示“Feed 还有更多”，说明本次摘要只是一个受限视图，剩余条目仍留在 Notification Center feed。
- `feed` 响应会带 `meta`，记录本次实际 channel、lanes、deliveryMode、limit、returned 和 `hasMore`。`total` 仍表示本次返回条数；如果 `hasMore=true`，说明这次 response 被 limit 截断，并不代表当前 feed 已经全部展示完。
- 当 `feed` 成功读取但返回 0 条时，`meta.emptyReceipt` 会显示 `Feed 空结果回执`：说明本次检查的 channel、lane 和 delivery mode，以及“成功但为空”的边界。这不代表读取失败，也不会确认、忽略、重发通知，不会写渠道送达回执或改变全局处理状态；Provider / Doubao digest 的空态也会展示同一语义，避免把“暂无”误读成失败或已处理。

`delivery` 的语义是：

- 某个渠道在发送成功、点击、忽略之后，把结果回写给 `memory-service`

### 1.7 和用户处理状态的关系

这里有一个容易混淆的点：

- `channel_delivery_records` 记录的是“某个渠道发生了什么”
- `notification_records.clicked_at` / `dismissed_at` 记录的是“这条通知全局上是否被用户处理”

也就是说：

- Doubao 推送成功，不应该自动 `acknowledge`
- Chrome 展示成功，也不应该自动 `acknowledge`
- 只有用户在交互里明确“查看 / 忽略”时，才应该改全局状态

---

## 2. Provider / Doubao / Chrome / Glip 接入

### 2.1 Provider digest 输出

`ProviderContextService` 现在把通知中心内容拆成三种 provider package：

- `todo_digest`
- `notice_digest`
- `reminder_digest`

其中：

- `todo_digest` 是新的待办输出
- `notice_digest` 是新的通知输出
- `reminder_digest` 只是 `todo_digest` 的兼容别名
- 周报和 `dream_digest` 的推送目标以 memory-service runtime config 为准：`me` 发给当前用户，`group` 发给配置的群组，`none` 不创建通知也不发 Bot；Options 里的“立即推送”会把当前选择带到后端，手动触发不会绕过这个门控
- 周报 notice payload 会保存 `reportSummary` / `reportExcerpt` 和消息、反思计数；Provider digest、Doubao 同步和 Chrome 预览优先展示这段可读摘要，旧数据没有摘录时才退回报告路径
- Options 手动触发会读取当前可见控件值，避免刚切换 `none` / `group` 后立刻点击仍按旧目标推送；提交后会先在对应配置区显示 `请求已提交` 回执，替换旧结果并说明本次目标、notice / Bot 还在等待确认、不会改变自动调度或确认/忽略通知；后端返回后再显示结果回执：生成/未生成、目标、Notification Center notice 是否写入、Bot 是否确认送达、报告文件或 dream 落点与计数分开展示；`none` 会明确说明只生成内容，不写通知中心、不发 Bot/Chrome/Doubao，也不改变自动调度或通知处理状态；若内容已生成但 notice / Bot 投递未完整确认，回执标成“投递部分失败”，让用户按写入和 Bot 两行判断补救渠道
- 如果 Options 手动触发时选择了自定义群组但当前可见群组 ID 为空，页面会显示 `手动门禁` 回执并在前端拦截：后端不会收到周报 / Dream Digest 生成请求，不会写 Notification Center，不会发送 Bot/Chrome/Doubao，也不会回退到旧保存群组或改变自动调度。

对应实现：

- `memory-service/src/core/ProviderContextService.ts`
- `memory-service/src/core/WeeklyReporter.ts`
- `memory-service/src/core/HeartbeatLoop.ts`

### 2.2 Doubao

Doubao 现在分两条同步路径：

- `todo_sync` -> 写 Doubao 待办
- `notice_sync` -> 写普通 `mobile_context`

关键约束：

- `todo` 文案不能带 `✅`
- `notice` 不应该写成待办
- `dream_digest` / 周报这类 notice 会把 `payload` 里的摘要详情纳入同步内容，避免只同步“生成了 N 条内容”的空壳提示
- 周报 / Dream Digest 的 `me`、`group`、`none` 不是前端文案开关，而是后端投递门控；`none` 只允许用户显式生成内容，不进入通知中心或 Bot 渠道
- Doubao 成功后只写 delivery 回执，不自动全局 `acknowledge`

对应实现：

- `desktop-app/src/syncManager.ts`
- `desktop-app/src/bridgeService.ts`
- `desktop-app/src/memoFormatter.ts`

### 2.3 Chrome

Chrome extension 优先从 `notification-center/feed` 拉取消息。

行为上：

- 展示成功 -> 记录 `delivered`
- 如果 Chrome 系统通知创建失败，会给该条 source 写 `failed` delivery 回执（含失败原因和本地 notification id），清理刚写入的点击元数据，并继续处理同一批 feed 里的后续条目；这样后端 feed / Provider digest 后续能显示“上次发送失败”，而不是把 Chrome 渠道失败伪装成未尝试或阻断整批通知
- 用户点“查看” -> 记录 `clicked`，并对 `notification:*` 做全局 `acknowledge`
- 用户点关闭类按钮 -> 记录 Chrome 渠道 `dismissed`；`notification:*` 的 notice 做全局 `dismiss`，待办类通知走 snooze 延后
- `proposed_action:*` 只记录渠道事件，不直接改全局通知状态；“暂不提醒”写回 `delivered` 触发待办冷却，而不是永久 `dismissed`
- 用户直接关闭系统通知时，不自动改全局通知状态；todo 写回 `delivered` 进入短期冷却，notice 写回 `dismissed` 不再重复打扰
- 通知弹窗会用 `contextMessage` 标出“待处理/通知”、优先级和待办截止时间，降低用户判断成本
- `dream_digest` 这类通知的系统弹窗预览会优先用 payload 摘要片段，而不是只展示计数型 body
- `weekly_report` 通知的系统弹窗预览会优先使用周报摘要摘录，而不是只展示“周报已生成”或报告文件路径
- `proposed_action:*` 的“查看待办”会打开动作队列并定位对应 action；`project_update` / `property_change` 这类 notice 会打开时间轴；`weekly_report` 会打开 `memory-exploring.html#/reports?file=...` 并定位报告正文；`dream_digest` 如果 payload 带 `latestDreamPath` / `dreamPaths`，会打开 `memory-exploring.html#/dreams?file=...` 并展开对应 dream 文件，否则兜底进入梦境重放总页
- 如果 `weekly_report` 通知指向的 `reports/*.md` 已被清理、移动或暂时不可读，Reports 页面会显示“周报通知目标暂时不可读”回执，并先展示最近可用周报；这个兜底只读取已生成 Markdown，不会重新生成周报、写入通知中心、发送 Bot/Chrome/Doubao，或改变通知处理状态
- 带 `payload.confirmRequestId` 的 `truth_conflict` / `notify_user` 等通知会打开决策中心的具体确认项，页面会置顶并高亮该卡片；如果确认项已处理或不在当前队列，会显示明确落空说明
- Chrome 通知的来源元数据会同时保存在 `chrome.storage.local`，避免 MV3 service worker 被回收后点击 / 忽略操作无法回写通知中心
- 对 `notification:*` 的待办类系统通知，第二按钮是“稍后提醒”；没有截止时间时默认延后 24 小时，有截止时间时会尽量在截止前再次提醒，避免把待办直接延到过期后。notice 使用“不再提示”，`proposed_action:*` 使用“暂不提醒”且只记录渠道事件
- Chrome 二级按钮会先把后端全局动作提交成功，再写 `dismissed` / `delivered` 这类渠道回执；如果 snooze 或 dismiss API 失败，不会先把原通知从 Chrome feed 里终止隐藏，避免用户以为“稍后提醒”已设置但未来提醒丢失

对应实现：

- `src/background.ts`
- `src/backendNotifications.ts`
- `src/services/MemoryServiceClient.ts`
- `src/modals/components/ReportsPage.vue`
- `tools/verify-weekly-report-notification-e2e.mjs`
- `memory-service/src/routes/notifications.ts`

### 2.4 Glip

Glip 不走待办，只接 `notice/high`。

当前高优先级通知能通过 `NotificationCenterService.deliverNoticeToGlip()` 发送，并在成功/失败后回写 delivery。

对应实现：

- `memory-service/src/core/NotificationCenterService.ts`
- `memory-service/src/core/WeeklyReporter.ts`
- `memory-service/src/core/HeartbeatLoop.ts`

---

## 3. DigestQueueService

### 3.1 它不是 Notification Center

`DigestQueueService` 是 extension 本地的摘要队列，不是 `memory-service` 的通知中心。

它解决的是另一类问题：

- 某些事件不需要立即推送
- 需要先入队
- 到指定时间或指定频率后，再合并成一条 digest 发送

### 3.2 当前负责的场景

当前主要有两个内置任务：

- `follow_thread_merged`
- `concerned_items_daily`

对应实现：

- `src/services/DigestQueueService.ts`
- `src/message-reaction/FollowThreadHandler.ts`

### 3.3 存储与调度

DigestQueueService 把队列存在 extension 本地的 `chrome.storage.local`：

- `digestQueues`
- `digestTaskStates`

它由 `TaskScheduler` 每 15 分钟触发一次 `digest_queue_process`，用于把用户配置的每日/每周释放时间控制在一个较小的本地检查窗口内：

- `src/services/digestQueueConfig.ts`
- `src/services/taskSchedulerDefinitions.ts`
- `src/services/TaskScheduler.ts`

### 3.4 处理流程

DigestQueueService 的处理流程是：

1. `register()` 注册任务和处理器
2. `enqueue()` / `enqueueBatch()` 入队
3. `processAll()` 检查到期任务
4. `processor.collect()` 过滤本次应释放的条目
5. `processor.format()` 生成摘要文本
6. 通过 `notificationService.sendNotification()` 推送
7. 成功后从本地队列删除已处理条目

`processAll()` 会稳定遍历当前注册的本地 digest 任务；如果任务已注册且到达自己的检查频率，就必须进入对应的 `processTask()`，不能只刷新后台任务状态却不处理队列。

如果任一内置 digest 推送失败，队列条目会保留，`digest_queue_process` 后台任务会被标成失败，并在 popup 的后台任务面板同时显示失败原因、“队列已保留 N 条”和保留明细。保留明细会复用当前队列快照，说明哪些关注项和释放节奏还在本地等待；这样用户不会看到“后台任务成功”但摘要实际没有发出去的假状态，也不会只看到网络错误却不知道摘要是否还在队列里。

popup 的后台任务面板还会读取当前 `digestQueues`，在 `汇总推送队列处理` 行显示本地摘要队列的实时状态：总共等待多少条、其中多少条已经到释放窗口、最早下一次释放时间、对应的摘要任务/关注项和释放节奏是什么。这样“上次成功 / 无到期摘要”不会掩盖其实还有摘要正在等待用户设定的时间，也不会让英文界面显示固定中文队列文案。

当后台任务刚跑完但没有到期摘要时，运行记录也会带“等待明细”，避免用户只看到“等待 N 条”却不知道这些条目是否来自关注项规则、每日摘要还是每周摘要。

当队列里已经有条目到达释放窗口时，后台任务行和 tooltip 会显示 `释放窗口回执`：这些摘要已经具备发送资格，等待下一次 `digest_queue_process` 后台任务尝试推送；查看或刷新状态只是读本地队列，不会替它们立即发送、不会写入 Memory Service，也不会确认任何通知。

同一行现在还会直接显示本地延迟边界：这是 extension 本地队列，只有到释放窗口后由后台任务推送，通常 15 分钟内检查；查看或刷新状态不会立刻发送摘要、不会写入 Memory Service，也不会确认任何通知处理状态。

本地 digest 不是某一条 RingCentral 原消息，所以 Bot 文案不会再生成空群组 mention 或 `app.ringcentral.com/messages/` 这类无效原消息链接；摘要正文会作为可读内容直接展示。

### 3.5 当前有效内容

旧的 `digest-queue-service.md` 里这些描述仍然有效：

- 它是 extension 本地的摘要队列
- 它通过 `TaskScheduler` 定时执行
- 它支持不同任务各自的频率和处理器
- Concerned Items 的 digest 会按规则时间释放
- Follow Thread 合并通知是它的一个具体任务

但旧文档已经不够准确，因为它：

- 没有把 Notification Center 和 DigestQueueService 区分开
- 还停留在“Phase 规划”口径，不是当前稳定架构描述
- 部分关键文件列表已经过时

---

## 4. 现在应该怎样理解这套架构

可以把它简单理解成两层：

### Layer A: memory-service 通知中心

负责：

- 统一建模
- 路由到 `todo` / `notice`
- 按 channel 去重
- 给 Doubao / Chrome / Glip 提供统一 feed

### Layer B: extension 本地摘要队列

负责：

- 本地规则命中的延迟汇总
- follow thread / concerned items 这种“不要立刻发”的场景
- 定时批量推送到 Bot / Chrome 等现有扩展通知能力

因此：

- `NotificationCenterService` 更像“跨渠道分发中心”
- `DigestQueueService` 更像“本地定时摘要释放器”

它们相关，但不是同一个系统。

## 5. 设计依据和当前优化点

本轮对通知按钮做了轻量 UX 收敛，并让待办 snooze 变得更贴近截止时间：

- 业内产品普遍把通知拆成可扫读 feed、可操作入口和用户可控的提醒强度。Android 通知设计强调明确通知目的、给出直接 action、设置类别/渠道，并清理过期通知；Teams Activity Feed 则把 unread、mention、reply 等类型做成可过滤队列；Slack 新 Activity 也把通知、提醒、过滤视图和清理动作放在一个可处理队列里。
- 通知研究也支持“不要把所有通知都立即打断用户”：Intelligent Notification Systems survey 把核心挑战归纳为根据用户上下文和偏好选择合适时机；Yahoo! JAPAN 的大规模 adaptive scheduling 研究显示，延迟到更可打断的时机能改善响应速度；DOIG 研究提示要记录用户实际响应层级，而不是只看是否触达。
- 对 Personal AI 来说，待办通知的“稍后提醒/暂不提醒”不能和 notice 的“不再提示”混成同一种操作，也不能固定延后 24 小时。当前实现会保留 notice 的低干扰关闭路径，让带截止时间的待办在截止前回到用户面前；即使只是展示成功、暂不提醒或直接关闭但没有真正处理，`todo` 也会在 6 小时冷却后重新进入 feed。

本轮对“渠道投递回执”补了状态可解释性：

- Twilio 的 status callback 模型把 queued / sent / delivered / failed / read 作为生命周期事件，而不是只保留一个不可解释的布尔值；Personal AI 也应明确区分最后一次尝试和有效送达状态。
- OneSignal 区分 push provider 接受的 Delivered 与设备侧 Confirmed Delivery，说明“渠道说发出去了”和“用户设备确实收到”不是同一层语义。
- Firebase Cloud Messaging 的 BigQuery delivery export 支持按 message / instance 追踪 accepted、delivered 和 latency，说明回执数据要能用于事后诊断。
- Teams read receipts 明确把“在通知/banner 看到”排除在 read receipt 之外，和 Personal AI 里“渠道送达不等于用户已处理”的原则一致。
- 通知系统研究强调错误时机和过多打断会损害体验，因此回执必须为冷却、重试和处理状态提供可靠信号。当前 feed 已把这些信号整理成 `deliveryContext.reason`，用于给用户显示“再次提醒”或“上次发送失败”。
- 本轮把 `deliveryContext.reason` 的优先级再收紧一层：如果最新渠道回执是失败，即使之前有过成功送达且待办冷却也已过期，也优先标成“上次发送失败”。这不会改变 notice 的一次性去重或 todo 的冷却机制，只是让失败恢复在 Chrome context label、Provider digest 和排序里不被普通冷却文案覆盖。
- 本轮继续补齐回执事件时间：状态回调和设备确认类系统经常异步、延迟或乱序到达，所以 `recordedAt` 必须代表渠道事件发生时间；旧事件可以补足首次/末次送达证据，但不能把较新的失败或处理状态倒回去。
- 本轮把这些回执从“当前 channel 的过滤依据”扩展成 feed item 的 `channelReceipts`：用户在 Chrome 里看到一条通知时，如果 Doubao 已经送达或 Glip 失败，context label 会显示“其他渠道”；Provider digest 里也会带同样的短回执。这样不改变去重、冷却或全局处理状态，只让跨渠道分发结果更可解释。
- 本轮继续收紧 `channelReceipts` 的展示文案：如果某渠道已经 `clicked` / `dismissed`，之后又收到一次失败回执，短标签会保留“已查看，最近失败”或“已忽略，最近失败”，而不是退成“已送达，最近失败”。这样用户能同时看见“这个渠道曾经被处理过”和“最近一次 provider 回调仍需要排障”。
- 本轮把同样的失败细节推进到 Chrome 系统通知 context label：当前渠道上次失败会显示失败原因和“曾已送达/未送达”等有效状态，其他渠道也会在短摘要里带失败原因。用户第一眼就能判断是“这个渠道从未送达”还是“已查看/已送达后最近 provider 回调失败”，不会把排障事件误读成事项已完成或通知完全丢失。
- 本轮进一步让 Provider / Doubao 摘要里的“其他渠道”失败回执带上失败原因，并在已有有效送达/查看/忽略时写明“有效状态仍按原状态”。这样跨渠道摘要不只告诉用户“失败了”，也能解释失败是否覆盖了先前的有效回执。

本轮对通知点击落点补了确认项深链：

- 真实 `chrome` feed 里常出现多条标题相同的 `truth_conflict` 待办，用户从系统通知进入后如果只落到 `/decisions` 总页，需要再人工比对问题正文。现在 notification payload 里的 `confirmRequestId` 会变成 `#/decisions?confirmRequestId=...`，Decision Center 负责置顶、高亮和解释找不到目标的原因。
- 这和 GitHub Notifications / Teams Activity 这类可处理队列的设计一致：通知不是只提示“有事”，而应该把用户带到可以立即处理的那一项。

本轮对 `DigestQueueService` 本地摘要补了两个小修正：

- Slack Activity 和 Teams Activity feed 都强调把通知放在可筛选、可处理的队列里，而不是只发一次系统提示；Apple 的 Scheduled Summary 也把低紧急通知合并到用户指定时间。因此 Personal AI 的本地摘要继续保持“延迟汇总”定位，但后台任务必须明确说明上次是无到期摘要、已推送 N 条，还是发送失败且队列已保留。
- 通知 batching 研究支持减少打断，但也提醒 batching 只在符合工作期待时有效。对本地摘要来说，失败不能被吞掉，digest 文案也必须自包含，不能带空群组和无效原消息链接，否则用户无法判断这条摘要到底从哪里来、是否需要补救。
- 本轮进一步把“当前队列里还等着什么”直接显示到 popup 后台任务行。Apple Scheduled Summary 的核心是用户选择哪些通知进入摘要以及接收时间；Slack Activity 则强调 feed 可以筛选、扫读和清理；bounded deferral / notification batching 研究也说明延迟要在“可预期”范围内才不破坏 awareness。因此 Personal AI 不能只说“上次无到期摘要”，还要告诉用户是否有本地摘要正在等待下一次释放。
- 本轮还补齐了失败恢复文案：当本地摘要发送失败时，后台任务状态和最近运行记录都会保留“队列已保留 N 条”的摘要。对低打扰通知来说，失败后的可恢复性和延迟本身同样重要，用户需要明确知道这些摘要没有丢失。
- 本轮继续把失败/等待后的运行记录补成可恢复摘要：`processTask()` 会返回执行后仍留在本地队列里的快照，Task Scheduler 在“队列已保留”或“等待 N 条”后追加关注项和释放节奏明细。这样用户不必再切到另一行状态才能判断失败后保留的是哪些摘要。
- 本轮给 Concerned Items 的 Bot 摘要正文加了 `摘要回执`：用户收到摘要时能直接看到本次释放了多少条、对应每日/每周节奏、未到期条目仍在本地队列，以及 Bot 推送失败不会清除本次条目。这样低打扰摘要不只是“晚点发”，也能解释为什么现在发、失败后是否会丢。
- 本轮继续把 popup 的本地队列状态从一段后端中文文案改成结构化状态：后台任务行现在按当前界面语言分行展示本地待释放总量、已到期数量、最早后续释放时间、摘要任务、关注项和每日/每周节奏；旧 `currentQueueSummary` 仍保留为兜底，避免旧调用方断掉。
- 本轮把 popup 本地队列状态的第一眼边界补清楚：这是 extension 本地延迟摘要队列；查看/刷新只是读状态，不会立即发送、不会写入 Memory Service、不会确认通知。这样用户看到“2 条、暂无到期”时能同时知道它们还在本地等待释放，而不是已经进入服务端 Notification Center 或已经被处理。
- 本轮继续补齐到期态：当已有条目进入释放窗口，状态摘要会显示 `释放窗口回执`，说明这些条目只是具备发送资格，仍要等后台任务推送；刷新状态不会把它们当场发出，也不会写 Memory Service 或确认通知。
- 本轮把本地摘要释放从小时级检查收紧到 15 分钟检查窗口：`digest_queue_process` 每 15 分钟检查一次，Concerned Items digest 的内部 gate 也同步为 15 分钟。发送资格仍由条目自己的每日/每周释放时间决定；更频繁的检查只是减少“刚过释放时间却要等近一小时”的等待，不会让查看/刷新触发发送，也不会增加未到期摘要的打扰。
- 本轮对 Notification Center feed 的 `daily_digest` 语义做了边界收紧：每日摘要可以重新列出已提醒但仍未完成的 `todo`，并用 `already_delivered_unfinished` 标明它不是新待办；但已送达的 `notice` 不会因为调用 daily digest 又重复出现。这样符合“摘要用于处理未完成事项、notice 用于一次性同步”的用户心智。
- 本轮继续补齐 `daily_digest` 的“未完成”边界：channel 已经 `clicked` / `dismissed` 的 todo 不再回到每日摘要；新待办、上次发送失败的待办会排在“已提醒过，仍待处理”的旧待办前面，避免摘要第一屏被重复提醒占住。
- 本轮补齐 Provider/Doubao 摘要的截断回执：正文不会再按字符硬切到半条通知或半句渠道回执，而是按完整条目收口，并说明还有多少条未展示。更关键的是 delivery sourceRefs 只包含可见条目，避免预算截断后把用户没看到的 notice 标成已送达、从后续 feed 中永久消失。
- 本轮把 migration `045` 留下的通知证据字段接到 feed / digest / Chrome context：有 `evidence_refs_json` 的通知会显示“依据 N 条记忆”的只读证据回执，最多露出前三个紧凑来源标签，并明确这不会确认、忽略、重发或改变渠道投递状态。FCM 把 accepted / delivered 这类投递日志用于诊断，Teams read receipt 也区分通知看到和真正读到；Personal AI 这里同样把“为何提醒”和“渠道是否送达/用户是否处理”拆开。
- 本轮给 feed API 本身补了 `meta.hasMore` 回执：当调用方请求 `limit=20` 只拿到 20 条时，`total=20` 不再被误解成“全部只有 20 条”。这和 Slack / Teams Activity feed 的筛选心智一致：用户或渠道消费者需要知道当前看到的是哪种视图、是否还有后续项，而不是只能从返回数组长度猜。
- 本轮继续把 `meta.hasMore` 接到 Provider / Doubao digest：如果摘要只是 feed 前 N 条，正文会追加“Feed 还有更多”，并明确未展示条目还在 feed、不会写入本次渠道送达回执。这样用户能区分“内容太长被预算截断”和“当前摘要本来就是受限页”，同时保持送达写回只覆盖实际可见条目。

本轮对周报 / Dream Digest 的投递目标做了语义对齐：

- Microsoft Viva Digest 把个人 digest 明确做成可 opt out 的个人洞察入口；Apple Scheduled Summary 也强调由用户选择哪些通知进入摘要和何时展示；Slack Activity 则把通知、提醒和 saved views 放在可过滤队列里。对应到 Personal AI，`不推送`、`推送给 Me`、`自定义群组` 必须是后端真实行为，而不能只改变 Options 页文案。
- 研究上，email batching / interruption 相关工作支持“低打扰摘要”但也提醒 batching 只有在符合工作响应预期时才有效。因此周报和 Dream Digest 不能在用户选择 `none` 时仍暗中投递，也不能在选择群组时退回个人私聊；目标错投会破坏用户对摘要节奏和可见范围的信任。
- 本轮进一步把周报正文摘录写入 Notification Center payload，使 Provider digest、Doubao 同步和 Chrome 系统通知都能给出“这份周报讲了什么”。这个改动和 Apple Scheduled Summary / Viva Digest 的产品取向一致：摘要通知应该帮助用户判断是否现在进入详情，而不是只告诉用户“有一份报告”。
- 本轮还把周报点击落点从梦境重放拆到 `/reports`：Slack AI / Teams Recap 的共同模式是“摘要先帮用户判断价值，点击后进入对应内容或行动项”，而不是进入相邻但语义不同的汇总页。Dream Digest 则保留 `/dreams` 的低置信回放语义，但 payload 有文件线索时会带 `file` query 并展开对应 dream，避免用户从总页重新猜哪条 dream 对应刚收到的通知。
- 本轮补齐周报通知目标缺失时的兜底体验：如果通知里的 `reportPath` 指向旧文件，页面不再把缺失文件塞成一条假列表项并停在读取错误，而是显示缺失目标回执并打开最新可用周报。这样符合摘要通知的心智：通知负责带路和说明状态，报告正文仍来自 `reports/` 里真实存在的已生成文件。
- 本轮把 Options 里的“立即推送”结果从短 toast 升级成配置区内的结构化回执：用户能看到 `none` 是否真的没有写通知、群组 Bot 失败时周报 notice 是否仍已写入、Dream Digest 纳入了几个 dream 和最新落点；当内容已生成但 Bot 或 notice 未完整确认时，状态会显示“已生成，投递部分失败”，不再用纯成功样式掩盖部分失败。这对应 Apple Scheduled Summary 的“选择并确认摘要范围”、Viva Insights 的个人 digest opt-out、Slack Activity 的可过滤队列心智：摘要必须暴露目标和状态，不能只给一句“已推送”。
- 本轮继续把手动触发的提交中状态也纳入同一个回执：点击后立即显示本次使用的当前可见目标，`none` 目标说明不请求通知写入或 Bot 投递，`me/group` 目标说明正在等待 notice 写入和 Bot 投递确认；旧结果不会在新请求等待期间继续占位，避免用户误以为刚切换后的请求仍沿用上一轮目标。

参考：

- [Android Notifications](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications)
- [Microsoft Teams Activity Feed](https://support.microsoft.com/en-us/office/explore-the-activity-feed-in-microsoft-teams-91c635a1-644a-4c60-9c98-233db3e13a56)
- [Microsoft Viva Insights opt-out](https://support.microsoft.com/en-us/viva/insights/opt-out-of-viva-insights)
- [Apple notification summaries](https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios)
- [Slack Activity view](https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack)
- [Email Duration, Batching and Self-interruption](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/06/Email20Duration20Camera20Ready20submission3-1.pdf)
- [Slack Activity view](https://slack.com/help/articles/19693583638803-Get-your-work-done-from-the-Activity-view)
- [Slack notification settings](https://slack.com/help/articles/201355156-Configure-your-Slack-notifications)
- [GitHub Notifications Inbox](https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)
- [Microsoft Teams notification settings](https://support.microsoft.com/en-us/teams/notifications-settings/manage-notifications-in-microsoft-teams)
- [Intelligent Notification Systems: A Survey](https://arxiv.org/abs/1711.10171)
- [Effects of Intelligent Notification Management on Users and Their Tasks](https://interruptions.net/literature/Iqbal-CHI08.pdf)
- [Real-world large-scale study on adaptive notification scheduling](https://www.sciencedirect.com/science/article/abs/pii/S1574119217304388)
- [Reachable but not receptive](https://www.sciencedirect.com/science/article/abs/pii/S1574119217300640)
- [Twilio Outbound Message Status Callbacks](https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks)
- [OneSignal Confirmed Delivery](https://documentation.onesignal.com/docs/en/confirmed-delivery)
- [Firebase Cloud Messaging delivery data](https://firebase.google.com/docs/cloud-messaging/understand-delivery)
- [Microsoft Teams read receipts](https://support.microsoft.com/en-us/office/use-read-receipts-for-messages-in-microsoft-teams-533f2334-32ef-424b-8d56-ed30e019f856)
- [A State Transition Model for Mobile Notifications via Survival Analysis](https://arxiv.org/abs/2207.03099)
- [Apple Scheduled Summary](https://support.apple.com/guide/iphone/change-notification-settings-iph7c3d96bab/ios)
- [Slack AI features](https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack)
- [Microsoft Teams Recap](https://support.microsoft.com/en-us/office/recap-in-microsoft-teams-c2e3a0fe-504f-4b2c-bf85-504938f110ef)
- [Email Duration, Batching and Self-interruption](https://www.microsoft.com/en-us/research/publication/email-duration-batching-and-self-interruption-patterns-of-email-use-on-productivity-and-stress/)
- [Batching smartphone notifications can improve well-being](https://www.sciencedirect.com/science/article/abs/pii/S0747563219302596)
- [Balancing Awareness and Interruption](https://www.microsoft.com/en-us/research/publication/balancing-awareness-interruption-investigation-notification-deferral-policies/)
- [Email message batching study](https://www.sciencedirect.com/science/article/pii/S221478292200001X)

---

## 6. 关键文件

### Notification Center

- `memory-service/src/core/NotificationCenterService.ts`
- `memory-service/src/repositories/ChannelDeliveryRepository.ts`
- `memory-service/src/routes/notificationCenter.ts`
- `memory-service/src/routes/notifications.ts`
- `memory-service/src/core/ProviderContextService.ts`
- `memory-service/src/storage/migrations/015_channel_delivery_records.sql`

### Doubao / Chrome / Glip 接入

- `desktop-app/src/syncManager.ts`
- `desktop-app/src/bridgeService.ts`
- `desktop-app/src/memoFormatter.ts`
- `src/background.ts`
- `src/backendNotifications.ts`
- `src/services/MemoryServiceClient.ts`

### DigestQueueService

- `src/services/DigestQueueService.ts`
- `src/services/digestQueueConfig.ts`
- `src/types/digestQueue.ts`
- `src/message-reaction/FollowThreadHandler.ts`
- `src/services/TaskScheduler.ts`
- `src/services/taskSchedulerDefinitions.ts`
- `src/popup.tsx`
