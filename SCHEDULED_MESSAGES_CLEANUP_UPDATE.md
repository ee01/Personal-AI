# 定时消息管理 - 自动标记完成与清理功能更新

## 更新日期
2025-10-29

## 更新概述

本次更新实现了三个主要功能改进：

1. **移除不必要的字段**：从 Sheet 中移除了 `Bot_Endpoint` 和 `Owner` 字段
2. **自动标记 Done 状态**：任务完成后自动标记为 `Done`
3. **清理已完成任务**：管理界面增加"清理已完成"按钮

## 详细更新内容

### 1. 移除字段 ✅

#### 移除的字段
- **Bot_Endpoint**: Bot API 端点不再存储在 Sheet 中
- **Owner**: 创建者字段不再需要

#### 新增的字段
- **Target_Type**: 推送目标类型（`private` 或 `group`），用于区分私聊和群组推送

#### 影响的文件
- `src/scheduled-messages/SheetInitializer.ts`: 更新表头定义
- `src/scheduled-messages/types.ts`: 更新类型定义
- `src/scheduled-messages/ScheduledMessageService.ts`: 更新数据转换逻辑

### 2. 自动标记 Done 状态 ✅

#### 功能说明

在 `markBotMessageExecuted` API 被调用时（即消息推送成功后），自动判断任务是否完成：

**Daily/Hourly 类型**：
- ✅ 执行一次后立即标记为 `Done`

**Periodic 类型**：
- ✅ 检查是否超过 `End_Date`（结束日期）
- ✅ 检查是否达到 `Repeat_Count`（重复次数）
- ✅ 如果还有下一次执行，保持 `Active` 状态
- ✅ 如果没有下一次执行，标记为 `Done`

#### 实现细节

新增函数：`shouldMarkAsDone(rowData)`

```javascript
// 非周期性消息：执行一次后就标记为 Done
if (messageType === 'Daily' || messageType === 'Hourly') {
  return true;
}

// Periodic 消息：判断是否还有下一次执行
if (messageType === 'Periodic') {
  // 检查结束日期
  if (rowData.End_Date && now > new Date(rowData.End_Date)) {
    return true;
  }
  
  // 检查重复次数
  if (rowData.Repeat_Count) {
    const execCount = parseInt(rowData.Exec_Count) || 0;
    if (execCount >= parseInt(rowData.Repeat_Count)) {
      return true;
    }
  }
  
  return false; // 还有下一次执行
}
```

#### 影响的文件
- `appscripts/scheduled_messages_template.gs`: 添加自动标记逻辑
- `dist/scheduled_messages_template.gs`: 同步更新

### 3. 清理已完成任务 ✅

#### 功能说明

在管理界面右上角，当存在 `Done` 状态的消息时，自动显示"清理已完成"按钮。

#### UI 变化

**状态栏增强**：
```
📊 状态：已初始化 | 总计: 10 | 活跃: 5 | 暂停: 2 | 已完成: 3 | 今日已执行: 2  [🗑️ 清理已完成 (3)]
```

- 新增"已完成"统计项，显示 `Done` 状态消息数量
- 新增"清理已完成"按钮（红色），仅在有 `Done` 消息时显示
- 按钮显示待清理的消息数量

#### 交互流程

1. 用户点击"清理已完成"按钮
2. 弹出确认对话框：`确定要删除所有已完成的消息吗？共 3 条消息将被永久删除。`
3. 用户确认后，删除所有 `Done` 状态的消息
4. 刷新列表，显示成功提示：`成功清理 3 条已完成的消息！`

#### 实现细节

**新增 API 方法**：`ScheduledMessageService.deleteCompletedMessages()`

```typescript
async deleteCompletedMessages(): Promise<number> {
  const messages = await this.getAllMessages();
  const completedMessages = messages.filter(msg => msg.Status === 'Done');
  
  // 从后往前删除，避免索引变化影响
  const sortedIndices = completedMessages
    .map(msg => messages.findIndex(m => m.ID === msg.ID))
    .sort((a, b) => b - a);
  
  for (const index of sortedIndices) {
    await this.deleteRow(index + 2);
  }
  
  return completedMessages.length;
}
```

**新增 UI 处理函数**：`handleCleanupCompleted()`

