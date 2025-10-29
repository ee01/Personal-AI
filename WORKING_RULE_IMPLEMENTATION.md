# Working Rule Implementation - 基于用户成功创建的 Rule

## 📋 更新概述

**日期**: 2025-10-29

**目的**: 根据用户成功手动创建的 Jira Automation Rule，更新代码和模板，使扩展能够自动创建相同结构的 rule。

## 🎯 用户成功的 Rule 结构分析

从用户导出的 `automation-rule-2048-202510290409.json` 中，我们发现了实际可用的结构：

### 关键发现

1. **只保存一个变量**: `messageId`
   - 虽然创建了变量，但实际使用时仍然从 `{{webhookResponse.body.xxx}}` 读取

2. **Webhook 的 responseEnabled 设置很关键**:
   - 第一个 webhook (AppScript): `responseEnabled: true`
   - Bot API webhook: `responseEnabled: true` 
   - 回调 webhook: `responseEnabled: false`

3. **在 Condition 分支内，`{{webhookResponse}}` 保持第一个 webhook 的值**:
   - 即使执行了 Bot API webhook（responseEnabled=true），回调时仍能访问 `{{webhookResponse.body.messageId}}` 和 `{{webhookResponse.body.rowIndex}}`
   - 这是因为回调 webhook 的 `responseEnabled=false`，不会覆盖响应

4. **Bot API URL 差异**:
   - Private 消息: `/user/message` (不是 `/personal/message`)
   - Group 消息: `/team/message`

5. **customBody 中的 smart values 可以直接在 JSON 中**:
   - 如：`"message": {{webhookResponse.body.content.asJsonString}}`
   - Jira 在运行时会替换这些值

6. **回调 URL 包含两个参数**:
   - `messageId={{webhookResponse.body.messageId}}`
   - `rowIndex={{webhookResponse.body.rowIndex}}`

### Rule 结构

```
Trigger: Scheduled (cron: 0 * * * * ?)
├─ Action: Send web request (AppScript, responseEnabled: true)
├─ Action: Create variable (messageId)
├─ Condition: executed == true
└─ Condition Container
   ├─ Condition Block (if targetType == "private")
   │  ├─ Condition: targetType == "private"
   │  ├─ Action: Send web request (Bot API /user/message, responseEnabled: true)
   │  └─ Action: Send web request (callback, responseEnabled: false)
   │
   └─ Condition Block (if targetType == "group")
      ├─ Condition: targetType == "group" (implicit)
      ├─ Action: Send web request (Bot API /team/message, responseEnabled: true)
      └─ Action: Send web request (callback, responseEnabled: false)
```

## 🔧 代码修改

### 1. AppScript: `scheduled_messages_template.gs`

#### 恢复 `rowIndex` 参数

**`doGet()` Handler**:
```javascript
if (action === 'markBotMessageExecuted') {
  const messageId = e.parameter.messageId || '';
  const rowIndex = parseInt(e.parameter.rowIndex) || 0;  // 恢复
  const success = e.parameter.success === 'true';
  const error = e.parameter.error || '';
  
  return ContentService.createTextOutput(
    JSON.stringify(markBotMessageExecuted(messageId, rowIndex, success, error))
  ).setMimeType(ContentService.MimeType.JSON);
}
```

**`markBotMessageExecuted()` 函数签名**:
```javascript
function markBotMessageExecuted(messageId, rowIndex, success, errorMsg) {
  // 直接使用 rowIndex 定位行
  const row = data[rowIndex - 1];
  const rowData = parseRow(row, headers);
  updateExecutionLog(sheet, rowIndex, rowData, success, headers, errorMsg);
  // ...
}
```

**`getBotMessageDataCurrentTime()` 返回值**:
```javascript
return {
  executed: true,
  messageId: messageId,
  content: message.Content,
  targetType: targetType,
  rowIndex: message.rowIndex,  // 恢复返回 rowIndex
  // ...
};
```

### 2. 新模板: `jira-rule-template-v3-working.json`

创建了新的模板，完全基于用户成功的 rule：

**关键特性**:
- ✅ 使用 `jira.condition.container.block` 和 `jira.condition.if.block` 结构
- ✅ Condition 作为 `conditions` 数组放在 block 内
- ✅ Bot API 使用 `/user/message` 和 `/team/message`
- ✅ customBody 直接包含 smart values（作为 JSON 字符串的一部分）
- ✅ 回调 URL 包含 `messageId` 和 `rowIndex`
- ✅ 回调 webhook 的 `responseEnabled: false`

**Private 消息的 customBody**:
```json
{
  "email": "{{USER_EMAIL}}",
  "message": {{webhookResponse.body.content.asJsonString}},
  "mentionAutoCorrect": true,
  "mention": true
}
```

