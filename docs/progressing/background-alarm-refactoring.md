# Background Script Alarm 处理重构

## 重构目标

将 `background.ts` 中 `chrome.alarms.onAlarm` 监听器的具体实现逻辑移到各自的模块中，使 `background.ts` 更加简洁和易维护。

## 重构前的问题

原来 `background.ts` 中的 alarm 监听器包含了大量的业务逻辑：

```typescript
// ❌ 重构前：background.ts 包含所有实现细节
chrome.alarms.onAlarm.addListener(async (alarm) => {
    // 处理 TaskScheduler 的任务
    if (alarm.name.startsWith('scheduled_task_')) {
        if (!taskScheduler.isInitialized) {
            await initializeTaskScheduler();
        }
        const taskId = alarm.name.replace('scheduled_task_', '');
        await taskScheduler.handleAlarmEvent(alarm);
        return;
    }
    
    // 处理 memory.ts 的 alarm
    if (alarm.name === 'memory-system-sync') {
        await memorySystem.syncCache();
        return;
    }
    
    if (alarm.name === 'user-profile-decay') {
        await memorySystem.applyUserProfileDecay();
        return;
    }
    
    // ... 更多逻辑
});
```

**缺点**：
- `background.ts` 职责过重，包含太多业务逻辑
- 每个模块的 alarm 处理分散在 background.ts 中
- 修改某个模块的 alarm 处理需要修改 background.ts
- 不符合单一职责原则

## 重构方案：责任链模式

采用**责任链模式**，让每个模块自己决定是否处理 alarm 事件。

### 架构设计

```
┌─────────────────────────────────────────┐
│     background.ts (顶层监听器)          │
│  chrome.alarms.onAlarm.addListener()    │
└────────────┬────────────────────────────┘
             │
             │ 责任链
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐      ┌──────────┐
│TaskScheduler    │MemorySystem│
│.tryHandleAlarm()│.tryHandleAlarm()│
│                 │          │
│返回 true/false  │返回 true/false│
└─────────┘      └──────────┘
```

### 实现细节

#### 1. TaskScheduler.ts

添加静态方法 `tryHandleAlarm`：

```typescript
/**
 * 静态方法：尝试处理 alarm 事件
 * 返回 true 表示已处理，false 表示不是 TaskScheduler 的 alarm
 */
public static async tryHandleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
    if (!alarm.name.startsWith('scheduled_task_')) {
        return false; // 不是我的 alarm，返回 false
    }

    const instance = TaskScheduler.getInstance();
    
    // 确保已初始化
    if (!instance.isInitialized) {
        console.log('⚠️ TaskScheduler 未初始化，开始初始化...');
        await instance.startAllTasks();
    }
    
    const taskId = alarm.name.replace('scheduled_task_', '');
    console.log(`⚡ 执行定时任务: ${taskId}`);
    await instance.handleAlarmEvent(alarm);
    
    return true; // 已处理，返回 true
}
```

#### 2. MemorySystem (memory.ts)

添加实例方法 `tryHandleAlarm`：

```typescript
/**
 * 尝试处理 alarm 事件
 * 返回 true 表示已处理，false 表示不是 MemorySystem 的 alarm
 * 
 * 由 background.ts 的顶层 alarm 监听器调用
 */
public async tryHandleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
    switch (alarm.name) {
        case 'memory-system-sync':
            console.log('🔄 执行记忆系统定时同步...');
            try {
                await this.syncCache();
            } catch (error) {
                console.error('❌ 记忆系统同步失败:', error);
            }
            return true;
            
        case 'user-profile-decay':
            console.log('🧠 执行用户画像定时权重衰变...');
            try {
                await this.applyUserProfileDecay();
            } catch (error) {
                console.error('❌ 用户画像权重衰变失败:', error);
            }
            return true;
            
        default:
            return false; // 不是我的 alarm
    }
}
```

**注意**：`MemorySystem` 使用实例方法而非静态方法，因为它直接导出实例而非使用单例模式。

#### 3. background.ts（简化后）

```typescript
// ✅ 重构后：简洁的责任链模式
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('🔔 收到 alarm 事件:', alarm.name);
    
    try {
        // 尝试让各个模块处理自己的 alarm
        // 使用责任链模式，每个模块返回 true 表示已处理
        
        if (await TaskScheduler.tryHandleAlarm(alarm)) {
            return;
        }
        
        if (await memorySystem.tryHandleAlarm(alarm)) {
            return;
        }
        
        // 处理其他未知 alarm
        console.log(`⚡ 未处理的 alarm 事件: ${alarm.name}`);
    } catch (error) {
        console.error('❌ 处理 alarm 事件失败:', error);
    }
});
```

## 重构优势

### 1. 职责清晰 ✨

- `background.ts` 只负责分发 alarm 事件
- 每个模块负责自己的 alarm 处理逻辑
- 符合单一职责原则