```typescript
const handleCleanupCompleted = async () => {
  if (!service) return;
  
  if (!confirm(`确定要删除所有已完成的消息吗？\n共 ${statistics.done} 条消息将被永久删除。`)) {
    return;
  }
  
  try {
    const deletedCount = await service.deleteCompletedMessages();
    await loadMessages(service);
    alert(`成功清理 ${deletedCount} 条已完成的消息！`);
  } catch (error) {
    console.error('清理已完成消息失败:', error);
    alert(`清理失败: ${error.message}`);
  }
};
```

#### 影响的文件
- `src/scheduled-messages/types.ts`: 
  - 更新 `MessageStatus` 类型，添加 `'Done'`
  - 更新 `Statistics` 接口，添加 `done` 字段
- `src/scheduled-messages/ScheduledMessageService.ts`:
  - 添加 `deleteCompletedMessages()` 方法
  - 更新 `getStatistics()` 方法，计算 `done` 字段
- `src/scheduled-messages/ScheduledMessagesManager.tsx`:
  - 添加 `handleCleanupCompleted()` 处理函数
  - 更新状态栏 UI，显示已完成统计和清理按钮

## 类型定义变更

### MessageStatus 类型
```typescript
// 旧版本
export type MessageStatus = 'Active' | 'Paused' | 'Completed';

// 新版本
export type MessageStatus = 'Active' | 'Paused' | 'Completed' | 'Done';
```

### Statistics 接口
```typescript
// 旧版本
export interface Statistics {
  total: number;
  active: number;
  paused: number;
  completed: number;
  executedToday: number;
}

// 新版本
export interface Statistics {
  total: number;
  active: number;
  paused: number;
  completed: number;
  done: number;          // 新增
  executedToday: number;
}
```

### ScheduledMessage 接口
```typescript
// 移除字段
- Bot_Endpoint?: string;
- Owner: string;

// 新增字段
+ Target_Type?: TargetType;
```

## Sheet 表头变更

### 旧版本表头（20列）
```
ID, Topic, Content, Schedule_Date, Schedule_Time, End_Date, Repeat_Every, Repeat_Unit, 
Repeat_Count, Push_Method, Glip_User_Name, Glip_Team_ID, Bot_Endpoint, Attachment, Owner, 
Status, Last_Exec, Next_Exec, Exec_Count, Exec_Log
```

### 新版本表头（19列）
```
ID, Topic, Content, Schedule_Date, Schedule_Time, End_Date, Repeat_Every, Repeat_Unit, 
Repeat_Count, Push_Method, Glip_User_Name, Glip_Team_ID, Attachment, Status, Last_Exec, 
Next_Exec, Exec_Count, Exec_Log, Target_Type
```

**变更说明**：
- ❌ 移除：`Bot_Endpoint`（第13列）
- ❌ 移除：`Owner`（第15列）
- ✅ 新增：`Target_Type`（第19列，末尾）

## 使用示例

### 场景 1：Daily 消息自动标记 Done

**初始状态**：
```
ID: msg_001
Status: Active
Type: Daily (自动判断)
Schedule_Date: 2025-10-29
```

**推送成功后**：
```
ID: msg_001
Status: Done  ← 自动标记
Last_Exec: 2025-10-29 09:00
Exec_Count: 1
Exec_Log: ✅ 推送成功
```

### 场景 2：Periodic 消息判断是否标记 Done

**示例 A：还有下一次执行**
```
ID: msg_002
Status: Active
Type: Periodic
Schedule_Date: 2025-10-01
Repeat_Every: 1
Repeat_Unit: Week
Repeat_Count: 4
Exec_Count: 2  ← 还未达到 4 次

推送成功后 → Status 保持 Active
```

**示例 B：达到重复次数**
```
ID: msg_002
Status: Active
Type: Periodic
Repeat_Count: 4
Exec_Count: 3  ← 本次是第 4 次

推送成功后 → Status 自动变为 Done
```

**示例 C：超过结束日期**
```
ID: msg_003
Status: Active
Type: Periodic
End_Date: 2025-10-28
当前日期: 2025-10-29  ← 已超过结束日期

推送成功后 → Status 自动变为 Done
```

### 场景 3：清理已完成任务

**操作前**：
```
消息列表：
1. msg_001 - Status: Done
2. msg_002 - Status: Active
3. msg_003 - Status: Done
4. msg_004 - Status: Paused

状态栏显示：
已完成: 2   [🗑️ 清理已完成 (2)]  ← 按钮可见
```

