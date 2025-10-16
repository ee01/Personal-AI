# 任务调度器 API 文档

## 概述

统一任务调度器提供了一套完整的消息 API，用于控制和监控所有定时任务。

## 消息 API

### 1. 获取任务调度器状态

**类型**: `GET_TASK_SCHEDULER_STATUS`

**用途**: 获取所有任务的当前状态

**请求格式**:
```javascript
chrome.runtime.sendMessage({
  type: 'GET_TASK_SCHEDULER_STATUS'
}, (response) => {
  console.log('任务状态:', response);
});
```

**响应格式**:
```javascript
{
  success: true,
  tasks: [
    {
      id: 'message_analysis',
      name: '静默消息分析',
      category: 'message_analysis',
      intervalMinutes: 30,
      description: '自动分析RingCentral消息，提取关键信息',
      enabled: true,
      status: 'running',
      lastRun: 1699999999999,
      nextRun: 1700001799999
    },
    // ... 其他任务
  ]
}
```

### 2. 控制特定任务

**类型**: `CONTROL_TASK`

**用途**: 启用/禁用任务或手动执行任务

#### 2.1 启用/禁用任务

**请求格式**:
```javascript
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',  // 任务ID
  action: 'toggle',             // 操作类型
  enabled: true                 // true=启用, false=禁用
}, (response) => {
  console.log('控制结果:', response);
});
```

**响应格式**:
```javascript
{
  success: true,
  message: '任务状态已更新'
}
```

#### 2.2 手动执行任务

**请求格式**:
```javascript
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',  // 任务ID
  action: 'run'                 // 操作类型
}, (response) => {
  console.log('执行结果:', response);
});
```

**响应格式**:
```javascript
{
  success: true,
  message: '任务执行成功'
}
```

## 辅助函数 API

为了简化任务状态的读取和监听,我们提供了两个便捷的辅助函数。

### getTaskEnabled

**用途**: 获取指定任务的启用状态

**函数签名**:
```typescript
async function getTaskEnabled(taskId: string): Promise<boolean>
```

**参数**:
- `taskId`: 任务ID (如 `'message_analysis'`)

**返回值**:
- `Promise<boolean>`: 任务是否启用

**示例**:
```typescript
import { getTaskEnabled } from './services/TaskScheduler';

// 检查消息分析任务是否启用
const isEnabled = await getTaskEnabled('message_analysis');
if (!isEnabled) {
  console.log('消息分析任务已禁用');
  return;
}

// 使用任务状态
if (isEnabled && isScheduledTask) {
  // 执行定时任务逻辑
}
```

**优势**:
- ✅ 简洁的一行调用
- ✅ 自动处理默认值(如果状态不存在,返回任务定义的默认值)
- ✅ 统一的错误处理
- ✅ TypeScript 类型安全

### onTaskEnabledChanged

**用途**: 监听指定任务的启用状态变化

**函数签名**:
```typescript
function onTaskEnabledChanged(
  taskId: string, 
  callback: (enabled: boolean) => void
): () => void
```

**参数**:
- `taskId`: 任务ID (如 `'message_analysis'`)
- `callback`: 状态变化时的回调函数,接收新的启用状态

**返回值**:
- `() => void`: 清理函数,调用后移除监听器

**示例**:
```typescript
import { onTaskEnabledChanged } from './services/TaskScheduler';

// 监听消息分析任务状态变化
const unsubscribe = onTaskEnabledChanged('message_analysis', (enabled) => {
  console.log('消息分析任务状态变化:', enabled);
  if (!enabled) {
    // 任务被禁用,停止当前操作
    agent.stop();
  }
});

// 在不需要时清理监听器(可选)
// unsubscribe();
```

**React 组件中使用**:
```typescript
import { onTaskEnabledChanged } from './services/TaskScheduler';

useEffect(() => {
  // 组件挂载时注册监听
  const unsubscribe = onTaskEnabledChanged('message_analysis', (enabled) => {
    setTaskEnabled(enabled);
  });
  
  // 组件卸载时清理监听
  return () => {
    unsubscribe();
  };
}, []);
```

**注意事项**:
- 返回的清理函数不会立即执行,只有调用时才会移除监听器
- 如果不需要清理(如在 background script 的一次性任务中),可以忽略返回值
- 在 React 组件中建议在 `useEffect` 的清理函数中调用

## 可用的任务 ID