### 2. 易于扩展 🚀

添加新的 alarm 处理器只需要：

```typescript
// 在新模块中
class NewFeature {
    public static async tryHandleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
        if (alarm.name === 'my-new-alarm') {
            // 处理逻辑
            return true;
        }
        return false;
    }
}

// 在 background.ts 中添加一行
if (await NewFeature.tryHandleAlarm(alarm)) {
    return;
}
```

### 3. 易于维护 🔧

- 修改某个模块的 alarm 处理不需要修改 background.ts
- 每个模块的逻辑内聚在一起
- 降低了模块间的耦合

### 4. 易于测试 🧪

每个模块的 `tryHandleAlarm` 方法可以独立测试：

```typescript
// 测试 TaskScheduler
const alarm = { name: 'scheduled_task_test' };
const handled = await TaskScheduler.tryHandleAlarm(alarm);
expect(handled).toBe(true);

// 测试 MemorySystem
const memAlarm = { name: 'memory-system-sync' };
const handled = await memorySystem.tryHandleAlarm(memAlarm);
expect(handled).toBe(true);
```

## 设计模式说明

### 责任链模式（Chain of Responsibility）

**定义**：使多个对象都有机会处理请求，从而避免请求的发送者和接收者之间的耦合关系。将这些对象连成一条链，并沿着这条链传递该请求，直到有一个对象处理它为止。

**在本项目中的应用**：

1. **请求**：`chrome.alarms.Alarm` 事件
2. **处理器链**：
   - TaskScheduler.tryHandleAlarm()
   - memorySystem.tryHandleAlarm()
   - 其他模块...

3. **处理流程**：
   ```
   alarm 事件 → TaskScheduler → 能处理？→ 是 → 结束
                      ↓
                      否
                      ↓
                 MemorySystem → 能处理？→ 是 → 结束
                      ↓
                      否
                      ↓
                   记录未处理
   ```

4. **优点**：
   - 降低耦合度
   - 增强给对象指派职责的灵活性
   - 增加新的请求处理类很方便

## 与原有修复的兼容性

这次重构**完全兼容**之前的 Manifest V3 Service Worker 修复：

- ✅ 监听器仍然在顶层同步设置
- ✅ 不会延迟监听器的注册
- ✅ Service Worker 唤醒时能立即响应 alarm
- ✅ 只是将处理逻辑分发到各个模块

## 文件修改清单

### 修改的文件

1. **src/background.ts**
   - 简化 `chrome.alarms.onAlarm` 监听器
   - 移除具体业务逻辑
   - 使用责任链模式分发

2. **src/services/TaskScheduler.ts**
   - 新增 `tryHandleAlarm()` 静态方法
   - 封装 TaskScheduler 的 alarm 处理逻辑

3. **src/memory.ts**
   - 新增 `tryHandleAlarm()` 实例方法
   - 封装 MemorySystem 的 alarm 处理逻辑

### 代码变化统计

- **background.ts**: 简化约 20 行代码
- **TaskScheduler.ts**: 新增约 20 行代码
- **memory.ts**: 新增约 25 行代码
- **总体**: 代码总量增加约 25 行，但职责更清晰，可维护性大幅提升

## 后续扩展建议

### 1. 标准化接口

可以定义一个标准接口：

```typescript
interface AlarmHandler {
    tryHandleAlarm(alarm: chrome.alarms.Alarm): Promise<boolean>;
}
```

### 2. 自动注册

可以实现一个注册机制：

```typescript
class AlarmDispatcher {
    private handlers: AlarmHandler[] = [];
    
    register(handler: AlarmHandler) {
        this.handlers.push(handler);
    }
    
    async dispatch(alarm: chrome.alarms.Alarm) {
        for (const handler of this.handlers) {
            if (await handler.tryHandleAlarm(alarm)) {
                return;
            }
        }
        console.log(`⚡ 未处理的 alarm 事件: ${alarm.name}`);
    }
}
```

### 3. 优先级处理

如果需要按优先级处理 alarm：

```typescript
interface PrioritizedAlarmHandler extends AlarmHandler {
    priority: number; // 数字越小优先级越高
}
```

## 总结

这次重构通过引入**责任链模式**，成功地将 `background.ts` 中的业务逻辑下放到各个功能模块中：

- ✅ **职责清晰**：background.ts 只负责分发，模块负责处理
- ✅ **易于扩展**：添加新功能只需实现 tryHandleAlarm 方法
- ✅ **易于维护**：修改某个模块不影响其他部分
- ✅ **易于测试**：每个处理器可以独立测试
- ✅ **完全兼容**：与之前的 Manifest V3 修复完全兼容

---

**重构日期**: 2025-11-06  
**重构人**: AI Assistant  
**版本**: 7.4.0

