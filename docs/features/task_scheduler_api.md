# 任务调度器 API

## 概述

`TaskScheduler` 是扩展后台业务任务的统一调度入口，负责管理所有 `scheduled_task_*` Chrome alarm、任务开关、手动执行和状态持久化。它运行在 `background.ts` 中，面向 popup、记忆入口等 UI 暴露消息 API。

当前实现遵循 Manifest V3 的约束：

- alarm 监听器在 `background.ts` 顶层同步注册，避免 Service Worker 冷启动时漏事件
- 任务开关、上次执行时间和下次执行时间存储在 `chrome.storage.local.taskSchedulerStates`
- 每次 Service Worker 启动都会按 Storage 状态补齐或清理 `scheduled_task_*` alarm
- 每次查询任务状态也会刷新 alarm 实况，避免 popup 显示过期的 `nextRun`
- 重复启动会复用同一个启动流程，避免首次运行和 alarm 创建并发
- 已禁用任务即使收到残留 alarm 也会被跳过并清理
- 读取旧版/部分写入的 `taskSchedulerStates` 时，如果某个任务缺少 `enabled` 字段，会回退到任务定义默认值，而不是把默认启用任务误判为关闭
- 启用任务只会创建排程，不会暗中立即执行；需要一次性执行时应调用手动执行动作
- 创建 Chrome alarm 失败时会回滚本次启用状态并把真实错误返回给调用方，避免 popup 卡在“已启用但无排程”的状态
- 每个任务会保存最近 5 次完成记录，用于 popup 快速判断失败是否偶发、是否连续发生

`background.ts` 仍有少量非 `TaskScheduler` 的专用 alarm，例如 `cleanupFollowThreads` 和 `pollBackendNotifications`。这些不是 `scheduled_task_*` 任务，但创建时也会先检查现有 alarm，避免 Service Worker 每次唤醒都重置下一次触发时间。

## 当前任务

| 任务 ID                       | 名称             | 默认间隔 | 当前执行逻辑                                    |
| ----------------------------- | ---------------- | -------- | ----------------------------------------------- |
| `message_analysis`            | 静默消息分析     | 动态配置 | 拉取 RingCentral 消息并调用 `analyzeMessages()` |
| `memory_sync`                 | 记忆系统同步     | 5 分钟   | 同步 concerned items 配置                       |
| `system_monitoring`           | 系统健康监控     | 60 分钟  | 调用 memory-service health API                  |
| `user_profile_decay`          | 用户画像权重衰变 | 24 小时  | 后端自动处理，扩展侧保留 no-op 日志             |
| `vectorized_data_maintenance` | 向量化数据维护   | 12 小时  | 后端自动处理，扩展侧保留 no-op 日志             |
| `user_summary_generation`     | 用户概要生成     | 7 天     | 读取 memory-service stats 用于日志              |
| `vector_quality_check`        | 向量质量检查     | 3 天     | 检查 memory-service health/stats                |
| `digest_queue_process`        | 汇总推送队列处理 | 60 分钟  | 处理关注后续、每日摘要等 digest 队列            |

`message_analysis` 的间隔优先读取 `envConfig.MESSAGE_ANALYSIS_INTERVAL`，再回退到旧的 `envConfig.SCHEDULED_INTERVAL`，最后使用 30 分钟默认值。

## 消息 API

### 获取任务状态

```ts
chrome.runtime.sendMessage(
  { type: 'GET_TASK_SCHEDULER_STATUS' },
  (response) => {
    console.log(response.tasks);
  },
);
```

返回值：

```ts
{
  success: true,
  tasks: [
    {
      id: 'message_analysis',
      name: '静默消息分析',
      category: 'message_analysis',
      intervalMinutes: 120,
      description: '自动分析RingCentral消息，提取关键信息',
      enabled: true,
      status: 'running',
      lastRun: 1777600000000,
      lastCompletedAt: 1777600100000,
      lastSuccess: true,
      lastError: undefined,
      nextRun: 1777607200000,
      isExecuting: false,
      scheduleHealth: 'scheduled',
      scheduleWarning: undefined,
      runHistory: [
        {
          startedAt: 1777600000000,
          completedAt: 1777600100000,
          durationMs: 100000,
          success: true,
          trigger: 'manual'
        }
      ]
    }
  ]
}
```

调用该 API 时，background 会先确保 `TaskScheduler` 已启动，并实时核对 `scheduled_task_*` alarm。若启用任务的 alarm 丢失或间隔不一致，会按 Storage 状态自动补齐/修复，再返回最新 `nextRun`。

`scheduleHealth` 用于 UI 判断排程是否健康：

- `scheduled`：任务已启用且 Chrome alarm 存在
- `missing_alarm`：任务已启用但未找到 alarm，通常会被状态刷新自动修复
- `period_mismatch`：任务定义和现有 alarm 间隔不一致，通常会被状态刷新自动修复
- `disabled`：任务已停用，无需排程

### 控制任务

启用或停用任务：

```ts
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',
  action: 'toggle',
  enabled: true,
});
```

