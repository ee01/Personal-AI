# Jira Automation 变量覆盖问题修复

## 🐛 问题描述

用户发现在回调 AppScript 时，使用 `{{webhookResponse.body.messageId}}` 和 `{{webhookResponse.body.rowIndex}}` 无法获取到正确的值。

### 根本原因

在 Jira Automation 中，每次执行 `Send web request` 都会覆盖 `{{webhookResponse}}` 变量。

**执行流程：**
```
1. Webhook: 调用 AppScript
   → {{webhookResponse}} = AppScript 的返回数据
   
2. Webhook: 调用 Bot API
   → {{webhookResponse}} = Bot API 的返回数据 ❌ (覆盖了！)
   
3. Webhook: 回调 AppScript
   → 尝试使用 {{webhookResponse.body.messageId}}
   → 但此时 {{webhookResponse}} 是 Bot API 的返回，没有 messageId！
```

## ✅ 解决方案

在第一个 webhook 后立即创建变量保存关键数据。

### 修复步骤

1. **在 Step 3 (调用 AppScript) 之后**，添加 4 个变量：
   ```
   变量 1: messageId = {{webhookResponse.body.messageId}} （唯一标识符）
   变量 2: messageContent = {{webhookResponse.body.content}}
   变量 3: teamId = {{webhookResponse.body.teamId}}
   变量 4: teamName = {{webhookResponse.body.teamName}}
   ```

2. **在所有后续步骤中**，使用这些变量而不是 `{{webhookResponse}}`：
   - Private 消息 customBody:
     ```json
     {
       "mention": false,
       "email": "your.email@ringcentral.com",
       "emailAutoCorrect": true,
       "message": {{messageContent.asJsonString}}
     }
     ```
   - Group 消息 customBody:
     ```json
     {
       "mentionList": [],
       "isTeamMention": false,
       "teamName": {{teamName.asJsonString}},
       "teamId": {{teamId.asJsonString}},
       "message": {{messageContent.asJsonString}},
       "skipMentionCheck": true
     }
     ```
   - 回调 URL（只需 messageId）:
     ```
     YOUR_WEB_APP_URL?action=markBotMessageExecuted&messageId={{messageId}}&success=true
     ```
     
**💡 为什么不需要 rowIndex？**

- `messageId` 是唯一标识符，AppScript 会通过它查找对应的行
- 行号可能会变化（插入/删除行），使用 ID 更可靠

## 📝 修改的文件

### 1. `JIRA_MANUAL_RULE_CREATION.md`

**添加：**
- Step 3.5: 保存变量（4 个 Create variable actions）

**修改：**
- Private 消息 customBody: 使用 `{{messageContent.asJsonString}}`
- Group 消息 customBody: 使用 `{{teamName.asJsonString}}`, `{{teamId.asJsonString}}`, `{{messageContent.asJsonString}}`
- 回调 URL: 只使用 `{{messageId}}`（不需要 rowIndex）
- 流程图: 添加变量保存步骤
- 预期结构: 添加 4 个 Create variable actions
- 注意事项: 强调必须保存变量，解释为什么只需 messageId

### 2. `CALLBACK_APPSCRIPT_SUMMARY.md`

**添加：**
- 完整流程中的 "2.5 保存变量" 步骤
- 解释为什么必须保存变量

## 🎯 最终 Rule 结构

```
Trigger: Scheduled (每分钟)
└─ Action: Send web request (调用 AppScript)
   ├─ Action: Create variable (messageId - 唯一标识符)
   ├─ Action: Create variable (messageContent)
   ├─ Action: Create variable (teamId)
   ├─ Action: Create variable (teamName)
   └─ Condition: executed == true
      ├─ Condition: targetType == "private"
      │  ├─ Action: Send web request (POST /personal/message，使用 {{messageContent}})
      │  └─ Action: Send web request (回调，使用 {{messageId}})
      │
      └─ Condition: targetType == "group"
         ├─ Action: Send web request (POST /team/message，使用 {{messageContent}} {{teamId}} {{teamName}})
         └─ Action: Send web request (回调，使用 {{messageId}})
```

## ⚠️ 关键要点

1. **必须在第一个 webhook 后立即保存变量**
2. **后续所有步骤使用变量，不要使用 `{{webhookResponse}}`**
3. **变量名要清晰，避免与 Jira 内置变量冲突**
4. **使用 `.asJsonString` 进行 JSON 转换**

## 🧪 验证

创建 Rule 后，可以通过 Jira Automation 的 Audit Log 查看：
- 变量是否正确保存
- 回调 URL 中的参数是否正确填充

---

**状态**: ✅ 已修复并更新文档

**影响**: 
- 用户需要在手动创建 Rule 时，先保存 5 个变量
- 确保回调能正确更新 Google Sheet 执行记录