| 任务ID | 任务名称 | 描述 |
|--------|----------|------|
| `message_analysis` | 静默消息分析 | 自动分析RingCentral消息 |
| `memory_sync` | 记忆系统同步 | 同步本地和云端记忆数据 |
| `system_monitoring` | 系统健康监控 | 执行系统健康检查和维护 |
| `user_profile_decay` | 用户画像权重衰变 | 执行用户画像权重衰变 |
| `vectorized_data_maintenance` | 向量化数据维护 | 清理过期向量记录 |
| `user_summary_generation` | 用户概要生成 | 生成用户行为概要记录 |
| `vector_quality_check` | 向量质量检查 | 检查向量数据质量 |

## 已废弃的 API

### CONTROL_SCHEDULED_CHECK (已废弃)

**废弃原因**: 功能已被 `CONTROL_TASK` 完全覆盖，使用统一接口更清晰

**迁移指南**:

**旧代码**:
```javascript
// 启动消息分析
chrome.runtime.sendMessage({
  type: 'CONTROL_SCHEDULED_CHECK',
  action: 'start'
});

// 停止消息分析
chrome.runtime.sendMessage({
  type: 'CONTROL_SCHEDULED_CHECK',
  action: 'stop'
});
```

**新代码**:
```javascript
// 启动消息分析
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',
  action: 'toggle',
  enabled: true
});

// 停止消息分析
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',
  action: 'toggle',
  enabled: false
});
```

## 使用示例

### 示例1: 在 Popup 中读取和控制消息分析

```typescript
import { getTaskEnabled } from './services/TaskScheduler';

// 读取任务状态
useEffect(() => {
  (async () => {
    const isEnabled = await getTaskEnabled('message_analysis');
    setIsScheduleActive(isEnabled);
  })();
}, []);

// 切换任务状态
const toggleSchedule = () => {
  const newState = !isScheduleActive;
  setIsScheduleActive(newState);
  chrome.runtime.sendMessage({
    type: 'CONTROL_TASK',
    taskId: 'message_analysis',
    action: 'toggle',
    enabled: newState
  });
};
```

### 示例2: 手动触发系统维护

```javascript
document.getElementById('maintenance-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'CONTROL_TASK',
    taskId: 'system_monitoring',
    action: 'run'
  }, (response) => {
    if (response.success) {
      alert('系统维护已完成');
    } else {
      alert('维护失败: ' + response.error);
    }
  });
});
```

### 示例3: 在后台任务中监听状态变化

```typescript
import { getTaskEnabled, onTaskEnabledChanged } from './services/TaskScheduler';

async function analyzeMessagesInBackground(data: any[], isScheduledTask: boolean) {
  // 检查任务是否启用
  const isEnabled = await getTaskEnabled('message_analysis');
  if (!isEnabled && isScheduledTask) {
    console.log('任务已禁用,跳过执行');
    return;
  }
  
  const agent = new IntelligentAgent();
  
  // 监听状态变化,如果任务被禁用则停止
  if (isScheduledTask) {
    onTaskEnabledChanged('message_analysis', (enabled) => {
      if (!enabled) {
        console.log('任务被禁用,停止分析');
        agent.stop();
      }
    });
  }
  
  // 执行分析
  await agent.analyze(data);
}
```

### 示例4: 获取并显示所有任务状态

```javascript
chrome.runtime.sendMessage({
  type: 'GET_TASK_SCHEDULER_STATUS'
}, (response) => {
  if (response.success) {
    response.tasks.forEach(task => {
      console.log(`${task.name}:`);
      console.log(`  状态: ${task.status}`);
      console.log(`  启用: ${task.enabled}`);
      console.log(`  间隔: ${task.intervalMinutes}分钟`);
      if (task.lastRun) {
        console.log(`  上次运行: ${new Date(task.lastRun).toLocaleString()}`);
      }
      if (task.nextRun) {
        console.log(`  下次运行: ${new Date(task.nextRun).toLocaleString()}`);
      }
    });
  }
});
```

## 错误处理

所有 API 调用都会返回标准的响应格式：

**成功响应**:
```javascript
{
  success: true,
  message: '操作成功描述',
  // ... 其他相关数据
}
```

**错误响应**:
```javascript
{
  success: false,
  error: '错误信息描述'
}
```

建议在所有 API 调用中添加错误处理：

```javascript
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',
  action: 'toggle',
  enabled: true
}, (response) => {
  if (!response) {
    console.error('API 调用失败: 无响应');
    return;
  }
  
  if (response.success) {
    console.log('操作成功:', response.message);
  } else {
    console.error('操作失败:', response.error);
  }
});
```

## 注意事项

1. **异步操作**: 所有任务控制操作都是异步的，需要使用回调函数获取结果
2. **权限要求**: 调用这些 API 需要在扩展的消息监听器中处理
3. **任务依赖**: 某些任务可能依赖其他服务（如 CloudStorage），如果依赖服务未初始化，任务会跳过执行
4. **执行时机**: 手动执行任务会立即运行，不会影响原有的定时调度
5. **状态持久化**: 任务的启用/禁用状态会在 Chrome Storage 中持久化保存，在扩展重新加载或浏览器重启后自动恢复

