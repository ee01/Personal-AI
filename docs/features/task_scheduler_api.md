# 任务调度器 API

## 概述

`TaskScheduler` 是扩展后台业务任务的统一调度入口，负责管理所有 `scheduled_task_*` Chrome alarm、任务开关、手动执行和状态持久化。它运行在 `background.ts` 中，面向 popup、记忆入口等 UI 暴露消息 API。

当前实现遵循 Manifest V3 的约束：

- alarm 监听器在 `background.ts` 顶层同步注册，避免 Service Worker 冷启动时漏事件
- 任务开关、上次执行时间和下次执行时间存储在 `chrome.storage.local.taskSchedulerStates`
- 每次 Service Worker 启动都会按 Storage 状态补齐或清理 `scheduled_task_*` alarm
- 创建 `scheduled_task_*` alarm 时会优先显式设置跨会话持久化；如果当前 Chromium 尚不支持该字段，会自动降级到默认 alarm 行为。即便浏览器重启后 alarm 被清掉，Service Worker 启动和状态刷新也会按 Storage 状态重建
- 每次查询任务状态也会刷新 alarm 实况，避免 popup 显示过期的 `nextRun`
- 如果旧版本留下已不存在任务定义的 `scheduled_task_*` alarm，会在启动、状态刷新或触发时自动清理，避免无意义唤醒和占用 Chrome alarm 配额
- 如果某个启用任务的 alarm 仍存在但触发时间已经明显滞后，状态会标记为 `overdue`，popup 会把它排到前面并提示用户手动执行或重新启用排程
- 对已启用但排程异常的任务，popup 可调用修复动作重新创建该任务的 Chrome alarm，不需要用户手动关开开关
- 重复启动会复用同一个启动流程，避免初始化和 alarm 创建并发
- 已禁用任务即使收到残留 alarm 也会被跳过并清理
- 读取旧版/部分写入的 `taskSchedulerStates` 时，如果某个任务缺少 `enabled` 字段，会回退到任务定义默认值，而不是把默认启用任务误判为关闭
- 如果 storage reset、迁移或部分写入让某个任务的状态 row 消失，读取和监听都会回退到任务定义默认值，已经打开的 popup / 规则页不会继续显示旧开关
- 启用任务只会创建排程，不会暗中立即执行；需要一次性执行时应调用手动执行动作
- 首次安装或 Service Worker 启动只恢复排程，不会额外安排一次默认启用任务的隐藏执行
- 创建 Chrome alarm 失败时会回滚本次启用状态并把真实错误返回给调用方，避免 popup 卡在“已启用但无排程”的状态
- 重排或间隔配置变化时会直接同名替换 Chrome alarm，不会先清掉旧 alarm；如果替换失败，旧排程会尽量保留，并把真实错误显示成 `repair_failed`
- popup 点击重排后，在后台 `CONTROL_TASK` 和随后的状态刷新确认前，任务行保留原排程异常，并显示 `重排确认中` 回执；不会先把任务乐观改成已排程或伪造 `nextRun`
- `message_analysis` 的动态间隔会过滤低于 Chrome alarm 最小间隔的无效值，再回退到旧配置或 30 分钟默认值
- 状态刷新时如果某个任务的 alarm 自动修复失败，不会让整组任务状态不可用；该任务会显示 `repair_failed` 和真实错误，用户仍可重试修复或停用任务
- 每个任务会保存最近 5 次完成记录，用于 popup 快速判断失败是否偶发、是否连续发生
- 任务可以显式返回“跳过”结果；跳过不会被算作失败，但会记录跳过时间、原因和最近历史，方便区分“执行成功”和“没有产生有效工作”
- 每次返回任务状态都会附带 `statusReceipt`，把当前生命周期、原因和下一步动作结构化出来。它只解释已有状态，不会额外触发执行、修复或停用
- 每次任务状态刷新还会返回 `refreshReceipt`，说明本次只核对任务状态并校准 Chrome alarm；即使刷新过程补齐、重排或清理了 alarm，也不代表任务已立即执行、被启用/停用，或清空了运行历史
- 如果刷新时任务状态读取成功但某个附属明细没有确认，例如 `digest_queue_process` 的本地摘要队列状态读取失败，`refreshReceipt` 会计入未确认队列明细，任务行会显示失败原因和 no-send/no-write/no-confirm 边界
- 如果 popup 刷新任务状态失败，会清掉上一条成功刷新回执并显示 `刷新未确认` 回执；下方旧任务列表会保留，但错误条和回执都会明确说明那只是上次快照，当前 Chrome alarm 和执行状态没有被确认，也没有执行、启停、修复任务或清空历史
- `message_analysis` 会先检查用户资料是否完整，再查找或创建 RingCentral 标签页；资料缺失时只记录跳过原因，不会无意义打开后台页面
- 停用任务仍可手动执行一次；例如 `memory_sync` 停用后点击手动执行会立即同步一次，但不会重新启用排程