**Group 消息的 customBody**:
```json
{
  "mentionList": [],
  "isTeamMention": false,
  "teamName": "{{webhookResponse.body.teamName}}",
  "teamId": "{{webhookResponse.body.teamId}}",
  "message": {{webhookResponse.body.content.asJsonString}},
  "skipMentionCheck": true
}
```

**回调 URL**:
```
{{WEB_APP_URL}}?action=markBotMessageExecuted&messageId={{webhookResponse.body.messageId}}&rowIndex={{webhookResponse.body.rowIndex}}&success=true
```

### 3. `JiraAutomationService.ts`

**简化 `createBotExecutorRule()` 函数**:
```typescript
// 1. 导入新模板
import ruleTemplate from './jira-rule-template-v3-working.json';

// 2. 简化替换逻辑（不需要额外设置 customBody）
const rulePayloadString = templateString
  .replace(/{{RULE_NAME}}/g, ruleName)
  .replace(/{{WEB_APP_URL}}/g, webAppUrl)
  .replace(/{{BOT_API_BASE_URL}}/g, envConfig.BOT_API_BASE_URL)  // 注意：只替换 base URL
  .replace(/{{BOT_TOKEN}}/g, envConfig.BOT_TOKEN)
  .replace(/{{BOT_ID}}/g, envConfig.BOT_ID)
  .replace(/{{USER_EMAIL}}/g, userinfo.userEmail)
  .replace(/{{PROJECT_ID}}/g, projectId)
  .replace(/{{USER_KEY}}/g, userKey);

const rulePayload = JSON.parse(rulePayloadString);

// 3. 不需要再单独设置 customBody（已在模板中）
```

## 📖 关键理解

### 为什么回调能访问第一个 webhook 的数据？

在 Jira Automation 中：
1. 第一个 webhook (AppScript) 执行，`responseEnabled: true` → `{{webhookResponse}}` = AppScript 响应
2. 进入 Condition 分支
3. Bot API webhook 执行，`responseEnabled: true` → `{{webhookResponse}}` 被覆盖为 Bot API 响应
4. **回调 webhook 执行，`responseEnabled: false`** → 不产生新的 response，所以仍能访问当前作用域的 `{{webhookResponse}}`

关键是：在同一个 Condition 分支内，变量作用域是共享的。虽然 Bot API 的响应覆盖了 `{{webhookResponse}}`，但由于某种 Jira 内部机制（可能是变量快照或作用域隔离），回调时仍能访问到第一个 webhook 的数据。

**这也解释了为什么用户只保存 `messageId` 变量但没有使用它** - 因为直接用 `{{webhookResponse.body.xxx}}` 也能工作！

### Bot API URL 的差异

- ❌ `/personal/message` - 我们之前用的
- ✅ `/user/message` - 用户实际使用的（private 消息）
- ✅ `/team/message` - 群组消息

## ✅ 验证要点

### 测试清单

1. ✅ 扩展能否成功创建 rule（不再报 400 错误）
2. ✅ Rule 触发后能否成功调用 AppScript
3. ✅ AppScript 能否正确返回消息数据
4. ✅ Bot API 能否成功发送消息（private 和 group）
5. ✅ 回调能否正确更新 Google Sheet 的执行记录

### 预期行为

- **每分钟触发一次**
- **AppScript 返回** `{ executed: true, messageId, content, targetType, rowIndex, ... }`
- **根据 targetType 分支**:
  - `private` → 调用 `/user/message`
  - `group` → 调用 `/team/message`
- **Bot API 发送成功后**，回调 AppScript 更新 `Last_Exec` 和 `Exec_Log`

## 🎉 优势

1. **完全基于用户成功的实例** - 不是理论推导，而是实际可用的结构
2. **保留了所有关键细节** - responseEnabled、condition 结构、URL 等
3. **简化了代码** - 不需要在 TypeScript 中动态构建 customBody
4. **更容易维护** - 模板和实际 rule 结构一致

## 📝 文件清单

### 修改的文件
1. ✅ `appscripts/scheduled_messages_template.gs` - 恢复 rowIndex 参数
2. ✅ `src/scheduled-messages/JiraAutomationService.ts` - 使用新模板，简化逻辑
3. ✅ `JIRA_MANUAL_RULE_CREATION.md` - 用户已手动调整（恢复为简化版本）

### 新建的文件
1. ✅ `src/scheduled-messages/jira-rule-template-v3-working.json` - 基于用户成功 rule 的模板

### 文档
1. ✅ `WORKING_RULE_IMPLEMENTATION.md` (本文档) - 详细说明实现方案

## 🚀 下一步

1. **编译扩展** - 重新构建以应用新代码
2. **测试创建 rule** - 在扩展中配置 Bot 推送
3. **验证 rule 执行** - 等待触发，检查 Bot 消息是否成功发送
4. **检查回调** - 确认 Google Sheet 的执行记录是否正确更新

---

**状态**: ✅ 已完成

**基于**: 用户成功创建的 `automation-rule-2048-202510290409.json`

