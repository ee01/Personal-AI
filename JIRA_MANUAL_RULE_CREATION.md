# Jira Automation Rule 手动创建教程

## 📋 目标

创建一个 Jira Automation Rule，实现以下流程：

```
每分钟触发
  ↓
Step 1: 调用 AppScript 获取消息数据
  ↓
Condition: 有消息吗？(executed == true)
  ↓
Condition: 消息类型？(targetType == "private" 或 "group")
  ↓
Step 2a: 如果是 private
  ├─ 调用 /personal/message（发送消息）
  └─ 回调 AppScript 标记成功
  
Step 2b: 如果是 group
  ├─ 调用 /team/message（发送消息）
  └─ 回调 AppScript 标记成功
```

## 🚀 创建步骤

### Step 1: 进入 Jira Automation

1. 打开 Jira: https://jira.ringcentral.com
2. 点击右上角 ⚙️ → **Automation**
3. 点击 **Create rule**

### Step 2: 设置 Trigger（触发器）

1. 选择 **Scheduled**
2. 配置：
   - **Interval**: Custom
   - **Cron expression**: `0 * * * * ?` （每分钟执行一次）
3. 点击 **Save**

### Step 3: 添加 Action - 调用 AppScript

1. 点击 **+ New Action** → **Send web request**
2. 配置：
   - **Web request URL**: `YOUR_WEB_APP_URL?action=getBotMessageCurrentTime`
     - 替换 `YOUR_WEB_APP_URL` 为您的 AppScript Web App URL
   - **HTTP method**: `GET`
   - **Headers**: (留空)
   - **Webhook body**: (留空)
   - **Issue data to send**: `None`
   - ✅ **Ignore errors**: 不勾选
   - ✅ **Delay execution**: 不勾选
3. 点击 **Save**

### Step 3.5: 保存变量（重要！）

由于后续 webhook 会覆盖 `{{webhookResponse}}`，需要先保存关键变量：

1. 点击 **+ New Action** → **Create variable**
2. 配置第一个变量：
   - **Variable name**: `messageId`
   - **Variable type**: **Smart value**
   - **Smart value**: `{{webhookResponse.body.messageId}}`
3. 点击 **Save**

### Step 4: 添加 Condition - 检查是否有消息

1. 在刚才的 Action 下，点击 **+ Add component** → **Condition**
2. 选择 **Advanced compare condition**
3. 配置：
   - **First value**: `{{webhookResponse.body.executed}}`
   - **Condition**: `equals`
   - **Second value**: `true`
4. 点击 **Save**

### Step 5: 添加 Branch - 判断消息类型

在 Condition 内部（True 分支）：

#### Branch 1: Private 消息

1. 点击 **+ Add component** → **Condition**
2. 选择 **Advanced compare condition**
3. 配置：
   - **First value**: `{{webhookResponse.body.targetType}}`
   - **Condition**: `equals`
   - **Second value**: `private`
4. 点击 **Save**

5. 在这个 Condition 内部，点击 **+ New Action** → **Send web request**
6. 配置：
   - **Web request URL**: `YOUR_BOT_API_BASE_URL/personal/message`
     - 替换为您的内网 Bot API 地址
   - **HTTP method**: `POST`
   - **Headers**: 添加 4 个
     1. Name: `accept`, Value: `*/*`
     2. Name: `Content-Type`, Value: `application/json`
     3. Name: `Authorization`, Value: `Bearer YOUR_BOT_TOKEN`
     4. Name: `bot`, Value: `YOUR_BOT_ID`
   - **Webhook body**: 选择 **Custom data**
   - **Custom data**:
     ```json
     {
       "mention": false,
       "email": "your.email@ringcentral.com",
       "emailAutoCorrect": true,
       "message": {{webhookResponse.body.content.asJsonString}}
     }
     ```
     注意：`{{webhookResponse.body.content.asJsonString}}` 是 Jira smart value
   - **Issue data to send**: `None`
7. 点击 **Save**

8. **重要**：在刚才的 Send web request 后面，点击 **+ New Action** → **Send web request**（回调 AppScript 更新状态）
9. 配置：
   - **Web request URL**: `YOUR_WEB_APP_URL?action=markBotMessageExecuted&messageId={{messageId}}&rowIndex={{webhookResponse.body.rowIndex}}&success=true`
   - **HTTP method**: `GET`
   - **Headers**: (留空)
   - **Issue data to send**: `None`
10. 点击 **Save**

#### Branch 2: Team/Group 消息

1. 回到 "检查是否有消息" 的 Condition 层级
2. 点击 **+ Add component** → **Condition**（与 Branch 1 平级）
3. 选择 **Advanced compare condition**
4. 配置：
   - **First value**: `{{webhookResponse.body.targetType}}`
   - **Condition**: `equals`
   - **Second value**: `group`