`background.ts` 仍有少量非 `TaskScheduler` 的专用 alarm，例如 `cleanupFollowThreads` 和 `pollBackendNotifications`。这些不是 `scheduled_task_*` 任务，但创建时也会先检查现有 alarm，避免 Service Worker 每次唤醒都重置下一次触发时间。

## 大白话运行逻辑

Task Scheduler 是扩展后台的“闹钟管家”。它不负责具体业务怎么做，只负责根据任务定义和用户开关创建 Chrome alarm、恢复丢失的 alarm、记录最近执行结果，并让 popup 能手动执行或修复。

结果主要受这些因素影响：

1. 任务定义默认值：每个任务的默认启用状态、间隔和执行函数是基础。
2. `chrome.storage.local.taskSchedulerStates`：这是开关、上次执行、下次执行和历史结果的真源。
3. Chrome alarm 实况：MV3 Service Worker 可能重启或 alarm 丢失，所以每次启动/查询都要对齐实况。
4. 执行返回语义：success、failure、skipped、overdue、repair_failed 会进入 UI，而不是只看有没有抛错。
5. 手动执行与启用分离：禁用任务也可以手动跑一次，但不会因此重新启用排程。
6. 缺失状态按定义回退：当本地状态被清空或迁移还没写完整时，用户看到的是任务定义默认值，不是旧 UI 缓存。
7. 状态回执只做解释：`statusReceipt` 会把执行中、排程异常、跳过、失败、停用和等待首次执行这些状态转成用户能理解的“当前 / 原因 / 下一步”，但不会代替真正的任务状态。

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
      ],
      statusReceipt: {
        state: 'healthy',
        tone: 'running',
        label: '最近成功',
        detail: '完成 06/08 10:30',
        nextAction: '保持排程，异常时再处理'
      }
    }
  ],
  refreshReceipt: {
    checkedAt: 1777600005000,
    checkedTaskCount: 8,
    enabledTaskCount: 7,
    scheduleAttentionCount: 0,
    autoRepairAttempted: true,
    createdAlarms: 0,
    updatedAlarms: 0,
    clearedAlarms: 0,
    orphanedAlarmsCleared: 0,
    disabledAlarmsCleared: 0,
    failedRepairs: 0,
    queueStatusUnavailableCount: 0,
    alarmCalibrations: [
      {
        taskId: 'system_monitoring',
        taskName: '系统健康监控',
        action: 'created'
      }
    ],
    refreshOnly: true
  }
}
```

调用该 API 时，background 会先确保 `TaskScheduler` 已启动，并实时核对 `scheduled_task_*` alarm。若启用任务的 alarm 丢失或间隔不一致，会按 Storage 状态自动补齐/修复，再返回最新 `nextRun`。

`scheduleHealth` 用于 UI 判断排程是否健康：

- `scheduled`：任务已启用且 Chrome alarm 存在
- `missing_alarm`：任务已启用但未找到 alarm，通常会被状态刷新自动修复
- `period_mismatch`：任务定义和现有 alarm 间隔不一致，通常会被状态刷新自动修复
- `overdue`：任务已启用且 alarm 存在，但计划触发时间已经超过容忍窗口
- `repair_failed`：状态刷新尝试补齐或重建 alarm 失败，返回值会包含可见错误
- `disabled`：任务已停用，无需排程

`statusReceipt` 用于让 UI 直接展示状态解释。常见状态包括：

- `executing`：任务正在跑，下一步是等待完成
- `schedule_attention`：Chrome alarm 丢失、间隔不一致、逾期或修复失败，下一步通常是重排或先立即执行再重排
- `recent_skip`：最近一次触发被跳过，例如已有执行中任务或前置条件不足，下一步是等待条件恢复
- `failed`：最近运行失败，连续失败会提示先暂停排程并检查服务配置
- `healthy` / `idle` / `disabled`：分别表示最近成功、启用但尚未完成首次执行、停用但可手动执行一次

`refreshReceipt` 用于解释这次状态查询本身的范围：

- `checkedTaskCount` / `enabledTaskCount`：这次核对了多少任务、多少启用排程
- `createdAlarms` / `updatedAlarms` / `clearedAlarms` / `failedRepairs`：状态刷新为了让 Chrome alarm 和本地状态一致而做的校准结果；失败会继续留在任务行的 `scheduleHealth` / `scheduleWarning`
- `alarmCalibrations`：列出本次自动补齐、重排、清理残留、清理已停用或修复失败的具体任务；popup 只展示前几项，避免用户只看到计数后还要扫完整列表猜哪一行被改过
- `queueStatusUnavailableCount`：任务主体状态已返回，但本地摘要队列等附属明细没有读到的数量；这不是任务执行结果，也不代表摘要已发送或通知已确认
- `refreshOnly: true`：强调刷新只读状态并校准排程，不会立即执行任务、启用或停用任务，也不会清空运行历史

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

修复或重排已启用任务的 Chrome alarm：

```ts
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'system_monitoring',
  action: 'repair',
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

