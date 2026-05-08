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
- Doubao 成功后只写 delivery 回执，不自动全局 `acknowledge`

对应实现：

- `doubao-bridge/src/syncManager.ts`
- `doubao-bridge/src/bridgeService.ts`
- `doubao-bridge/src/memoFormatter.ts`

### 2.3 Chrome

Chrome extension 优先从 `notification-center/feed` 拉取消息。

行为上：

- 展示成功 -> 记录 `delivered`
- 用户点“查看” -> 记录 `clicked`，并对 `notification:*` 做全局 `acknowledge`
- 用户点“忽略” -> 记录 `dismissed`，并对 `notification:*` 做全局 `dismiss`
- `proposed_action:*` 只记录渠道事件，不直接改全局通知状态

对应实现：

- `src/background.ts`
- `src/services/MemoryServiceClient.ts`

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

---

## 5. 关键文件

### Notification Center

- `memory-service/src/core/NotificationCenterService.ts`
- `memory-service/src/repositories/ChannelDeliveryRepository.ts`
- `memory-service/src/routes/notificationCenter.ts`
- `memory-service/src/core/ProviderContextService.ts`
- `memory-service/src/storage/migrations/015_channel_delivery_records.sql`

### Doubao / Chrome / Glip 接入

- `doubao-bridge/src/syncManager.ts`
- `doubao-bridge/src/bridgeService.ts`
- `doubao-bridge/src/memoFormatter.ts`
- `src/background.ts`
- `src/services/MemoryServiceClient.ts`

### DigestQueueService

- `src/services/DigestQueueService.ts`
- `src/types/digestQueue.ts`
- `src/message-reaction/FollowThreadHandler.ts`
- `src/services/TaskScheduler.ts`
- `src/services/taskSchedulerDefinitions.ts`

