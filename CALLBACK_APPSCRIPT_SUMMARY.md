# AppScript 回调机制说明

## 🎯 为什么需要回调？

在 Jira Automation Rule 中，Bot API 调用后**必须回调 AppScript**，原因：

### 问题

如果不回调：
1. ❌ Google Sheet 中的 `Last_Exec`、`Exec_Log`、`Exec_Count` 不会更新
2. ❌ 过滤逻辑失效（看不到今日是否已推送）
3. ❌ 消息会每分钟重复发送（因为始终符合"今日未推送"条件）
4. ❌ 无法统计执行次数和成功率

### 解决方案

每次 Bot API 调用后，立即回调 AppScript 的 `markBotMessageExecuted` API，更新执行记录。

## 📋 完整流程

```
1. Jira 触发（每分钟）
   ↓
2. 调用 AppScript: getBotMessageCurrentTime
   ← 返回: { executed: true, messageId, content, targetType, ... }
   ↓
2.5 保存变量 ⚠️ (重要！)
    - messageId = {{webhookResponse.body.messageId}} （唯一标识符）
    - messageContent = {{webhookResponse.body.content}}
    - teamId = {{webhookResponse.body.teamId}}
    - teamName = {{webhookResponse.body.teamName}}
   ↓
3. 判断消息类型 (targetType)
   ↓
4a. 如果是 private:
    - POST /personal/message (使用 {{messageContent}})
    - GET markBotMessageExecuted (使用 {{messageId}}) ← 关键！
    
4b. 如果是 group:
    - POST /team/message (使用 {{messageContent}} {{teamId}} {{teamName}})
    - GET markBotMessageExecuted (使用 {{messageId}}) ← 关键！
```

**⚠️ 为什么必须保存变量？**

因为每次 webhook 调用都会覆盖 `{{webhookResponse}}`：
- 第 2 步：`{{webhookResponse}}` = AppScript 返回的数据
- 第 4a/4b 步：`{{webhookResponse}}` = Bot API 返回的数据（已覆盖！）

如果不保存变量，回调时无法获取 `messageId` 等关键数据！

**💡 为什么只传 messageId？**

- `messageId` 是唯一标识符，AppScript 内部会通过它查找对应的行
- 不需要传 `rowIndex`，因为行号可能会变化（插入/删除行）
- 使用 ID 查找更准确、更可靠

## 🔧 AppScript 实现

### 1. API Handler

```javascript
// doGet 中添加
if (action === 'markBotMessageExecuted') {
  const messageId = e.parameter.messageId || '';
  const success = e.parameter.success === 'true';
  const error = e.parameter.error || '';
  
  return ContentService.createTextOutput(
    JSON.stringify(markBotMessageExecuted(messageId, success, error))
  ).setMimeType(ContentService.MimeType.JSON);
}
```

### 2. 核心函数

```javascript
function markBotMessageExecuted(messageId, success, errorMsg) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
    if (!sheet) {
      return { success: false, error: 'Messages sheet not found' };
    }
    
    // 通过 messageId 查找行
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID');
    
    if (idColIndex === -1) {
      return { success: false, error: 'ID column not found' };
    }
    
    let foundRowIndex = -1;
    let rowData = null;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[idColIndex] === messageId) {
        foundRowIndex = i + 1;
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
    
    return {
      success: true,
      messageId: messageId,
      rowIndex: foundRowIndex,
      marked: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}
```

### 3. 更新的字段

`updateExecutionLog` 函数会更新以下字段：
- `Last_Exec`: 最后执行时间（当前时间）
- `Exec_Count`: 执行次数（+1）
- `Exec_Log`: 执行日志（✅ 推送成功 或 ❌ 推送失败）
- `Next_Exec`: 下次执行时间（仅 Periodic 类型）
- `Status`: 如果达到 Repeat_Count，标记为 Completed

## 🌐 Jira Rule 配置

### Private 消息分支

```
Condition: targetType == "private"
├─ Send web request: POST /personal/message
│  Body: { "mention": false, "email": "...", "message": {{content}} }
│
└─ Send web request: GET markBotMessageExecuted
   URL: ?action=markBotMessageExecuted
        &messageId={{webhookResponse.body.messageId}}
        &rowIndex={{webhookResponse.body.rowIndex}}
        &success=true
```

