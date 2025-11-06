# 定时任务统一管理重构

## 🎯 重构目标

将分散在各个模块中的独立 alarm 创建逻辑统一到 `TaskScheduler`，避免重复执行、便于统一管理。

## 🔍 发现的问题

### 严重的任务重复问题

在重构前，发现 **同一个任务被执行了两次**！

**MemorySystem 创建的独立 alarm：**
```typescript
// memory.ts initializeBackgroundSync()
'memory-system-sync'      // 每5分钟执行 syncCache()
'user-profile-decay'      // 每24小时执行 applyUserProfileDecay()
```

**TaskScheduler 中的任务：**
```typescript
// TaskScheduler.ts TASK_DEFINITIONS
'scheduled_task_memory_sync'       // 每5分钟执行 memorySystem.syncCache()
'scheduled_task_user_profile_decay' // 每24小时执行 memorySystem.applyUserProfileDecay()
```

**结果**：
- `syncCache()` 每5分钟被执行 **2次**
- `applyUserProfileDecay()` 每24小时被执行 **2次**

### 架构问题

```
┌─────────────────────────────────────┐
│   ❌ 重构前：多个 alarm 来源        │
└─────────────────────────────────────┘

chrome.alarms:
  ├─ memory-system-sync (MemorySystem创建)
  ├─ user-profile-decay (MemorySystem创建)
  ├─ scheduled_task_memory_sync (TaskScheduler创建)
  ├─ scheduled_task_user_profile_decay (TaskScheduler创建)
  └─ scheduled_task_* (其他TaskScheduler任务)
       ↑                    ↑
       └──── 重复执行！ ────┘
```

## ✅ 重构方案

### 统一架构

```
┌─────────────────────────────────────┐
│   ✅ 重构后：统一管理               │
└─────────────────────────────────────┘

TaskScheduler (唯一的 alarm 管理者)
  ├─ scheduled_task_message_analysis
  ├─ scheduled_task_memory_sync ──────> memorySystem.syncCache()
  ├─ scheduled_task_system_monitoring
  ├─ scheduled_task_user_profile_decay ──> memorySystem.applyUserProfileDecay()
  ├─ scheduled_task_vectorized_data_maintenance
  ├─ scheduled_task_user_summary_generation
  └─ scheduled_task_vector_quality_check

✅ 每个任务只执行一次
✅ 统一的配置和状态管理
✅ 统一的监控和调试
```

### 实现细节

#### 1. 移除 MemorySystem 的独立 alarm 创建

**修改前：**
```typescript
// memory.ts initializeBackgroundSync()
chrome.alarms.create('memory-system-sync', {
  periodInMinutes: 5
});

chrome.alarms.create('user-profile-decay', {
  periodInMinutes: 24 * 60
});

this.setupAlarmListener(); // 设置独立的监听器
```

**修改后：**
```typescript
// memory.ts initializeBackgroundSync()
// ✅ 定时任务已统一由 TaskScheduler 管理
// 不再在这里创建独立的 alarm，避免重复执行
// 
// TaskScheduler 中已包含以下任务：
// - 'memory_sync' -> 调用 memorySystem.syncCache()
// - 'user_profile_decay' -> 调用 memorySystem.applyUserProfileDecay()

this.backgroundSyncStarted = true;
console.log('✅ 记忆系统定时任务由 TaskScheduler 统一管理');
```

#### 2. 移除 MemorySystem 的独立 alarm 处理器

**修改前：**
```typescript
// memory.ts
public async tryHandleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
  switch (alarm.name) {
    case 'memory-system-sync':
      await this.syncCache();
      return true;
    case 'user-profile-decay':
      await this.applyUserProfileDecay();
      return true;
    default:
      return false;
  }
}
```

**修改后：**
```typescript
// memory.ts
/**
 * ⚠️ 已废弃：此方法保留仅用于向后兼容
 * 
 * 所有定时任务现在由 TaskScheduler 统一管理：
 * - 'memory_sync' -> memorySystem.syncCache()
 * - 'user_profile_decay' -> memorySystem.applyUserProfileDecay()
 */
private setupAlarmListener(): void {
  // 仅标记，不再创建 alarm
  this.alarmListenerAdded = true;
  console.log('✅ 记忆系统定时任务已交由 TaskScheduler 统一管理');
}
```

