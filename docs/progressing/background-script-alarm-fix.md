# Background Script Alarm 修复说明

## 问题描述

在 Manifest V3 中，background script 使用 Service Worker 模式运行。Service Worker 会在不活动时被终止（通常30秒后），当 `chrome.alarms` 触发时虽然能唤醒 Service Worker，但由于监听器设置延迟，导致 alarm 事件丢失。

### 症状

- Background script 处于 inactive 状态
- `chrome.alarms.getAll()` 能获取到 alarm 数据
- 定时任务不执行，即使等待到预计执行时间

### 根本原因

```typescript
// 原来的代码结构（有问题）
(async () => {
    setTimeout(async () => {
        await initializeTaskScheduler(); // 5秒后才初始化
    }, 5000);
})();

async function initializeTaskScheduler() {
    // ...
    setupAlarmListeners(); // 监听器在这里设置
}

function setupAlarmListeners() {
    chrome.alarms.onAlarm.addListener(/* ... */); // 延迟设置！
}
```

**问题所在**：
1. Service Worker 被 alarm 唤醒时会重新执行顶层代码
2. 但 `chrome.alarms.onAlarm.addListener` 在 5 秒延迟后才设置
3. 如果 alarm 在 5 秒内触发，监听器还没设置好，事件就丢失了

## 解决方案

### 核心修改

将 alarm 监听器的设置移到顶层代码中，确保 Service Worker 启动时**立即同步**设置监听器：

```typescript
// 新的代码结构（已修复）
// ✅ 在顶层立即设置监听器
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('🔔 收到 alarm 事件:', alarm.name);
    
    try {
        // 处理 TaskScheduler 的任务
        if (alarm.name.startsWith('scheduled_task_')) {
            if (!taskScheduler.isInitialized) {
                await initializeTaskScheduler();
            }
            await taskScheduler.handleAlarmEvent(alarm);
            return;
        }
        
        // 处理其他 alarm
        if (alarm.name === 'memory-system-sync') {
            await memorySystem.syncCache();
            return;
        }
        
        if (alarm.name === 'user-profile-decay') {
            await memorySystem.applyUserProfileDecay();
            return;
        }
    } catch (error) {
        console.error('❌ 处理 alarm 事件失败:', error);
    }
});

// 然后才是延迟初始化
(async () => {
    setTimeout(async () => {
        await initializeTaskScheduler();
    }, 5000);
})();
```

### 修改的文件

1. **src/background.ts**
   - 在顶层立即设置 `chrome.alarms.onAlarm.addListener`
   - 统一处理所有 alarm 事件（TaskScheduler、memory 等）
   - 添加详细的日志输出

2. **src/services/TaskScheduler.ts**
   - 将 `isInitialized` 改为 `public`，方便检查初始化状态
   - 移除 `setupAlarmListeners()` 中的监听器设置
   - 新增 `handleAlarmEvent()` 公共方法，由 background.ts 调用

3. **src/memory.ts**
   - 移除 `setupAlarmListener()` 中的监听器设置
   - 保留方法用于兼容性，但不再设置监听器

## 验证步骤

### 1. 重新加载扩展

```bash
cd /Users/Esone/git/personal-ai
npm run build
```

然后在 Chrome 扩展管理页面重新加载扩展。

### 2. 检查监听器是否正确设置

打开 Background Service Worker 的 DevTools，应该看到：

```
Background script loaded
✅ Alarm 监听器已设置（顶层同步）
```

### 3. 检查定时任务状态

在 DevTools Console 中执行：

```javascript
// 检查所有 alarm
chrome.alarms.getAll().then(alarms => {
    console.table(alarms.map(a => ({
        name: a.name,
        nextFire: new Date(a.scheduledTime).toLocaleString(),
        periodMinutes: a.periodInMinutes
    })));
});

// 检查 TaskScheduler 是否初始化
taskScheduler.isInitialized

// 查看任务状态
chrome.runtime.sendMessage({
    type: 'GET_TASK_SCHEDULER_STATUS'
}, response => {
    console.table(response.tasks);
});
```

### 4. 测试 alarm 触发

你可以手动创建一个短周期的测试 alarm：

```javascript
// 创建一个 1 分钟后触发的测试 alarm
chrome.alarms.create('test-alarm', {
    delayInMinutes: 1
});

// 1分钟后应该在控制台看到：
// 🔔 收到 alarm 事件: test-alarm
```

### 5. 观察 Service Worker 生命周期

1. 关闭 Background DevTools，让 Service Worker 自然终止
2. 等待 alarm 触发时间到来
3. 打开 Background DevTools，检查日志

应该看到类似的输出：

```
Background script loaded
✅ Alarm 监听器已设置（顶层同步）
🔔 收到 alarm 事件: scheduled_task_message_analysis
⚡ 执行定时任务: message_analysis
✅ 任务 静默消息分析 执行完成，耗时: 1234ms
```

## 技术细节

### Manifest V3 Service Worker 生命周期

- Service Worker 在不活动 30 秒后被终止
- `chrome.alarms` 可以唤醒 Service Worker
- 事件监听器必须在顶层同步注册，不能延迟

### Chrome 官方建议

根据 [Chrome Extension Service Worker 文档](https://developer.chrome.com/docs/extensions/mv3/service_workers/):

> Event listeners must be registered synchronously from the start of the page. Do not register event listeners asynchronously, as they will not be properly triggered.

我们的修复完全遵循这个建议。

## 相关问题排查

如果定时任务仍然不执行，请检查：

1. **电脑是否休眠**：确认电脑不会休眠（已由用户确认）

2. **Alarm 是否创建**：
   ```javascript
   chrome.alarms.getAll().then(console.log);
   ```

3. **TaskScheduler 是否初始化**：
   ```javascript
   taskScheduler.isInitialized; // 应该返回 true
   ```

4. **任务是否启用**：
   ```javascript
   chrome.runtime.sendMessage({
       type: 'GET_TASK_SCHEDULER_STATUS'
   }, response => {
       console.log(response.tasks.filter(t => t.enabled));
   });
   ```

5. **监听器是否正确设置**：
   刷新扩展后，立即查看 Background DevTools，应该看到 "✅ Alarm 监听器已设置（顶层同步）"

## 参考资料

- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/alarms/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

**修复日期**: 2025-11-06  
**修复人**: AI Assistant  
**版本**: 7.4.0