## 浏览器重启后的行为

### 问题背景

Chrome 扩展的 Service Worker 在浏览器重启后会被终止，所有内存中的状态都会丢失。虽然 Chrome Alarms API 会保留定时器，但任务调度器的内部状态需要特殊处理。

### 智能 Alarm 管理

#### Chrome Alarms API 的特性与限制

**重要发现**:
1. ⚠️ **Alarms 不保证持久化**: Chrome 官方文档明确指出,alarms 通常会保留到扩展更新,但**不保证在浏览器重启后一定保留**
2. ⚠️ **onStartup 时 API 未就绪**: 在 `chrome.runtime.onStartup` 事件中,Alarms API 可能尚未完全初始化,`chrome.alarms.getAll()` 可能返回空数组
3. ⚠️ **Service Worker 生命周期**: Service Worker 会在浏览器空闲时被终止,重新激活时需要重新设置监听器

**Chrome 官方推荐的最佳实践**:
```javascript
// ❌ 错误做法: 依赖 alarms 的持久化
const alarms = await chrome.alarms.getAll();
if (alarms.length === 0) {
  // 创建 alarms
}

// ✅ 正确做法: 基于 Storage 状态检查并创建
const { alarmEnabled } = await chrome.storage.get('alarmEnabled');
if (alarmEnabled) {
  const alarm = await chrome.alarms.get('my-alarm');
  if (!alarm) {
    await chrome.alarms.create('my-alarm', { periodInMinutes: 1 });
  }
}
```

#### 我们的实现策略

任务调度器采用 Chrome 官方推荐的方式:

**核心原则**: 
- ✅ **Storage 为准**: 以 Chrome Storage 中保存的任务状态为权威来源
- ✅ **逐个检查创建**: 使用 `chrome.alarms.get(name)` 检查单个 alarm 是否存在
- ✅ **幂等性保证**: 多次调用 `startAllTasks()` 不会重复创建定时器
- ✅ **配置同步**: 自动检测并更新配置变更

**好处**:
1. **可靠性**: 不依赖 alarms 的持久化,避免浏览器重启后定时器丢失
2. **兼容性**: 兼容 `onStartup` 事件中 Alarms API 未就绪的情况
3. **准确性**: 基于明确的 Storage 状态,而不是猜测
4. **灵活性**: 自动处理配置更新和任务启用/禁用

### 解决方案

任务调度器实现了以下机制确保重启后正常工作：

1. **自动初始化**: 
   - 在 `chrome.runtime.onStartup` 事件中自动重新初始化调度器
   - 在 `chrome.runtime.onInstalled` 事件中初始化（安装/更新时）

2. **状态恢复**:
   - 从 `chrome.storage.local` 恢复任务的 `enabled` 状态
   - 恢复 `lastRun` 和 `nextRun` 时间戳
   - 重新创建 Chrome Alarms
   - 重新设置事件监听器

3. **持久化存储**:
   - 任务状态变更时自动保存到 Storage
   - 存储键: `taskSchedulerStates`
   - 存储格式:
     ```javascript
     {
       "message_analysis": {
         "enabled": true,
         "lastRun": 1699999999999,
         "nextRun": 1700001799999
       },
       // ... 其他任务
     }
     ```

### 重启流程

```
浏览器启动
  ↓
chrome.runtime.onStartup 触发
  ↓
调用 initializeTaskScheduler()
  ↓
TaskScheduler.startAllTasks()
  ↓
1. 从 Storage 恢复任务状态（权威来源）
   ├─ taskSchedulerStates 存在 → 恢复所有任务的 enabled/lastRun/nextRun
   └─ taskSchedulerStates 不存在 → 使用默认配置（首次安装）
  ↓
2. 确保所有任务的 Alarms 已创建 (ensureAlarmsCreated)
   遍历所有任务:
   ├─ 任务启用
   │   ├─ chrome.alarms.get(taskId)
   │   ├─ Alarm 不存在 → ✨ 创建新定时器
   │   ├─ Alarm 存在且配置一致 → ✅ 跳过
   │   └─ Alarm 存在但配置不一致 → 🔄 更新定时器
   └─ 任务禁用
       └─ Alarm 存在 → 🗑️ 清除定时器
  ↓
3. 设置 Alarm 监听器（每次都需重新设置）
  ↓
4. 判断是否执行首次运行
   ├─ taskSchedulerStates 不存在（首次安装）→ 🎯 执行首次运行
   └─ taskSchedulerStates 存在（重启恢复）→ 🔄 跳过首次运行
  ↓
5. 标记为已初始化并保存状态
  ↓
任务调度器完全恢复 ✅
```