#### 3. 简化 background.ts 的 alarm 监听器

**修改前：**
```typescript
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (await TaskScheduler.tryHandleAlarm(alarm)) {
        return;
    }
    
    if (await memorySystem.tryHandleAlarm(alarm)) {
        return;
    }
    
    console.log(`⚡ 未处理的 alarm 事件: ${alarm.name}`);
});
```

**修改后：**
```typescript
chrome.alarms.onAlarm.addListener(async (alarm) => {
    // 所有定时任务统一由 TaskScheduler 管理
    if (await TaskScheduler.tryHandleAlarm(alarm)) {
        return;
    }
    
    // 如果有其他模块需要处理 alarm，在这里添加
    
    console.log(`⚡ 未处理的 alarm 事件: ${alarm.name}`);
});
```

## 📊 重构效果对比

### 问题消除

| 问题 | 重构前 | 重构后 |
|------|--------|--------|
| **任务重复执行** | ❌ 每个任务执行2次 | ✅ 每个任务执行1次 |
| **Alarm 数量** | ❌ 10+ alarms | ✅ 7 alarms |
| **配置分散** | ❌ 多处配置 | ✅ 统一配置（TaskScheduler） |
| **状态管理** | ❌ 各自管理 | ✅ 统一状态查询 |
| **监控调试** | ❌ 难以追踪 | ✅ 统一的日志和监控 |

### 管理优势

#### ✅ 统一的任务配置

所有任务配置在一个地方：

```typescript
// TaskScheduler.ts
const TASK_DEFINITIONS: ScheduledTask[] = [
  {
    id: 'memory_sync',
    name: '记忆系统同步',
    category: 'data_sync',
    intervalMinutes: 5,
    description: '同步本地和云端记忆数据',
    enabled: true
  },
  {
    id: 'user_profile_decay',
    name: '用户画像权重衰变',
    category: 'user_profile',
    intervalMinutes: 1440, // 24小时
    description: '执行用户画像权重的自然衰变',
    enabled: true
  },
  // ... 其他任务
];
```

#### ✅ 统一的任务控制

```typescript
// 启用/禁用任务
await taskScheduler.toggleTask('memory_sync', true/false);

// 手动执行任务
await taskScheduler.runTaskManually('memory_sync');

// 查询任务状态
const status = taskScheduler.getTaskStatus();
console.table(status);
```

#### ✅ 统一的任务监控

```typescript
// 在 DevTools Console 中
chrome.runtime.sendMessage({
    type: 'GET_TASK_SCHEDULER_STATUS'
}, response => {
    console.table(response.tasks);
});

// 输出：
// ┌─────────────┬────────┬─────────┬──────────────┐
// │ id          │ status │ enabled │ intervalMin  │
// ├─────────────┼────────┼─────────┼──────────────┤
// │ memory_sync │ running│ true    │ 5            │
// │ user_...    │ running│ true    │ 1440         │
// └─────────────┴────────┴─────────┴──────────────┘
```

## 🔧 扩展指南

### 添加新的定时任务

现在只需要在 TaskScheduler 中添加：

```typescript
// 1. 在 TASK_DEFINITIONS 添加定义
{
  id: 'my_new_task',
  name: '我的新任务',
  category: 'data_sync',
  intervalMinutes: 30,
  description: '任务描述',
  enabled: true
}

// 2. 在 executeTask() 添加执行逻辑
case 'my_new_task':
  await this.executeMyNewTask();
  break;

// 3. 实现执行方法
private async executeMyNewTask(): Promise<void> {
  try {
    // 你的任务逻辑
    console.log('✅ 我的新任务执行完成');
  } catch (error) {
    console.error('❌ 我的新任务失败:', error);
  }
}
```

**就这么简单！** 不需要：
- ❌ 创建独立的 alarm
- ❌ 设置独立的监听器
- ❌ 实现 tryHandleAlarm 方法
- ❌ 修改 background.ts

### 任务间隔配置

| 任务类型 | 推荐间隔 | 说明 |
|---------|---------|------|
| **数据同步** | 5-15分钟 | 频繁但轻量 |
| **健康检查** | 30-60分钟 | 定期监控 |
| **数据维护** | 6-12小时 | 重量级操作 |
| **权重衰变** | 24小时 | 每日一次 |
| **概要生成** | 7天 | 周期性归档 |