手动执行任务：

```ts
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'digest_queue_process',
  action: 'run',
});
```

返回值：

```ts
{ success: true, message: '任务状态已更新' }
```

如果任务 ID 不存在、操作不支持或调度器启动失败，会返回：

```ts
{ success: false, error: '错误信息' }
```

启用或停用失败时，调度器会保留变更前的启用状态和 `nextRun`。手动执行失败时，`error` 会尽量带回真实任务失败原因；popup 会在显示错误前刷新任务列表，因此上次失败时间、失败原因和执行状态会保持一致。手动执行不会重排已有 alarm，`nextRun` 以 Chrome 当前 alarm 的 `scheduledTime` 为准。如果同一个任务已有实例正在执行，新的手动或排程触发会被跳过；调度器会记录 `lastSkippedAt`、`lastSkipReason` 和一条 `runHistory.skipped`，但不会把它当成任务失败覆盖 `lastSuccess`。

## 辅助函数

### getTaskEnabled

```ts
import { getTaskEnabled } from './services/taskSchedulerDefinitions';

const enabled = await getTaskEnabled('message_analysis');
```

用于读取单个任务的启用状态。若 Storage 中没有保存状态，会返回任务定义里的默认值。

### onTaskEnabledChanged

```ts
import { onTaskEnabledChanged } from './services/taskSchedulerDefinitions';

const unsubscribe = onTaskEnabledChanged('message_analysis', (enabled) => {
  console.log('message_analysis enabled:', enabled);
});
```

用于监听任务开关变化。React 组件应在 `useEffect` 清理函数里调用 `unsubscribe()`。

## UI 入口

Popup 顶部保留静默消息分析的快捷开关。开关现在会等待 `CONTROL_TASK` 的真实返回结果，失败时回滚状态并显示错误。

Popup 还提供可展开的后台任务概览：

- 查看所有任务是否启用、是否正在执行、执行间隔、下次执行时间和排程健康
- 摘要会优先提示执行中、排程异常或失败任务数量
- 展开后会把执行中、排程异常和失败的任务排在前面，减少排查时滚动查找
- 查看最近一次执行成功/失败结果，失败时显示简短错误
- 查看最近 5 次运行的成功/失败概览，悬停可看到每次运行的触发来源和耗时
- 查看最近 5 次运行里的跳过记录，用于判断是否存在长任务挤压后续排程
- 刷新任务状态
- 单独启用/停用任务，列表会先给出本地反馈，失败时回滚
- 已停用任务会显示“停用 · 可手动执行”，手动执行只运行一次，不会隐式启用排程
- 手动执行某个任务，按钮会立即进入执行中状态并在完成后刷新；失败或跳过原因会保留在任务结果和历史里，不会被刷新动作清掉

## 维护规则

- 新增后台业务任务时，优先加入 `src/services/taskSchedulerDefinitions.ts` 的 `TASK_DEFINITIONS` 和 `src/services/TaskScheduler.ts` 的 `executeTask()`
- popup、content script 或普通 UI 只需要读取任务开关时，导入 `src/services/taskSchedulerDefinitions.ts`，不要直接拉入完整后台调度器
- `scheduled_task_*` alarm 只能由 `TaskScheduler` 创建和清理
- 长耗时或可能产生副作用的任务需要保证可重复执行；调度器会跳过同一任务的并发重复触发
- 被跳过的重复触发不是业务失败，但要进入最近运行历史，方便发现任务耗时过长或排程间隔过短
- 任务执行失败应向 `executeTask()` 抛出错误，由调度器统一记录 `lastSuccess` / `lastError`；不要在子任务里吞掉真实失败
- 如果任务需要启用后立即同步，应让用户点击“立即执行”，不要把副作用隐藏在启用开关里
- 如果任务实际由 memory-service 后端托管，扩展侧任务应保留为轻量 health/stats/no-op，而不是重复实现维护逻辑
- 旧的 `CONTROL_SCHEDULED_CHECK` 已废弃，新的 UI 和代码应使用 `CONTROL_TASK`

## 验证建议

1. 运行开发构建：`npm start`，等待首次 compile 成功后停止 watch
2. 打开 popup，展开后台任务概览，确认能看到 8 个任务
3. 切换 `message_analysis`，确认顶部开关状态、任务列表状态与刷新后的任务列表一致
4. 启用一个已停用任务，确认只创建 alarm，不会更新 `lastRun`
5. 手动执行 `digest_queue_process` 或轻量 no-op 任务，确认执行中状态短暂出现，`lastRun` / `lastCompletedAt` / `lastSuccess` / `runHistory` 更新并持久化
6. 在 Service Worker 控制台检查 `chrome.alarms.getAll()`，确认 `scheduled_task_*` 数量与启用任务一致
7. 运行 `npm run verify:task-scheduler-api`，覆盖启用不立即执行、alarm 创建失败回滚、手动执行、失败记录、跳过记录、最近运行历史、重复执行跳过和状态刷新补齐丢失 alarm