### 验证方法

重启浏览器后检查任务调度器是否正常工作：

```javascript
// 1. 打开扩展的 Service Worker 控制台
// 2. 查看启动日志

// 浏览器重启场景:
// "🔄 浏览器启动，恢复任务调度器..."
// "🚀 启动统一任务调度器..."
// "🔄 恢复任务状态: {...}"
// "✅ 任务状态恢复完成"
// "🔍 检查并确保所有任务的定时器已创建..."
// "✅ 定时器已存在: 静默消息分析"
// "✅ 定时器已存在: 记忆系统同步"
// "✨ 创建定时器: 用户画像权重衰变" (如果 alarm 被清除了)
// ... (其他任务)
// "✅ 定时器检查完成"
// "👂 定时任务监听器已设置"
// "🔄 恢复已有配置，跳过首次运行"
// "✅ 任务调度器启动完成"

// 首次安装场景:
// "Extension installed/updated"
// "🚀 启动统一任务调度器..."
// "📝 未找到已保存的任务状态，使用默认配置"
// "🔍 检查并确保所有任务的定时器已创建..."
// "✨ 创建定时器: 静默消息分析"
// "✨ 创建定时器: 记忆系统同步"
// "✨ 创建定时器: 系统健康监控"
// ... (其他任务)
// "✅ 定时器检查完成"
// "👂 定时任务监听器已设置"
// "🎯 首次安装，将执行首次任务运行"
// "✅ 任务调度器启动完成"
// "🎯 执行首次定时任务运行..." (10秒后)

// 3. 查询任务状态
chrome.runtime.sendMessage({
  type: 'GET_TASK_SCHEDULER_STATUS'
}, (response) => {
  console.log('重启后的任务状态:', response.tasks);
  // 应该看到之前的 enabled 状态被正确恢复
  // status 应该都是 'running'（如果任务启用）
});

// 4. 验证定时器状态
// 注意: 在 onStartup 事件期间调用可能返回空数组
// 建议在浏览器完全启动后（如在控制台手动运行）验证
chrome.alarms.getAll((alarms) => {
  const taskAlarms = alarms.filter(a => a.name.startsWith('scheduled_task_'));
  console.log('当前任务定时器数量:', taskAlarms.length);
  // 应该等于启用任务的数量，不应该有重复
  taskAlarms.forEach(alarm => {
    console.log(`- ${alarm.name}: 间隔 ${alarm.periodInMinutes} 分钟`);
  });
});

// 5. 测试单个 alarm 查询（更可靠）
chrome.alarms.get('scheduled_task_message_analysis', (alarm) => {
  if (alarm) {
    console.log('消息分析定时器:', alarm);
  } else {
    console.log('⚠️ 消息分析定时器不存在');
  }
});
```

## 快速参考

### 辅助函数 vs 消息 API

| 操作 | 辅助函数 | 消息 API |
|------|---------|---------|
| **读取任务状态** | `await getTaskEnabled('message_analysis')` | ❌ 需要直接访问 Storage |
| **监听状态变化** | `onTaskEnabledChanged('message_analysis', callback)` | ❌ 需要监听 Storage 变化 |
| **控制任务** | ❌ 不支持 | `chrome.runtime.sendMessage({ type: 'CONTROL_TASK', ... })` |
| **查询所有任务** | ❌ 不支持 | `chrome.runtime.sendMessage({ type: 'GET_TASK_SCHEDULER_STATUS' })` |
| **手动执行任务** | ❌ 不支持 | `chrome.runtime.sendMessage({ type: 'CONTROL_TASK', action: 'run' })` |

**推荐使用**:
- ✅ 读取状态时优先使用 `getTaskEnabled()`
- ✅ 监听变化时优先使用 `onTaskEnabledChanged()`
- ✅ 控制任务时使用消息 API

### 常用代码片段

**检查任务状态**:
```typescript
import { getTaskEnabled } from './services/TaskScheduler';
const isEnabled = await getTaskEnabled('message_analysis');
```

**监听状态变化**:
```typescript
import { onTaskEnabledChanged } from './services/TaskScheduler';
const cleanup = onTaskEnabledChanged('message_analysis', (enabled) => {
  console.log('状态:', enabled);
});
```

**启用/禁用任务**:
```typescript
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',
  action: 'toggle',
  enabled: true
});
```

## 相关文档

- [任务调度器验证指南](./task_scheduler_verification.md)
- [任务调度器架构设计](./task_scheduler.md)