启用或停用失败时，调度器会保留变更前的启用状态和 `nextRun`。手动执行失败时，`error` 会尽量带回真实任务失败原因；popup 会先刷新任务列表并显示失败操作回执，因此上次失败时间、失败原因和执行状态会保持一致，且用户能看到这次只是一次性执行、没有隐式改变自动排程或清空运行历史。手动执行不会重排已有 alarm，`nextRun` 以 Chrome 当前 alarm 的 `scheduledTime` 为准。如果同一个任务已有实例正在执行，新的手动或排程触发会被跳过；调度器会记录 `lastSkippedAt`、`lastSkipReason` 和一条 `runHistory.skipped`，但不会把它当成任务失败覆盖 `lastSuccess`。如果任务自身判断前置条件不满足，也可以返回跳过结果；这类跳过会显示原因，但不计入连续失败。只有控制请求或状态刷新本身不可用时，popup 才显示全局错误。

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

监听器和 `getTaskEnabled()` 使用同一套默认值规则：如果 storage 里没有该任务、该任务缺少 `enabled`，或整组状态被清空，都会按任务定义默认值返回。依赖静默消息分析状态的 popup / 规则页应使用这个 helper，避免直接解析 `taskSchedulerStates` 后在 reset 场景里显示旧状态。

## UI 入口

Popup 顶部保留静默消息分析的快捷开关。开关现在会等待 `CONTROL_TASK` 的真实返回结果，失败时回滚状态并显示错误。后台确认前会显示 `排程启用/停用提交中` 回执，说明当前仍是上次确认状态，尚未执行任务、确认 Chrome alarm、更新下一次执行时间或清空历史。

Popup 还提供可展开的后台任务概览：