5. 点击 **Save**

6. 在这个 Condition 内部，点击 **+ New Action** → **Send web request**
7. 配置：
   - **Web request URL**: `YOUR_BOT_API_BASE_URL/team/message`
   - **HTTP method**: `POST`
   - **Headers**: 添加 4 个（同上）
     1. Name: `accept`, Value: `*/*`
     2. Name: `Content-Type`, Value: `application/json`
     3. Name: `Authorization`, Value: `Bearer YOUR_BOT_TOKEN`
     4. Name: `bot`, Value: `YOUR_BOT_ID`
   - **Webhook body**: 选择 **Custom data**
   - **Custom data**:
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
8. 点击 **Save**

9. **重要**：在刚才的 Send web request 后面，点击 **+ New Action** → **Send web request**（回调 AppScript 更新状态）
10. 配置：
   - **Web request URL**: `YOUR_WEB_APP_URL?action=markBotMessageExecuted&messageId={{messageId}}&rowIndex={{webhookResponse.body.rowIndex}}&success=true`
   - **HTTP method**: `GET`
   - **Headers**: (留空)
   - **Issue data to send**: `None`
11. 点击 **Save**

### Step 6: 配置 Rule 基本信息

1. 点击右上角的 **···** → **Rule details**
2. 配置：
   - **Name**: `[Personal AI] Scheduled Messages Bot Executor`
   - **Description**: （可选）自动推送定时消息
   - **Projects**: 选择您的项目（如 MTR）
3. 点击 **Save**

### Step 7: 启用 Rule

1. 确保 Rule 状态为 **Enabled**（绿色开关）
2. 点击 **Turn it on**

### Step 8: 导出 Rule JSON

1. 在 Rule 页面，点击右上角的 **···**
2. 选择 **View rule in JSON**
3. 点击 **Copy**
4. 保存到文件（如 `my-jira-rule.json`）
5. 将文件发送给我

## 📝 需要替换的值

在创建过程中，请替换以下占位符：

| 占位符 | 实际值 | 在哪里获取 |
|--------|--------|-----------|
| `YOUR_WEB_APP_URL` | AppScript Web App URL | Google Apps Script 部署页面 |
| `YOUR_BOT_API_BASE_URL` | Bot API 地址 | 扩展设置 → BOT_API_BASE_URL |
| `YOUR_BOT_TOKEN` | Bot Token | 扩展设置 → BOT_TOKEN |
| `YOUR_BOT_ID` | Bot ID | 扩展设置 → BOT_ID |
| `your.email@ringcentral.com` | 您的邮箱 | 您的 RingCentral 邮箱 |

## 🎯 预期结构

最终的 Rule 应该是这样的层级结构：

```
Trigger: Scheduled (每分钟)
└─ Action: Send web request (调用 AppScript 获取消息)
   └─ Condition: executed == true
      ├─ Condition: targetType == "private"
      │  ├─ Action: Send web request (POST /personal/message)
      │  └─ Action: Send web request (回调 AppScript 标记成功)
      │
      └─ Condition: targetType == "group"
         ├─ Action: Send web request (POST /team/message)
         └─ Action: Send web request (回调 AppScript 标记成功)
```

**关键点**：
- 每个 Bot API 调用后，都需要回调 AppScript
- 回调用于更新 Google Sheet 中的执行记录（Last_Exec、Exec_Log）
- 这样才能正确标记消息已处理，避免重复发送

## 🧪 测试

创建完成后：

1. 在 Google Sheet 中添加测试消息
2. 等待 1-2 分钟
3. 查看 Jira Automation Audit Log
4. 查看 Glip/RingCentral 消息

## 📤 导出 JSON

完成后，请将导出的 JSON 发送给我，格式应该类似：

```json
{
  "name": "[Personal AI] Scheduled Messages Bot Executor",
  "state": "ENABLED",
  "trigger": { ... },
  "components": [ ... ],
  "projects": [ ... ]
}
```

## ⚠️ 注意事项

1. **Smart Values**: `{{webhookResponse.body.xxx}}` 是 Jira 的 smart value 语法，运行时会被替换
2. **asJsonString**: 用于将字符串转为 JSON 格式（自动添加引号）
3. **Headers**: 必须正确填写 Authorization 和 bot
4. **Custom Data**: JSON 格式必须正确，但可以包含 smart values
5. **回调 AppScript**: 每个 Bot API 调用后必须回调，否则：
   - Google Sheet 不会更新执行记录
   - 消息会被重复发送（因为看不到 Last_Exec）
   - 无法统计执行次数和状态

---

创建完成后，请将导出的 JSON 文件发给我，我会根据您的实际配置来更新代码！🚀