### Group 消息分支

```
Condition: targetType == "group"
├─ Send web request: POST /team/message
│  Body: { "teamId": "...", "teamName": "...", "message": {{content}} }
│
└─ Send web request: GET markBotMessageExecuted
   URL: ?action=markBotMessageExecuted
        &messageId={{webhookResponse.body.messageId}}
        &rowIndex={{webhookResponse.body.rowIndex}}
        &success=true
```

## 📊 API 参数说明

### markBotMessageExecuted API

**URL**: `YOUR_WEB_APP_URL?action=markBotMessageExecuted&...`

**Method**: GET

**Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | ✅ | 固定值：`markBotMessageExecuted` |
| `messageId` | string | ✅ | 消息 ID（从第1步返回） |
| `rowIndex` | number | ✅ | Sheet 行号（从第1步返回） |
| `success` | boolean | ✅ | 是否成功：`true` 或 `false` |
| `error` | string | ❌ | 错误消息（失败时提供） |

**示例**:
```
https://script.google.com/.../exec?action=markBotMessageExecuted&messageId=MSG001&rowIndex=2&success=true
```

**响应**:
```json
{
  "success": true,
  "messageId": "MSG001",
  "marked": true
}
```

## 🧪 测试验证

### 1. 测试流程

1. 在 Google Sheet 添加测试消息
2. 等待 Jira Rule 执行（1-2 分钟）
3. 查看 Sheet 中的变化：
   - `Last_Exec` 应更新为当前时间
   - `Exec_Log` 应显示 ✅ 推送成功
   - `Exec_Count` 应 +1

### 2. 验证回调是否生效

**检查 Jira Audit Log**:
1. 打开 Jira → Automation → 找到 rule
2. 查看 Audit Log
3. 应该看到 3 个 webhook 调用：
   - ✅ GET getBotMessageCurrentTime
   - ✅ POST /personal/message (或 /team/message)
   - ✅ GET markBotMessageExecuted

**检查 AppScript 日志**:
1. 打开 Apps Script 编辑器
2. 执行 → 执行情况
3. 应该看到：
   ```
   [Bot 单条消息] 选中消息: MSG001
   返回待发送 Bot 消息数据: MSG001
   标记消息执行完成: MSG001, 成功: true
   ```

### 3. 验证重复发送防止

1. 第一次执行后，`Last_Exec` 更新为今天
2. 第二次执行时，消息应被过滤（今日已推送成功）
3. Jira 返回：`{ executed: false, message: "当前时间点没有需要执行的 Bot 消息" }`

## 🔍 失败处理

### 如果 Bot API 失败

虽然当前版本中回调固定传 `success=true`，但可以扩展为：

1. 在 Jira Rule 中添加错误处理
2. 如果 Bot API 返回非 200，调用回调时传 `success=false`
3. AppScript 会标记为失败：`Exec_Log = ❌ 推送失败`

### 失败消息的处理

根据现有逻辑：
- 今日失败的消息会被过滤（避免阻塞队列）
- 第二天会自动重试（因为 `Last_Exec` 日期不是今天）

## ✅ 优势总结

1. **准确的状态追踪**
   - 知道每条消息的执行状态
   - 可以查看历史执行记录

2. **防止重复发送**
   - 通过 `Last_Exec` + `Exec_Log` 过滤
   - 今日已成功的消息不会重复发送

3. **统计和监控**
   - 可以统计执行次数
   - 可以监控成功率
   - 可以查看失败原因

4. **周期性消息支持**
   - 通过 `Exec_Count` 判断是否达到次数限制
   - 自动标记为 Completed

## 📚 相关文档

- `JIRA_MANUAL_RULE_CREATION.md` - 包含回调配置步骤
- `scheduled_messages_template.gs` - AppScript 完整实现
- `BOT_SINGLE_MESSAGE_IMPLEMENTATION.md` - 整体架构说明

---

**回调机制是整个 Bot 推送系统的关键组件，必不可少！** ✅

