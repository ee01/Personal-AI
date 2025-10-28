# 消息分析配置重构

**最后更新**: 2024-01-10

## 概述

将原有的单一 `SCHEDULED_INTERVAL` 配置项拆分为两个独立的配置项，使消息分析的频度和上下文窗口可以独立配置。

## 变更内容

### 1. 配置项变更

**旧配置**:
- `SCHEDULED_INTERVAL`: 定时分析消息间隔（分钟）

**新配置**:
- `MESSAGE_ANALYSIS_INTERVAL`: 消息分析频度（分钟）- 每隔多久执行一次消息分析
- `MESSAGE_CONTEXT_WINDOW`: 消息上下文窗口（分钟）- 每次分析时额外获取的历史消息时间范围

### 2. 默认值

- `MESSAGE_ANALYSIS_INTERVAL`: 120 分钟（与旧的 `SCHEDULED_INTERVAL` 默认值保持一致）
- `MESSAGE_CONTEXT_WINDOW`: 5 分钟（从硬编码的 +5 提取为独立配置）

### 3. 向后兼容

为保证向后兼容性，保留了 `SCHEDULED_INTERVAL` 配置项作为回退值：
- 如果新配置项不存在，会自动读取 `SCHEDULED_INTERVAL` 的值
- 旧配置会自动迁移到新配置项

## 影响的文件

### 核心文件
1. **src/utils.ts**
   - 添加 `MESSAGE_ANALYSIS_INTERVAL` 和 `MESSAGE_CONTEXT_WINDOW` 到 `EnvConfigType` 接口
   - 更新 `defaultEnvConfig` 默认值
   - 保留 `SCHEDULED_INTERVAL` 以实现向后兼容

2. **src/services/TaskScheduler.ts**
   - 更新任务初始化逻辑，使用新的配置项
   - 更新消息分析任务的时间范围计算逻辑
   - 更新配置变化监听器，支持两个配置项的独立监听
   - 更新日志输出，显示分析间隔和上下文窗口

3. **src/options.tsx**
   - 移除原有的 `SCHEDULED_INTERVAL` 输入框
   - 添加 `MESSAGE_ANALYSIS_INTERVAL` 输入框（消息分析频度）
   - 添加 `MESSAGE_CONTEXT_WINDOW` 输入框（消息上下文窗口）
   - 为每个输入框添加说明文字

## 使用场景

### 场景 1: 高频分析，短上下文
```
MESSAGE_ANALYSIS_INTERVAL = 15 分钟
MESSAGE_CONTEXT_WINDOW = 3 分钟
```
每 15 分钟分析一次，每次获取 18 分钟的消息（15 + 3）

### 场景 2: 低频分析，长上下文
```
MESSAGE_ANALYSIS_INTERVAL = 120 分钟
MESSAGE_CONTEXT_WINDOW = 30 分钟
```
每 120 分钟分析一次，每次获取 150 分钟的消息（120 + 30）

### 场景 3: 默认配置
```
MESSAGE_ANALYSIS_INTERVAL = 120 分钟
MESSAGE_CONTEXT_WINDOW = 5 分钟
```
每 120 分钟分析一次，每次获取 125 分钟的消息（120 + 5）

## 技术细节

### 时间范围计算

**旧逻辑**:
```typescript
const startTime = new Date(Date.now() - (Number(config.SCHEDULED_INTERVAL) + 5) * 60 * 1000);
```

**新逻辑**:
```typescript
const analysisInterval = Number(config.MESSAGE_ANALYSIS_INTERVAL) || Number(config.SCHEDULED_INTERVAL) || 30;
const contextWindow = Number(config.MESSAGE_CONTEXT_WINDOW) || 5;
const startTime = new Date(Date.now() - (analysisInterval + contextWindow) * 60 * 1000);
```

### 配置变化监听

系统会自动监听配置变化：
- 当 `MESSAGE_ANALYSIS_INTERVAL` 变化时，自动更新任务定时器
- 当 `MESSAGE_CONTEXT_WINDOW` 变化时，记录日志（下次分析时生效）

## 迁移指南

### 自动迁移
用户无需手动操作，系统会自动处理：
1. 首次加载时，如果只有 `SCHEDULED_INTERVAL`，会自动作为 `MESSAGE_ANALYSIS_INTERVAL` 的默认值
2. `MESSAGE_CONTEXT_WINDOW` 默认为 5 分钟

### 手动配置
用户可以在选项页面单独配置两个参数：
1. 打开扩展选项页面
2. 在"常规设置"部分找到两个新的配置项
3. 根据需要调整值并保存

## 测试建议

1. **配置迁移测试**
   - 测试只有旧配置时的自动迁移
   - 测试新旧配置同时存在时的优先级

2. **功能测试**
   - 测试不同配置组合下的消息分析时间范围
   - 验证配置变化后的实时更新

3. **向后兼容性测试**
   - 确保使用旧配置的用户不受影响
   - 验证配置自动迁移逻辑

## 未来改进

- [ ] 添加配置验证，确保 `MESSAGE_CONTEXT_WINDOW` 不大于 `MESSAGE_ANALYSIS_INTERVAL`
- [ ] 在 UI 中显示实际的消息获取时间范围（分析间隔 + 上下文窗口）
- [ ] 提供配置建议，根据用户的使用习惯推荐合适的配置值