- 查看所有任务是否启用、是否正在执行、执行间隔、下次执行时间和排程健康
- 摘要会优先提示执行中、排程异常或失败任务数量
- 摘要和展开顶部会优先提示执行中、排程异常、失败或最近跳过任务数量；折叠态会点名前几个需处理任务和状态，避免用户只看到计数却不知道哪项任务阻塞
- 展开后台任务概览时会立即刷新状态；面板保持打开时会定时刷新，避免相对倒计时和排程异常判断变陈旧
- 展开顶部会显示上次确认快照时间和本机时区，方便判断 `nextRun` 和本地时间是否可信；刷新请求进行中时不会提前把旧列表标成新状态
- 刷新请求进行中会显示 `正在核对` 回执，说明下方仍是上次确认快照；本次只读取任务状态并校准 Chrome alarm，未立即执行、启用、停用、修复任务或清空历史
- 展开顶部会显示“刷新回执”，说明本次刷新核对了多少任务、是否自动补齐/重排/清理 Chrome alarm；如果本次确实校准了某些 alarm，会点名前几个具体任务和动作，避免只给计数却让用户扫列表猜哪一行变了；刷新不会立即执行任务、切换开关或清空历史
- 如果刷新失败但已有旧任务列表，顶部会显示 `刷新未确认` 回执并移除上一条成功刷新回执；错误条会显示“下方仍是上次快照”，并说明当前 Chrome alarm / 执行状态未确认；旧列表保留只是为了继续查看任务名称、历史错误和手动入口
- 展开后会显示一条“下一步处理”提示，按执行中、排程异常、失败、跳过的顺序挑出最需要处理的任务，并给出重排、等待、重试或检查配置的简短建议
- 顶部“下一步处理”提示的 hover / 读屏文案会说明它只是建议，不会自动执行、暂停、重排、重试、改变排程或清空运行历史；真正动作仍需点击任务行按钮并等待后台确认
- 如果同时有多个任务需要处理，会在面板顶部显示“需处理总览”，列出前几个任务的状态、阻塞原因和下一步动作，避免用户只看到最高优先级任务而漏掉其他阻塞
- 展开后不再显示“全部 / 需处理 / 执行中”等筛选标签；列表始终展示所有任务，减少 popup 里的二次筛选负担
- 展开后会把执行中、排程异常、失败和最近跳过的任务排在前面，且失败优先于跳过，减少排查时滚动查找
- 英文界面会把顶部“静默消息分析”快捷入口显示为 `Analyze msg in background`，任务汇总里的启用计数显示为 `enabled`
- 下次执行时间同时显示相对倒计时和本地时间，并给任务打上消息、同步、维护、画像等轻量类别标签
- 查看最近一次执行成功/失败结果，失败时显示简短错误
- 只要有运行记录，就显示最近最多 5 次运行的成功/失败概览，悬停可看到每次运行的触发来源和耗时
- 最近一次运行会直接显示触发来源、结果、耗时以及失败/跳过原因，避免排障时只能依赖悬停提示
- 如果最近多次完成记录连续失败，会直接显示连续失败次数；连续失败达到 3 次时，会在任务行提供“暂停”按钮，方便先暂停排程并检查配置或服务状态
- 查看最近 5 次运行里的跳过记录，用于判断是否存在长任务挤压后续排程
- 刷新任务状态
- `digest_queue_process` 队列明细读取失败时，刷新回执会显示 `队列明细未确认`，任务行显示 `队列状态未确认`、失败原因和“本次刷新没有立即发送摘要、不写入 Memory Service、不确认通知”的恢复边界
- 排程异常任务会显示重排按钮，可一键重新创建该任务的 Chrome alarm
- 重排请求进行中会在任务行显示 `重排确认中`，说明下方仍是上次确认快照；只有后台确认并刷新状态后才显示 `排程已重排`
- 排程异常会区分显示“未排程 / 需重排 / 逾期 / 修复失败”，并给出下一步动作提示，减少用户判断成本
- 如果自动修复排程失败，任务行会保留在列表里并显示“修复失败”，避免用户失去停用或重试入口
- 单独启用/停用任务时，任务行先显示 `启用确认中` / `停用确认中`，并保留上次确认的排程状态、`nextRun` 和历史；只有后台 `CONTROL_TASK` 成功且刷新后的状态返回后，才显示已启用/已停用
- 启用、停用、立即执行或重排后，popup 顶部会保留一条“操作回执”，明确这次点击是恢复/暂停排程、一次性执行，还是只重建 Chrome alarm；它会说明是否保持自动排程、是否仍可手动执行、以及不会清除运行历史或隐藏失败
- 启用、停用或重排请求如果被 background 拒绝或桥接失败，也会保留一条失败“操作回执”，直接说明目标任务、失败原因和非效果边界：没有确认排程变更、没有立即执行任务、没有清除排程异常或运行历史；下方任务行仍以后台刷新后的旧快照为准
- 每个任务行会在按钮前显示“操作范围”：重排只重建或校准 Chrome alarm，立即执行只跑一次，暂停只停止自动排程并保留历史，停用任务的手动执行不会隐式重新启用
- 任务行按钮自身的悬停提示和可访问标签也会带上同样边界：开关只改变后续自动排程，重排只修 Chrome alarm，立即执行只跑一次，暂停保留历史并保留手动入口
- 立即执行失败或跳过也会走同一条“操作回执”：失败回执显示真实错误和运行摘要，跳过回执显示前置条件或已有执行中的原因；二者都不会被通用错误条吞掉
- 已停用任务会显示“停用 · 可手动执行”，手动执行只运行一次，不会隐式启用排程
- 手动执行某个任务时，任务行先显示 `执行确认中` 并保留上次确认的运行快照；本次执行完成并刷新后才更新 `lastRun` / `runHistory` / 成功或失败结果，避免把发出请求误读成已经跑完
- 如果用户在任务已运行时再次点击手动执行，popup 会刷新跳过记录，但不会把“已有执行中任务”当成新的全局错误
- 每个任务行会显示一条状态回执，和顶部“下一步处理”以及“需处理总览”共用同一套 `statusReceipt`，避免同一个失败/跳过/排程异常在不同位置给出不同建议

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

## 参考判断

- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) 说明 `persistAcrossSessions` 支持和早期/跨浏览器差异，所以本功能仍要在 Service Worker 启动和状态刷新时核对 alarm 实况，并把“重排只修复 alarm”说清楚。
- [Temporal Web UI](https://docs.temporal.io/web-ui) 和 [Event History](https://docs.temporal.io/workflow-execution/event) 把当前状态、历史事件和调试入口放在一起；Task Scheduler 对应保留最近运行历史和行内下一步，而不是只给一个开关。
- [GitHub Actions workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs) 把 `queued` / `in_progress` / `completed` / `skipped` / `failure` 等状态和筛选口径拆开；Task Scheduler 对应区分执行状态、排程健康、跳过、失败和刷新校准结果。
- [Apache Airflow UI](https://airflow.apache.org/docs/apache-airflow/stable/ui.html) 用 Grid View 展示最近运行和任务状态，并支持从失败/重试状态进入排障；Task Scheduler 的 popup 也应优先展示需处理任务、失败原因和操作影响。
- [Quartz trigger misfire](https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/tutorial-lesson-04.html) 把 missed fire 作为调度器状态建模；本功能对应把 Chrome alarm 逾期显示成 `overdue`，并要求重排确认后再更新可见状态。
- [Datadog Monitor Status Page](https://docs.datadoghq.com/monitors/status/status_page/) 把告警原因、上下文和 quick actions 放在同一调查页面；Task Scheduler 的 popup 面板也应把下一步和按钮副作用放在同一任务行。
- [Microsoft Power Automate run resubmission](https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit) 与 [Zapier Zap history](https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history) 都区分 run history、重跑/取消和已完成副作用；本功能对应地把“手动执行、停用、重排、历史保留”拆开展示。
- [The impact of progress indicators on task completion](https://academic.oup.com/iwc/article-abstract/22/5/417/688424) 提醒进度反馈如果让用户误判进展会伤害体验；本功能的刷新回执只展示已经确认的校准，并保留“刷新不等于执行/启停/清空历史”的边界。
- 自动化透明度研究（如 [Human Performance Benefits of the Automation Transparency Design Principle](https://journals.sagepub.com/doi/abs/10.1177/0018720819887252)）强调用户界面应让自动化的职责、活动和影响可见；这里采用短句操作范围，避免把 popup 变成排障文档。

## 验证建议

1. 运行开发构建：`npm start`，等待首次 compile 成功后停止 watch
2. 打开 popup，展开后台任务概览，确认能看到 8 个任务
3. 切换 `message_analysis`，确认顶部开关状态、任务列表状态与刷新后的任务列表一致
4. 启用一个已停用任务，确认只创建 alarm，不会更新 `lastRun`
5. 手动执行 `digest_queue_process` 或轻量 no-op 任务，确认执行中状态短暂出现，`lastRun` / `lastCompletedAt` / `lastSuccess` / `runHistory` 更新并持久化
6. 清空用户全名后手动执行 `message_analysis`，确认不会打开 RingCentral 标签页，并在任务历史里显示跳过原因；停用 `memory_sync` 后手动执行，确认只运行一次同步且排程仍停用
7. 在 Service Worker 控制台检查 `chrome.alarms.getAll()`，确认 `scheduled_task_*` 数量与启用任务一致
8. 对一个 `overdue` 任务点击重排，确认后台响应前任务行显示 `重排确认中` 且仍保留原异常快照；后台确认后 `nextRun` 回到未来时间，且不会更新 `lastRun`
9. 运行 `npm run verify:task-scheduler-api`，覆盖首次启动不安排隐藏执行、启用不立即执行、storage 缺 row/清空时回退任务默认值、alarm 显式跨会话持久化、alarm 创建失败回滚、手动执行、失败记录、跳过记录、最近运行历史、重复执行跳过、停用任务手动执行、状态刷新补齐丢失 alarm、自动修复失败时仍返回任务列表、状态刷新回执、具体 alarm 校准任务明细、队列明细读取失败回执、重排失败时保留旧 alarm、识别并修复明显滞后的 alarm，以及清理旧版本遗留的未知 `scheduled_task_*` alarm
10. 运行 `npm run verify:task-scheduler-status-filters`，覆盖后台任务状态计数、状态优先级和状态分类判定
11. 运行 `npm run verify:task-scheduler-popup-filters:e2e`，用 fresh Chromium 扩展实例验证 popup 折叠态需处理任务预览、展开后不显示筛选标签、需处理总览、任务列表优先级、上次确认时间、刷新中 `正在核对` 回执、刷新范围回执、具体 alarm 校准任务明细、刷新失败 `刷新未确认` 回执和旧快照边界、队列明细未确认回执、停用/立即执行/重排确认中都不提前改成成功状态、启停/重排失败操作回执、行内操作范围、最近一次运行解释、失败详情呈现、确认后的操作回执、英文静默分析文案和右上角帮助 / Desktop App 图标顺序
