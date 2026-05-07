# DigestQueueService - 通用定时汇总推送队列服务

> 设计目标：提供一个通用的定时批量推送队列服务，可供"关注后续合并通知"、concernedItems 每日摘要、Jira 周报、项目分析等多种场景接入，支持各任务独立配置推送频率和格式。

---

## 架构概览

```
┌───────────────────────── 数据生产者 ─────────────────────────┐
│ FollowThreadHandler │ messageDealing │ Jira(future) │ ...  │
└──────────┬──────────┴───────┬────────┴───────┬───────┴──────┘
           │                  │                │
           ▼                  ▼                ▼
┌──────────────────── DigestQueueService ────────────────────┐
│                                                            │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ 队列存储     │   │ 处理器注册表   │   │ 频率调度器     │  │
│  │ (Chrome     │◄──│ (Map<id,     │◄──│ (检查各任务    │  │
│  │  Storage)   │   │  Processor>) │   │  shouldRun)   │  │
│  └─────────────┘   └──────────────┘   └────────────────┘  │
│                                                            │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌──────────────── 消费/推送渠道 ──────────────────┐
│ NotificationService (Bot / Chrome)             │
│ memory-exploring.vue (UI展示, Phase 2)         │
└────────────────────────────────────────────────┘
```

## 核心设计

### 类型定义 (`src/types/digestQueue.ts`)

```typescript
// 推送频率
type DigestFrequency =
  | { type: 'hourly' }
  | { type: 'daily'; hour: number }
  | { type: 'weekly'; dayOfWeek: number; hour: number }
  | { type: 'custom'; intervalMinutes: number };

interface DigestConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  preferredHour?: number;
  preferredDayOfWeek?: number; // 0=周日, 1=周一
}

// 队列中的单个条目
interface DigestQueueItem {
  id: string;
  data: Record<string, any>;
  createdAt: string;
  sourceId?: string;
}

// 存储在 chrome.storage 中的队列
interface DigestQueueBucket {
  taskId: string;
  items: DigestQueueItem[];
  lastProcessedAt?: string;
}

// 处理器接口（由各场景实现）
interface DigestProcessor {
  collect(items: DigestQueueItem[]): Promise<DigestQueueItem[]>;
  format(items: DigestQueueItem[]): Promise<string>;
  getNotifyConfig(): { notifyMethod: string; mention?: boolean };
}

// 注册的 Digest 任务
interface DigestTaskRegistration {
  id: string;
  name: string;
  frequency: DigestFrequency;
  processor: DigestProcessor;
  enabled: boolean;
  lastExecutedAt?: string;
}
```

### DigestQueueService (`src/services/DigestQueueService.ts`)

单例服务，提供以下核心方法：
- `register(task)`: 注册一个 Digest 任务及其处理器
- `enqueue(taskId, item)`: 将条目加入指定任务的队列
- `processAll()`: 检查所有注册任务，对到期的执行处理和推送
- `processTask(taskId)`: 手动触发处理某个任务

### 与 TaskScheduler 的集成

在 `TASK_DEFINITIONS` 中新增一个 `digest_queue_process` 任务，每小时触发一次。
该任务调用 `DigestQueueService.processAll()` 来检查并推送到期的 digest 任务。

---

## Phase 1 实现

### P1.1 关注后续合并通知

改造原有 `queueMergedNotification`，使其通过 `DigestQueueService.enqueue()` 入队。
注册 `follow_thread_merged` 处理器，每小时检查并合并推送。

### P1.2 ConcernedItems 每日消息摘要

在 `TopicItemWithAutoReply` 中新增 `digestConfig` 字段。
当用户勾选后，匹配到的消息不立即推送，而是带着该规则自己的 `digestConfig` 入队到 `concerned_items_daily`。
队列任务每小时检查一次，仅释放已经到达该规则每日/每周本地推送时间的条目；旧条目没有规则级配置时使用全局默认小时。

实现注意：
- `DigestQueueService` 对 chrome.storage 的入队/消费使用串行写入保护，避免并发消息同时入队时互相覆盖。
- 队列条目按 `id` 幂等入队；ConcernedItems 摘要使用 `ruleId + postId` 作为稳定条目 ID，重复分析同一消息不会重复出现在摘要里。
- 规则编辑 UI 允许设置每日/每周、每周发送日和 0-23 点推送时间，展示 chip 会显示实际摘要时间，并在配置区提示下一次摘要时间。
- 摘要推送失败或格式化为空时不会删除队列条目，保留到下次调度重试。
- ConcernedItems 摘要按规则 ID 分组，避免多个同名规则被合并成一个摘要区块。

---

## Phase 2 规划

| 场景 | 频率 | 数据源 | 推送内容 |
|------|------|--------|----------|
| 本周消息分析报告 | 每周 | 消息记录 + LLM | 关键变化和 actions |
| 用户画像变化报告 | 每周 | 用户画像系统 | 显著变化汇总 |
| Jira Ticket 状态周报 | 每周一 | JQL 查询 | 完成/新增/阻塞 tickets |
| Jira 即将到期提醒 | 每日 | JQL: duedate | 3天内到期 tickets |
| 我的待办雷达 | 每日 | assignee=me | 排序优先级建议 |
| Google Sheets 变化监控 | 每日 | Sheets API | 关键列变化 |
| 项目进度周报 | 每周 | Slides + Jira | 状态变化 |
| 行动项追踪 | 每日 | LLM 提取 | 未完成 action items |
| 协作者活跃度 | 每周 | 用户画像 | 沟通频率变化 TOP5 |
| 风险预警汇总 | 每日 | 多源聚合 | 识别到的风险信号 |

---

## 数据存储

Chrome Storage key: `digestQueues`

```json
{
  "follow_thread_merged": {
    "taskId": "follow_thread_merged",
    "items": [
      { "id": "...", "data": { "message": {...}, "relationType": "..." }, "createdAt": "..." }
    ],
    "lastProcessedAt": "2026-02-03T10:00:00Z"
  },
  "concerned_items_daily": {
    "taskId": "concerned_items_daily",
    "items": [...],
    "lastProcessedAt": "..."
  }
}
```

---

## 关键文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types/digestQueue.ts` | 新增 | 类型定义 |
| `src/services/DigestQueueService.ts` | 新增 | 核心队列服务、ConcernedItems 到期释放逻辑 |
| `src/services/TaskScheduler.ts` | 修改 | 注册 digest_queue_process 任务 |
| `src/message-reaction/FollowThreadHandler.ts` | 修改 | 迁移到新服务 |
| `src/message-reaction/AutoReplyHandler.ts` | 修改 | 添加 digestConfig 类型 |
| `src/modals/topic-modal.tsx` | 修改 | 添加摘要配置 UI |
| `tools/verify-digest-queue-service.ts` | 新增 | 验证并发入队和摘要释放规则 |