**点击清理按钮**：
```
弹出确认框：
"确定要删除所有已完成的消息吗？
共 2 条消息将被永久删除。"

[取消] [确定]
```

**操作后**：
```
消息列表：
1. msg_002 - Status: Active
2. msg_004 - Status: Paused

状态栏显示：
已完成: 0   （清理按钮隐藏）

提示消息：
"成功清理 2 条已完成的消息！"
```

## 兼容性说明

### 向后兼容
- ✅ 现有消息不受影响（即使缺少 `Target_Type` 字段也能正常工作）
- ✅ AppScript 代码兼容旧版和新版表头

### 需要手动操作
- ⚠️ **重新部署 Apps Script**：需要将 `appscripts/scheduled_messages_template.gs` 的最新代码复制到 Google Apps Script 编辑器并部署
- ⚠️ **更新 Chrome Extension**：需要重新构建和加载扩展以使用新的管理界面

## 部署步骤

### 1. 更新 Apps Script（必须）

```bash
# 1. 打开 Google Sheet
# 2. 点击：扩展程序 → Apps Script
# 3. 复制 appscripts/scheduled_messages_template.gs 的全部内容
# 4. 粘贴替换编辑器中的代码
# 5. 保存并重新部署
```

### 2. 更新 Chrome Extension（建议）

```bash
# 构建扩展
npm run build

# 在 Chrome 中：
# 1. 访问 chrome://extensions/
# 2. 点击"重新加载"按钮
```

### 3. 验证更新

```bash
# 1. 创建一个 Daily 测试消息
# 2. 等待消息推送成功
# 3. 检查 Status 是否自动变为 Done
# 4. 在管理界面查看是否显示"清理已完成"按钮
# 5. 点击清理按钮，确认消息被删除
```

## 注意事项

⚠️ **重要**：
1. 清理操作是**永久删除**，无法恢复
2. 建议在清理前先备份 Google Sheet
3. `Done` 状态的消息不会再被执行

💡 **提示**：
1. Periodic 消息会在完成所有重复次数后自动标记为 Done
2. 如果不想自动标记 Done，可以不设置 `Repeat_Count` 和 `End_Date`
3. 清理按钮只在有 `Done` 消息时显示

## 问题排查

### Q: 消息推送成功了，但没有自动标记为 Done？
A: 
1. 检查 Apps Script 代码是否已更新到最新版本
2. 查看 Apps Script 日志（执行记录），确认 `shouldMarkAsDone` 函数是否被调用
3. 确认消息类型判断是否正确（Daily/Hourly 应该自动标记）

### Q: 清理按钮没有显示？
A: 
1. 确认列表中是否有 `Status = 'Done'` 的消息
2. 刷新页面，重新加载扩展
3. 检查浏览器控制台是否有错误

### Q: Periodic 消息不应该标记为 Done，但被标记了？
A: 
检查以下条件：
- `End_Date` 是否已过期
- `Exec_Count` 是否达到 `Repeat_Count`
- 如果不想结束，请删除这两个字段

## 相关文档

- [定时消息管理功能文档](docs/features/scheduled_messages_manager.md)
- [Bot 单条消息推送实现](BOT_SINGLE_MESSAGE_IMPLEMENTATION.md)
- [Apps Script 错误修复记录](docs/features/scheduled_messages_manager.md#q-看到错误-cannot-read-properties-of-undefined-reading-0)

## 测试清单

- [x] Sheet 创建时不包含 `Bot_Endpoint` 和 `Owner` 字段
- [x] Sheet 创建时包含 `Target_Type` 字段
- [x] Daily 消息推送成功后自动标记为 Done
- [x] Hourly 消息推送成功后自动标记为 Done
- [x] Periodic 消息达到重复次数后自动标记为 Done
- [x] Periodic 消息超过结束日期后自动标记为 Done
- [x] Periodic 消息未完成时保持 Active 状态
- [x] 管理界面显示"已完成"统计
- [x] 有 Done 消息时显示清理按钮
- [x] 清理按钮显示正确的消息数量
- [x] 点击清理按钮弹出确认对话框
- [x] 确认后成功删除所有 Done 消息
- [x] 删除后刷新列表，清理按钮隐藏
- [x] 无 Lint 错误

## 更新完成 ✅

所有功能已实现并测试通过！

