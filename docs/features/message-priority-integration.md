# 消息查找逻辑整合 - 三匹配模式查找

## 📋 概述

整合了新旧版本的消息查找逻辑，实现了更完善和可靠的消息执行机制。

## 🔧 主要改进

### 1. 三匹配模式查找机制（防止遗漏消息）

整合后的系统会按以下三种匹配模式依次查找消息：

#### **匹配模式 1：CURRENT_MINUTE（当前分钟的消息）**
- **Time-based 消息**：匹配 `Schedule_Time` 为当前分钟的消息
- **Timeline 消息**：
  - 有 `Schedule_Time`：匹配指定时间（允许1分钟误差）
  - 无 `Schedule_Time`：在早上9点执行
- **用途**：确保消息在指定时间准时执行

#### **匹配模式 2：PAST_30_MINUTES（过去 30 分钟内应该执行但未执行的消息）**
- **Time-based 消息**：匹配 `Schedule_Time` 在过去 30 分钟内的消息
- **Timeline 消息**：匹配 Timeline 目标日期是今天且有 `Schedule_Time` 在过去30分钟内的消息
- 仅处理今天的消息
- **用途**：补偿机制，防止因网络问题等导致消息丢失

#### **匹配模式 3：NO_TIME_SPECIFIED（未指定时间的消息，8 点后）**
- **Time-based 消息**：匹配只设置了 `Schedule_Date` 但没有设置 `Schedule_Time` 的消息
- **Timeline 消息**：匹配 Timeline 目标日期是今天且没有设置 `Schedule_Time` 的消息
- 仅在 8:00 之后执行
- **用途**：处理只关心日期不关心时间的消息

### 2. 按表格顺序查找（不依赖 Priority 字段）

- 消息按表格中的实际顺序查找
- 返回第一个匹配的消息
- **注意**：表格中没有 `Priority` 字段，查找顺序由表格行序决定
- 用户可以通过调整表格中消息的行顺序来控制优先级

### 3. 自动去重机制

- **跳过今日已推送成功的消息**
  - 检查 `Last_Exec` 是否为今天
  - 检查 `Exec_Log` 是否包含 ✅ 或 "成功"
  
- **跳过今日已推送失败的消息**
  - 检查 `Last_Exec` 是否为今天
  - 检查 `Exec_Log` 是否包含 ❌ 或 "失败"
  - 避免失败消息阻塞队列

### 4. 自动生成 ID

- 如果消息的 `ID` 字段为空，自动生成唯一 ID
- 格式：`MSG_{timestamp}_{random}`
- 自动写入 Sheet，避免重复发送

### 5. AI 消息特殊处理

- 识别 `Push_Method = 'AI'` 的消息
- 解析 `AI_Endpoint`（提取 method、host、uri）
- 解析 `AI_Headers`（转换为固定字段对象）
- 替换 `AI_Body` 中的变量（`{Topic}`, `{Content}`, `{TeamID}`）
- 立即标记为成功（避免超时重复）

### 6. Timeline 支持（统一三匹配模式）

- 支持基于项目里程碑的触发
- 通过 Jira Automation 传递 `releaseInfo` 参数
- **与 Time-based 消息一致**：Timeline 消息也支持三种匹配模式
  - ✅ 当前分钟匹配（CURRENT_MINUTE）
  - ✅ 过去30分钟补偿（PAST_30_MINUTES）
  - ✅ 未指定时间（NO_TIME_SPECIFIED）
- **补偿机制**：如果 Timeline 消息在指定时间未执行（如网络问题），会在30分钟内补偿执行
- 自动替换消息中的项目进度变量：
  - `{currentRelease}` - 当前版本号
  - `{currentPhase}` - 当前阶段
  - `{currentPhaseStartDate}` - 当前阶段开始日期
  - `{currentPhaseStartedWorkdays}` - 当前阶段已开始工作日
  - `{nextPhase}` - 下一阶段
  - `{nextPhaseStartDate}` - 下一阶段开始日期
  - `{nextPhaseCountdownWorkdays}` - 距离下一阶段的工作日

## 📊 新旧版本对比

| 特性 | 旧版本 | 新版本（整合前） | 新版本（整合后） |
|------|--------|----------------|----------------|
| 当前分钟消息 | ✅ | ✅ | ✅ |
| 过去30分钟补偿 | ✅ | ❌ | ✅ |
| 未指定时间(8点后) | ✅ | ❌ | ✅ |
| Timeline 支持 | ✅（内网API） | ✅（参数传递） | ✅（参数传递） |
| 按表格顺序查找 | ✅ | ❌ | ✅ |
| 去重检查 | ✅ | ❌ | ✅ |
| 自动生成 ID | ✅ | ❌ | ✅ |
| AI 消息处理 | ✅ | ❌ | ✅ |
| AsMe Timeline支持 | ✅（不安全） | ❌ | ❌（正确） |

## 🔍 核心函数

### `getMessageCurrentTimeWithReleaseInfo(postData)`

主入口函数，整合了三匹配模式查找、ID 生成、AI 消息处理：

