# 任务调度器验证指南

## 概述

本文档提供了验证新的统一任务调度器 (TaskScheduler) 正确工作的方法，确保所有定时任务不会重复执行且不会遗漏。

## 任务调度器架构

### 核心组件

- **TaskScheduler**: 统一任务调度管理器 (`src/services/TaskScheduler.ts`)
- **任务类别**: 按功能分组的4个主要类别
- **Chrome Alarms**: 基于浏览器原生定时器的可靠调度

### 任务定义

| 任务ID | 任务名称 | 类别 | 间隔时间 | 描述 |
|--------|----------|------|----------|------|
| `message_analysis` | 静默消息分析 | message_analysis | 30分钟 | 自动分析RingCentral消息 |
| `memory_sync` | 记忆系统同步 | data_sync | 5分钟 | 同步本地和云端记忆数据 |
| `system_monitoring` | 系统健康监控 | system_maintenance | 60分钟 | 执行系统健康检查和维护 |
| `user_profile_decay` | 用户画像权重衰变 | user_profile | 24小时 | 执行用户画像权重衰变 |

## 验证方法

### 1. 单例模式验证

**目的**: 确保 TaskScheduler 只有一个实例运行

**验证步骤**:
```javascript
// 在浏览器控制台执行
chrome.runtime.sendMessage({ type: 'GET_TASK_SCHEDULER_STATUS' }, (response) => {
  console.log('任务调度器状态:', response);
});
```

**预期结果**: 
- 所有任务状态为 'running' 或 'stopped'
- 每个任务都有唯一的 alarm

### 2. 防重复启动验证

**目的**: 确保多次初始化不会创建重复的定时任务

**验证步骤**:
1. 扩展安装后，检查 Chrome Alarms
```javascript
chrome.alarms.getAll((alarms) => {
  console.log('当前活跃的 Alarms:', alarms);
  // 应该只有4个 scheduled_task_* alarms
});
```

2. 强制重新启动任务调度器
3. 再次检查 Alarms，数量应该保持不变

### 3. 任务执行验证

**目的**: 确保所有任务都能正常执行且不会遗漏

**验证步骤**:

#### 3.1 手动执行验证
```javascript
// 手动执行消息分析任务
chrome.runtime.sendMessage({
  type: 'CONTROL_TASK',
  taskId: 'message_analysis',
  action: 'run'
}, (response) => {
  console.log('手动执行结果:', response);
});
```

#### 3.2 自动执行监控
```javascript
// 监控任务执行日志
// 在后台脚本控制台查看以下日志：
// ⚡ 执行定时任务: [任务名称]
// ✅ 任务 [任务名称] 执行完成，耗时: [时间]ms
```

### 4. 任务独立性验证

**目的**: 确保单个任务失败不会影响其他任务

**验证步骤**:
1. 故意使某个任务失败（如断网状态下的同步任务）
2. 观察其他任务是否正常执行
3. 检查错误日志是否正确记录

### 5. 配置持久性验证

**目的**: 确保任务状态在浏览器重启后保持

**验证步骤**:
1. 启用/禁用某些任务
2. 重启浏览器或重新加载扩展
3. 验证任务状态是否保持

## 常见问题排查

### 问题1: 任务重复执行

**症状**: 相同任务在短时间内多次执行
**排查方法**:
```javascript
chrome.alarms.getAll((alarms) => {
  const duplicates = alarms.filter(alarm => 
    alarm.name.startsWith('scheduled_task_')
  );
  console.log('检查重复的 alarms:', duplicates);
});
```
**解决方案**: 调用 `taskScheduler.stopAllTasks()` 然后重新启动

### 问题2: 任务不执行

**症状**: 任务状态显示运行但没有执行日志
**排查方法**:
1. 检查 alarm 是否存在
2. 检查 alarm 监听器是否设置
3. 检查任务的 enabled 状态

### 问题3: 内存泄漏

**症状**: 扩展内存使用持续增长
**排查方法**:
1. 监控 TaskScheduler 实例数量
2. 检查未清理的 timeout/interval
3. 查看是否有未移除的事件监听器

## 性能监控

### 监控指标

1. **任务执行时间**: 每个任务的平均执行时间
2. **任务成功率**: 任务执行成功/失败的比率
3. **内存使用**: TaskScheduler 及相关组件的内存占用
4. **Alarm 数量**: 活跃的 Chrome Alarms 数量

### 监控代码示例

```javascript
// 获取任务执行统计
chrome.runtime.sendMessage({ type: 'GET_TASK_SCHEDULER_STATUS' }, (response) => {
  const tasks = response.tasks;
  tasks.forEach(task => {
    console.log(`${task.name}:`, {
      状态: task.status,
      上次执行: task.lastRun ? new Date(task.lastRun) : '未执行',
      下次执行: task.nextRun ? new Date(task.nextRun) : '未安排',
      执行间隔: `${task.intervalMinutes}分钟`
    });
  });
});
```

## 迁移验证

### 从旧系统迁移的验证清单

- [ ] 消息分析功能正常工作（原 `startScheduledCheck`）
- [ ] 数据同步功能正常工作（原 `syncCache`）
- [ ] 系统监控功能正常工作（原 `startMonitoring`）
- [ ] 用户画像衰变功能正常工作（原 `executeUserProfileDecay`）
- [ ] 原有的控制接口兼容性（`CONTROL_SCHEDULED_CHECK`）
- [ ] 无重复的 alarm 创建
- [ ] 无遗漏的任务执行

## 总结

通过以上验证方法，可以确保新的任务调度器系统：

1. **无重复执行**: 单例模式和统一的 alarm 管理
2. **无遗漏执行**: 基于可靠的 Chrome Alarms API
3. **故障隔离**: 单个任务失败不影响其他任务
4. **易于监控**: 清晰的日志和状态查询接口
5. **向后兼容**: 保持原有控制接口的兼容性

定期执行这些验证步骤，可以确保系统的稳定性和可靠性。
