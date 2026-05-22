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

对应实现：

- `memory-service/src/core/ProviderContextService.ts`

### 2.2 Doubao

Doubao 现在分两条同步路径：

- `todo_sync` -> 写 Doubao 待办
- `notice_sync` -> 写普通 `mobile_context`

关键约束：

- `todo` 文案不能带 `✅`
- `notice` 不应该写成待办
- `dream_digest` / 周报这类 notice 会把 `payload` 里的摘要详情纳入同步内容，避免只同步“生成了 N 条内容”的空壳提示
- Doubao 成功后只写 delivery 回执，不自动全局 `acknowledge`

对应实现：

- `desktop-app/src/syncManager.ts`
- `desktop-app/src/bridgeService.ts`
- `desktop-app/src/memoFormatter.ts`

### 2.3 Chrome

Chrome extension 优先从 `notification-center/feed` 拉取消息。

行为上：

- 展示成功 -> 记录 `delivered`
- 用户点“查看” -> 记录 `clicked`，并对 `notification:*` 做全局 `acknowledge`
- 用户点关闭类按钮 -> 记录 Chrome 渠道 `dismissed`；`notification:*` 的 notice 做全局 `dismiss`，待办类通知走 snooze 延后
- `proposed_action:*` 只记录渠道事件，不直接改全局通知状态；“暂不提醒”写回 `delivered` 触发待办冷却，而不是永久 `dismissed`
- 用户直接关闭系统通知时，不自动改全局通知状态；todo 写回 `delivered` 进入短期冷却，notice 写回 `dismissed` 不再重复打扰
- 通知弹窗会用 `contextMessage` 标出“待处理/通知”、优先级和待办截止时间，降低用户判断成本
- `dream_digest` 这类通知的系统弹窗预览会优先用 payload 摘要片段，而不是只展示计数型 body
- `proposed_action:*` 的“查看待办”会打开动作队列并定位对应 action；`project_update` / `property_change` 这类 notice 会打开时间轴；周报和 dream digest 仍进入梦境重放
- Chrome 通知的来源元数据会同时保存在 `chrome.storage.local`，避免 MV3 service worker 被回收后点击 / 忽略操作无法回写通知中心
- 对 `notification:*` 的待办类系统通知，第二按钮是“稍后提醒”；没有截止时间时默认延后 24 小时，有截止时间时会尽量在截止前再次提醒，避免把待办直接延到过期后。notice 使用“不再提示”，`proposed_action:*` 使用“暂不提醒”且只记录渠道事件

对应实现：

- `src/background.ts`
- `src/backendNotifications.ts`
- `src/services/MemoryServiceClient.ts`
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

它由 `TaskScheduler` 每小时触发一次 `digest_queue_process`：

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

参考：

- [Android Notifications](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications)
- [Microsoft Teams Activity Feed](https://support.microsoft.com/en-us/office/explore-the-activity-feed-in-microsoft-teams-91c635a1-644a-4c60-9c98-233db3e13a56)
- [Slack Activity view](https://slack.com/help/articles/46751260742035-Introducing-the-new-Activity-view-in-Slack)
- [GitHub Notifications Inbox](https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/viewing-and-triaging-notifications/managing-notifications-from-your-inbox)
- [Intelligent Notification Systems: A Survey](https://arxiv.org/abs/1711.10171)
- [Real-world large-scale study on adaptive notification scheduling](https://www.sciencedirect.com/science/article/abs/pii/S1574119217304388)
- [Reachable but not receptive](https://www.sciencedirect.com/science/article/abs/pii/S1574119217300640)

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
- `src/types/digestQueue.ts`
- `src/message-reaction/FollowThreadHandler.ts`
- `src/services/TaskScheduler.ts`
- `src/services/taskSchedulerDefinitions.ts`
