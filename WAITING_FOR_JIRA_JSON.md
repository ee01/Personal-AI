# 等待 Jira Rule JSON

## ✅ 已完成

1. ✅ 创建了详细的手动创建教程：`JIRA_MANUAL_RULE_CREATION.md`
2. ✅ 更新了 AppScript，支持返回 private 和 group 两种消息类型的数据
3. ✅ AppScript 返回字段：
   ```json
   {
     "executed": true,
     "messageId": "MSG001",
     "topic": "测试消息",
     "content": "消息内容",
     "targetType": "private",  // 或 "group"
     "userName": "Esone Qiu",  // for private
     "teamId": "54490570758",  // for group
     "teamName": "Team Name",  // for group
     "rowIndex": 2
   }
   ```

## 📋 下一步（等待您的操作）

请按照 `JIRA_MANUAL_RULE_CREATION.md` 中的教程手动创建 Jira Automation Rule，然后：

### 需要的配置值

在创建过程中，您需要准备这些值：

| 配置项 | 在哪里获取 | 示例 |
|--------|-----------|------|
| Web App URL | Google Apps Script 部署页面 | `https://script.google.com/...` |
| Bot API Base URL | 扩展设置 → BOT_API_BASE_URL | `https://heimdall-xmn02.int.rclabenv.com/api/bot` |
| Bot Token | 扩展设置 → BOT_TOKEN | `your_token_here` |
| Bot ID | 扩展设置 → BOT_ID | `your_bot_id` |
| Your Email | RingCentral 邮箱 | `esone.qiu@ringcentral.com` |

### API 端点

根据消息类型，需要配置两个不同的 webhook：

**Private 消息（发给个人）**:
- URL: `{BOT_API_BASE_URL}/personal/message`
- Method: `POST`
- Body:
  ```json
  {
    "mention": false,
    "email": "{YOUR_EMAIL}",
    "emailAutoCorrect": true,
    "message": {{webhookResponse.body.content.asJsonString}}
  }
  ```

**Group 消息（发给群组）**:
- URL: `{BOT_API_BASE_URL}/team/message`
- Method: `POST`
- Body:
  ```json
  {
    "mentionList": [],
    "isTeamMention": false,
    "teamName": {{webhookResponse.body.teamName.asJsonString}},
    "teamId": {{webhookResponse.body.teamId.asJsonString}},
    "message": {{webhookResponse.body.content.asJsonString}},
    "skipMentionCheck": true
  }
  ```

### Rule 结构

```
Trigger: Scheduled (0 * * * * ?)
└─ Action: Send web request → AppScript
   └─ Condition: {{webhookResponse.body.executed}} equals true
      ├─ Condition: {{webhookResponse.body.targetType}} equals "private"
      │  └─ Action: Send web request → /personal/message
      │
      └─ Condition: {{webhookResponse.body.targetType}} equals "group"
         └─ Action: Send web request → /team/message
```

## 📤 完成后

1. 在 Jira Automation 页面，找到您创建的 rule
2. 点击右上角 **···** → **View rule in JSON**
3. 复制全部 JSON
4. 保存为文件（如 `my-jira-rule.json`）
5. 将文件内容发给我

## 🔧 我接下来会做什么

收到您的 JSON 后，我会：

1. ✅ 分析您手动创建的 rule 结构
2. ✅ 提取正确的组件类型和配置
3. ✅ 更新 `jira-rule-template-v3.json`
4. ✅ 更新 `JiraAutomationService.ts` 来正确填充模板
5. ✅ 支持 private 和 group 两种消息类型
6. ✅ 测试并验证

---

现在请按照教程创建 rule，完成后将导出的 JSON 发给我！🚀