```javascript
// 匹配模式 1: 当前分钟的消息
let message = findMatchingMessage(data, headers, now, releaseInfo, 'CURRENT_MINUTE', currentDate, currentHour);

// 匹配模式 2: 过去 30 分钟的消息
if (!message) {
  message = findMatchingMessage(data, headers, now, releaseInfo, 'PAST_30_MINUTES', currentDate, currentHour);
}

// 匹配模式 3: 未指定时间的消息（8点后）
if (!message && currentHour >= 8) {
  message = findMatchingMessage(data, headers, now, releaseInfo, 'NO_TIME_SPECIFIED', currentDate, currentHour);
}

// 确保消息有 ID
if (!message.ID) {
  message.ID = `MSG_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
  // 写入 Sheet
}

// 检查是否是 AI 消息
if (message.Push_Method === 'AI') {
  // 解析 AI 字段
  // 立即标记为成功
  // 返回 AI 消息数据
}

// 返回 Bot 消息数据
```

### `findMatchingMessage(data, headers, now, releaseInfo, matchMode, currentDate, currentHour)`

核心查找函数，按匹配模式查找消息：

**参数说明：**
- `data` - 表格数据
- `headers` - 表头
- `now` - 当前时间
- `releaseInfo` - 项目进度信息（用于 Timeline）
- `matchMode` - 匹配模式：`'CURRENT_MINUTE'` | `'PAST_30_MINUTES'` | `'NO_TIME_SPECIFIED'`
- `currentDate` - 当前日期（yyyy-MM-dd）
- `currentHour` - 当前小时

**处理流程：**
1. 按表格顺序遍历所有消息（Active + Bot/AI）
2. 过滤已推送成功/失败的消息
3. 根据 matchMode 调用对应的 shouldExecute 函数
4. 每个 shouldExecute 函数内部自动判断 Timeline 或 Time-based
5. 返回第一个匹配的消息（按表格顺序）

### `shouldExecuteNow(rowData, now, messageType, releaseInfo, currentDate)`
### `shouldExecuteInPast30Minutes(rowData, now, messageType, currentDate, releaseInfo)`
### `shouldExecuteTodayWithoutTime(rowData, now, messageType, currentDate, releaseInfo)`

三个匹配函数，分别对应三种匹配模式：

**共同特点：**
- 内部自动判断消息类型（Timeline 或 Time-based）
- Timeline 消息调用 `getTimelineTargetDate()` 获取目标日期
- Time-based 消息直接读取 `Schedule_Date`
- 统一的处理逻辑，无需外部判断

### `getTimelineTargetDate(rowData, releaseInfo)`

辅助函数，获取 Timeline 消息的目标日期：

**处理流程：**
1. 从 `releaseInfo` 中获取项目和里程碑信息
2. 解析里程碑日期（格式：MM/DD/YYYY）
3. 应用偏移量（Timeline_Offset）
4. 返回最终的目标日期

## 🚨 防止遗漏消息的场景

### 场景 1：网络问题导致消息未执行（Time-based 和 Timeline 消息通用）

**问题：**
- Time-based 消息应该在 17:00 执行，由于网络问题未执行
- Timeline 消息应该在项目里程碑日 17:00 执行，由于网络问题未执行

**解决：**
- 在 17:01 - 17:30 之间，匹配模式 2（PAST_30_MINUTES）会持续尝试
- **Time-based 和 Timeline 消息享受相同的补偿机制**
- 确保消息不会因为瞬时故障而丢失

### 场景 2：只关心日期不关心时间（Time-based 和 Timeline 消息通用）

**问题：**
- Time-based 消息只设置了 `Schedule_Date`，没有设置 `Schedule_Time`
- Timeline 消息设置了里程碑触发，但没有设置 `Schedule_Time`

**解决：**
- 匹配模式 3（NO_TIME_SPECIFIED）会在 8:00 之后执行此类消息
- **Time-based 消息**：在 8 点后任何时间执行
- **Timeline 消息**：在目标日期的 9 点执行（CURRENT_MINUTE 模式），如果错过则 8 点后兜底（NO_TIME_SPECIFIED 模式）
- 适合日报、周报等场景

### 场景 3：多条消息同时触发

**问题：**
- 多条消息都应该在同一时间执行
- 需要确定执行顺序

**解决：**
- 按表格行顺序查找
- 返回第一个匹配的消息
- 用户可以通过调整表格中消息的行顺序来控制优先级

## 📝 使用建议

### 1. 调整消息执行顺序

通过调整表格中消息的行顺序来控制优先级：
- **重要消息**：放在表格上方
- **普通消息**：放在表格中间
- **低优先级消息**：放在表格下方
- **说明**：系统按表格顺序查找，返回第一个匹配的消息

### 2. 合理使用三种触发方式

- **精确时间触发**: 设置 `Schedule_Date` + `Schedule_Time`
- **日期触发**: 只设置 `Schedule_Date`（8点后执行）
- **Timeline 触发**: 设置 `Timeline_Project` + `Timeline_Milestone` + `Timeline_Offset`

### 3. 监控执行日志

查看 `Exec_Log` 列：
- ✅ 推送成功
- ❌ 推送失败
- 查看 `Last_Exec` 了解最后执行时间

## 🔄 与 Jira Automation 的集成

Jira Automation 每分钟调用一次 Google Apps Script：

```javascript
// GET 请求（带 releaseInfo 参数）
https://script.google.com/.../exec?action=getBotMessageCurrentTime
  &mThor={releaseInfo}
  &jupiterDesktop={releaseInfo}
  &jupiterWeb={releaseInfo}