## 🎓 设计原则

### 单一职责原则（SRP）

- **TaskScheduler**: 负责所有定时任务的管理
- **MemorySystem**: 负责记忆系统的业务逻辑
- **各个模块**: 专注于自己的核心功能

### 开闭原则（OCP）

- 对扩展开放：轻松添加新任务
- 对修改封闭：不需要修改 background.ts

### 依赖倒置原则（DIP）

```typescript
// TaskScheduler 依赖于接口，而非具体实现
await memorySystem.syncCache();           // MemorySystem 的接口
await cloudStorage.performMaintenance();  // CloudStorage 的接口
```

## 📈 性能优化

### 减少 Alarm 数量

**重构前**: 10+ alarms
```
memory-system-sync
user-profile-decay
scheduled_task_message_analysis
scheduled_task_memory_sync (重复！)
scheduled_task_user_profile_decay (重复！)
scheduled_task_system_monitoring
scheduled_task_vectorized_data_maintenance
scheduled_task_user_summary_generation
scheduled_task_vector_quality_check
+ 其他模块可能的 alarms...
```

**重构后**: 7 alarms
```
scheduled_task_message_analysis
scheduled_task_memory_sync
scheduled_task_system_monitoring
scheduled_task_user_profile_decay
scheduled_task_vectorized_data_maintenance
scheduled_task_user_summary_generation
scheduled_task_vector_quality_check
```

### 避免重复执行

- **节省 CPU**: 每个任务只执行1次，减少50%的执行次数
- **节省电量**: 减少不必要的唤醒
- **减少冲突**: 避免同一任务并发执行导致的数据竞争

## 🧪 测试验证

### 验证步骤

1. **检查 alarm 数量**
   ```javascript
   chrome.alarms.getAll().then(alarms => {
       console.log('总 alarm 数量:', alarms.length);
       console.table(alarms.map(a => ({
           name: a.name,
           periodMinutes: a.periodInMinutes
       })));
   });
   ```

2. **验证无重复**
   应该看到：
   - ✅ `scheduled_task_memory_sync`（存在）
   - ✅ `scheduled_task_user_profile_decay`（存在）
   - ❌ `memory-system-sync`（不存在）
   - ❌ `user-profile-decay`（不存在）

3. **验证任务执行**
   ```javascript
   // 观察日志，每个任务应该只执行1次
   // ✅ 正常：
   // 🔄 执行记忆系统定时同步...
   // ✅ 记忆系统同步任务执行完成
   
   // ❌ 异常（重构前）：
   // 🔄 执行记忆系统定时同步...
   // 🔄 执行记忆系统定时同步...  <- 重复！
   ```

## 📝 迁移注意事项

### 向后兼容

- ✅ 保留了 `initializeBackgroundSync()` 方法
- ✅ 保留了 `setupAlarmListener()` 方法
- ✅ 不会破坏现有代码的调用

### 清理旧 alarms

重新加载扩展后，旧的 alarms 会自动失效。如需手动清理：

```javascript
chrome.alarms.clear('memory-system-sync');
chrome.alarms.clear('user-profile-decay');
```

## 🎯 总结

### 关键改进

1. **消除重复** ✅
   - 同一任务不再执行2次
   - 减少了不必要的资源消耗

2. **统一管理** ✅
   - 所有定时任务在一处配置
   - 统一的启用/禁用控制
   - 统一的监控和调试

3. **架构清晰** ✅
   - TaskScheduler 负责调度
   - 各模块负责业务逻辑
   - background.ts 只负责分发

4. **易于扩展** ✅
   - 添加新任务只需修改 TaskScheduler
   - 不需要修改 background.ts
   - 不需要各模块自己管理 alarm

### 设计哲学

> "如果你有多个地方在做同一件事，那一定有问题。"

这次重构体现了：
- **DRY 原则**（Don't Repeat Yourself）
- **单一职责原则**
- **统一抽象层**

---

**重构日期**: 2025-11-06  
**重构人**: AI Assistant  
**版本**: 7.4.0  
**影响范围**: TaskScheduler, MemorySystem, background.ts

