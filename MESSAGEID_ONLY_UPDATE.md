# MessageID Only Update - 使用唯一标识符标记执行

## 📝 更新概述

**日期**: 2025-10-29

**目的**: 优化 Jira Automation 回调 AppScript 的方式，只使用 `messageId` 作为唯一标识符，不再传递 `rowIndex`。

## 🎯 主要改进

### 1. 更准确的查找方式

**之前**：
- 使用 `rowIndex` 定位行
- 如果有行插入/删除，`rowIndex` 可能不准确

**现在**：
- 只使用 `messageId` 唯一标识符
- AppScript 内部通过 ID 查找行
- 更可靠，不受行号变化影响

### 2. 简化 Jira 变量

**之前**：需要保存 5 个变量
```
- messageId
- rowIndex
- messageContent
- teamId
- teamName
```

**现在**：只需保存 4 个变量
```
- messageId （唯一标识符）
- messageContent
- teamId
- teamName
```

### 3. 简化回调 URL

**之前**：
```
YOUR_WEB_APP_URL?action=markBotMessageExecuted&messageId={{messageId}}&rowIndex={{rowIndex}}&success=true
```

**现在**：
```
YOUR_WEB_APP_URL?action=markBotMessageExecuted&messageId={{messageId}}&success=true
```

## 🔧 代码修改

### 1. AppScript: `getBotMessageDataCurrentTime()`

**添加功能**：
- 检查消息是否有 ID
- 如果没有 ID，自动生成一个（`MSG_{timestamp}_{random}`）
- 将生成的 ID 写入 Google Sheet

```javascript
// 确保消息有 ID，如果没有则生成一个
let messageId = message.ID;
if (!messageId || messageId.toString().trim() === '') {
  messageId = `MSG_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
  Logger.log(`消息没有 ID，生成新 ID: ${messageId}`);
  
  // 更新 Sheet 中的 ID
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
  if (sheet && message.rowIndex) {
    const idColIndex = message.headers.indexOf('ID') + 1;
    if (idColIndex > 0) {
      sheet.getRange(message.rowIndex, idColIndex).setValue(messageId);
    }
  }
}
```

**返回值变化**：
- ❌ 不再返回 `rowIndex`
- ✅ 确保返回有效的 `messageId`

### 2. AppScript: `markBotMessageExecuted()`

**函数签名变化**：
```javascript
// 之前
function markBotMessageExecuted(messageId, rowIndex, success, errorMsg)

// 现在
function markBotMessageExecuted(messageId, success, errorMsg)
```

**实现逻辑**：
- 通过 `messageId` 在 Sheet 中查找对应的行
- 使用 `indexOf('ID')` 定位 ID 列
- 遍历所有行，匹配 `messageId`
- 找到后更新执行日志

```javascript
// 通过 messageId 查找行
const data = sheet.getDataRange().getDisplayValues();
const headers = data[0];
const idColIndex = headers.indexOf('ID');

let foundRowIndex = -1;
let rowData = null;

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (row[idColIndex] === messageId) {
    foundRowIndex = i + 1; // Sheet 行号从 1 开始
    rowData = parseRow(row, headers);
    break;
  }
}

if (foundRowIndex === -1) {
  return { 
    success: false, 
    error: `Message not found: ${messageId}` 
  };
}

// 更新执行日志
updateExecutionLog(sheet, foundRowIndex, rowData, success, headers, errorMsg);
```

### 3. AppScript: `doGet()` Handler

```javascript
// 之前
if (action === 'markBotMessageExecuted') {
  const messageId = e.parameter.messageId || '';
  const rowIndex = parseInt(e.parameter.rowIndex) || 0;
  const success = e.parameter.success === 'true';
  const error = e.parameter.error || '';
  
  return ContentService.createTextOutput(
    JSON.stringify(markBotMessageExecuted(messageId, rowIndex, success, error))
  ).setMimeType(ContentService.MimeType.JSON);
}

// 现在
if (action === 'markBotMessageExecuted') {
  const messageId = e.parameter.messageId || '';
  const success = e.parameter.success === 'true';
  const error = e.parameter.error || '';
  
  return ContentService.createTextOutput(
    JSON.stringify(markBotMessageExecuted(messageId, success, error))
  ).setMimeType(ContentService.MimeType.JSON);
}
```

## 📖 文档更新

### 1. `JIRA_MANUAL_RULE_CREATION.md`

- ✅ Step 3.5: 从 5 个变量减少到 4 个
- ✅ 回调 URL: 去掉 `rowIndex` 参数
- ✅ 流程图: 更新变量列表
- ✅ 预期结构: 更新为 4 个 Create variable actions
- ✅ 注意事项: 解释为什么只需 messageId

### 2. `CALLBACK_APPSCRIPT_SUMMARY.md`

- ✅ 完整流程: 去掉 rowIndex 变量
- ✅ 添加解释: 为什么只传 messageId
- ✅ 更新函数签名和实现代码

### 3. `JIRA_VARIABLE_FIX.md`

- ✅ 修复步骤: 从 5 个变量改为 4 个
- ✅ 回调 URL: 去掉 rowIndex
- ✅ 添加说明: 为什么不需要 rowIndex

## ✅ 优势

1. **更可靠**：
   - 使用唯一标识符，不受行号变化影响
   - 即使有行插入/删除，仍能正确查找

2. **更简洁**：
   - 减少一个 Jira 变量
   - 简化回调 URL

3. **自动生成 ID**：
   - 如果消息没有 ID，自动生成并写入 Sheet
   - 确保每条消息都有唯一标识符

4. **向后兼容**：
   - 不影响现有数据结构
   - 只是改变查找方式

## 🧪 测试建议

1. **测试自动生成 ID**：
   - 创建一条没有 ID 的消息
   - 验证 AppScript 能否自动生成并写入

2. **测试 ID 查找**：
   - 手动调用 `markBotMessageExecuted`
   - 验证能否通过 messageId 正确查找并更新

3. **测试完整流程**：
   - Jira 触发 → AppScript 获取消息 → Bot API 发送 → AppScript 标记
   - 验证 Google Sheet 的 `Last_Exec` 和 `Exec_Log` 是否正确更新

## 📋 迁移指南

### 对于新部署

直接按照更新后的 `JIRA_MANUAL_RULE_CREATION.md` 创建 Rule：
- 只创建 4 个变量
- 回调 URL 中只包含 `messageId`

### 对于已有 Rule

如果您已经创建了包含 `rowIndex` 的 Rule：
1. 可以保留现有 Rule（AppScript 仍支持旧参数，只是忽略）
2. 或者修改 Rule，去掉 `rowIndex` 变量和参数

## 🎉 总结

这次更新通过使用 `messageId` 作为唯一标识符，简化了 Jira Automation 和 AppScript 之间的交互，提高了系统的可靠性和准确性。同时自动生成 ID 的功能确保了每条消息都能被正确追踪和标记。

---

**状态**: ✅ 已完成

**相关文件**:
- `appscripts/scheduled_messages_template.gs`
- `JIRA_MANUAL_RULE_CREATION.md`
- `CALLBACK_APPSCRIPT_SUMMARY.md`
- `JIRA_VARIABLE_FIX.md`