// POST 请求（JSON body）
{
  "releaseInfo": {
    "mThor": {...},
    "Jupiter desktop": {...},
    "Jupiter web": {...}
  },
  "currentTime": "2025-11-12 17:00"
}
```

## ✅ 验证结果

- ✅ 无 Linter 错误
- ✅ 保留旧版本的可靠性（三匹配模式查找）
- ✅ 移除不存在的 Priority 字段依赖（按表格顺序查找）
- ✅ 函数重命名：`findMessageByPriority` → `findMatchingMessage`
- ✅ 参数改进：`priorityLevel` (数字) → `matchMode` (字符串枚举)
- ✅ 整合中转函数：移除 `findMessageWithTimelineSupport`
- ✅ 补充缺失逻辑：自动生成 ID + AI 消息处理
- ✅ Timeline 参数传递（不调用内网 API）
- ✅ 修复 AsMe 推送的 Timeline 处理（不再调用内网 API）
- ✅ **统一匹配逻辑**：Timeline 和 Time-based 消息共享三匹配模式
- ✅ **代码极简化**：移除外部 `if (isTimeline)` 判断，函数内部自动识别
- ✅ **删除冗余函数**：`checkTimelineTrigger` 被拆分到三个 `shouldExecute` 函数中
- ✅ **新增辅助函数**：`getTimelineTargetDate()` 用于获取 Timeline 目标日期

## 🎯 关键改进点

### 1. 函数命名更清晰

- **旧名称**：`findMessageByPriority(priorityLevel)` 
  - ❌ 误导：让人以为有 Priority 字段
- **新名称**：`findMatchingMessage(matchMode)`
  - ✅ 清晰：表达按匹配模式查找

### 2. 参数使用更直观

- **旧参数**：`priorityLevel = 1 | 2 | 3`
  - ❌ 不清晰：数字含义需要查文档
- **新参数**：`matchMode = 'CURRENT_MINUTE' | 'PAST_30_MINUTES' | 'NO_TIME_SPECIFIED'`
  - ✅ 自解释：一看就懂是什么意思

### 3. 代码结构更简洁

- **旧结构**：`getMessageCurrentTimeWithReleaseInfo` → `findMessageWithTimelineSupport` → `findMessageByPriority`
  - ❌ 三层嵌套，中转函数冗余
- **新结构**：`getMessageCurrentTimeWithReleaseInfo` → `findMatchingMessage`
  - ✅ 两层结构，直接调用

### 4. Timeline 和 Time-based 消息统一处理

- **原逻辑**：
  - ❌ Timeline 消息只在 CURRENT_MINUTE 模式处理
  - ❌ 没有补偿机制
  - ❌ 与 Time-based 消息处理逻辑不一致
  - ❌ 代码有重复，分别在不同函数处理
  
- **新逻辑**：
  - ✅ Timeline 消息支持三种匹配模式
  - ✅ 享受 30 分钟补偿机制
  - ✅ 与 Time-based 消息处理逻辑完全一致
  - ✅ 代码复用，维护更简单
  - ✅ 无需外部判断，函数内部自动识别

**实现方式（极简）**：
```javascript
// 在 findMatchingMessage 中，不需要判断 isTimeline
if (matchMode === 'CURRENT_MINUTE') {
  matches = shouldExecuteNow(rowData, now, messageType, releaseInfo, currentDate);
} else if (matchMode === 'PAST_30_MINUTES') {
  matches = shouldExecuteInPast30Minutes(rowData, now, messageType, currentDate, releaseInfo);
} else if (matchMode === 'NO_TIME_SPECIFIED') {
  matches = shouldExecuteTodayWithoutTime(rowData, now, messageType, currentDate, releaseInfo);
}

// 每个 shouldExecute 函数内部自动判断是 Timeline 还是 Time-based
function shouldExecuteNow(rowData, now, messageType, releaseInfo, currentDate) {
  const isTimeline = !rowData.Schedule_Date && rowData.Timeline_Milestone;
  
  if (isTimeline) {
    // 处理 Timeline 消息
    const targetDate = getTimelineTargetDate(rowData, releaseInfo);
    // ...
  } else {
    // 处理 Time-based 消息
    // ...
  }
}
```

**好处**：
- ✅ 代码结构更简洁（无需外部 if/else 判断）
- ✅ Timeline 消息不再因为网络问题而丢失
- ✅ 两种类型的消息享受相同的可靠性保障
- ✅ 用户不需要区分消息类型，都能享受补偿机制
- ✅ 函数职责更单一（每个 shouldExecute 函数负责一种匹配模式）

## 📅 修改日期

2025-11-12

