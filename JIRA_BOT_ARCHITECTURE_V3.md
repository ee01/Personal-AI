# Jira Bot 推送架构 v3 - 最终版本

## 🎯 核心问题

**问题**：AppScript 在外网，无法直接调用内网 Bot API

**错误**：使用 v2 架构时，Jira Automation 创建规则报错：
```json
{
  "errors": {
    "component:null": {
      "GLOBALERROR.com.codebarrel.automation.component.unknown.not.installed": ""
    }
  },
  "status": 400
}
```

## ✅ 解决方案 v3

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                  Jira Automation Rule                        │
│                   (每分钟触发)                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─ Step 1: 获取消息数据
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              AppScript Web App (外网)                         │
│   GET: ?action=getBotMessageCurrentTime                      │
│                                                               │
│   返回: { executed: true, content: "消息内容", ... }         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─ Condition: executed == true
                            │
                            ├─ Step 2: 调用 Bot API
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Bot API (内网)                                   │
│   POST: /personal/message                                     │
│   Body: { email, message: "{{webhookResponse}}" }            │
└─────────────────────────────────────────────────────────────┘
```

### 关键点

1. **职责分离**
   - AppScript：只负责数据管理（筛选消息、优先级排序、更新日志）
   - Jira Automation：负责执行（调用内网 Bot API）

2. **两步式设计**
   - Step 1：Webhook 调用 AppScript 获取消息数据
   - Step 2：Condition 判断 + Webhook 调用 Bot API（在内网执行）

3. **无需用户输入 Bot Token**
   - 自动从 `chrome.storage` 读取 `envConfig`
   - 与现有 Bot 功能完全复用配置

## 📝 实现细节

### 1. AppScript 新增 API

```javascript
// GET: ?action=getBotMessageCurrentTime
function getBotMessageDataCurrentTime() {
  const message = getBotMessageCurrentTime(); // 按优先级选择单条消息
  
  if (!message) {
    return {
      executed: false,
      message: '当前时间点没有需要执行的 Bot 消息'
    };
  }
  
  // 只返回数据，不调用 Bot API
  return {
    executed: true,
    messageId: message.ID,
    topic: message.Topic,
    content: message.Content,  // ← Bot API 需要的消息内容
    targetType: message.Target_Type,
    userName: message.Glip_User_Name,
    groupId: message.Glip_Team_ID,
    rowIndex: message.rowIndex
  };
}
```

### 2. Jira Rule 结构

```json
{
  "trigger": {
    "type": "jira.scheduled.trigger",
    "value": { "scheduleConfig": { "expression": "0 * * * * ?" } }
  },
  "components": [
    {
      "type": "jira.issue.outgoing.webhook",
      "value": {
        "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime",
        "responseEnabled": true
      },
      "children": [
        {
          "component": "CONDITION",
          "type": "jira.comparator.condition",
          "value": {
            "first": "{{webhookResponse.body.executed}}",
            "second": "true",
            "operator": "EQUALS"
          },
          "children": [
            {
              "type": "jira.issue.outgoing.webhook",
              "value": {
                "url": "{{BOT_API_URL}}",
                "headers": [
                  { "name": "Authorization", "value": "Bearer {{BOT_TOKEN}}" },
                  { "name": "bot", "value": "{{BOT_ID}}" }
                ],
                "customBody": "{{BOT_PAYLOAD}}"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### 3. JiraAutomationService 自动读取配置

```typescript
async createBotExecutorRule(config: JiraAutomationConfig, webAppUrl: string) {
  // 自动读取 Bot 配置
  const envConfig = await getEnvConfig();
  const { userinfo } = await chrome.storage.local.get('userinfo');
  
  const botApiUrl = `${envConfig.BOT_API_BASE_URL}/personal/message`;
  
  // 构建 Bot payload（使用 Jira smart values）
  const botPayload = {
    mention: false,
    email: userinfo.userEmail,
    emailAutoCorrect: true,
    message: "{{webhookResponse.body.content}}" // ← Jira 运行时替换
  };
  
  // 填充模板
  const rulePayload = ruleTemplate
    .replace(/{{BOT_API_URL}}/g, botApiUrl)
    .replace(/{{BOT_TOKEN}}/g, envConfig.BOT_TOKEN)
    .replace(/{{BOT_ID}}/g, envConfig.BOT_ID)
    .replace(/{{BOT_PAYLOAD}}/g, JSON.stringify(botPayload));
  
  // 创建规则...
}
```

### 4. 用户界面简化

**移除**：
- ❌ Bot Token 输入框

**保留**：
- ✅ Jira URL 输入框
- ✅ Project Key 输入框

**说明**：
```
Bot 配置将自动从扩展设置中读取
```

## 🔄 执行流程

### 正常流程（有消息）

```
1. Jira Trigger (每分钟)
   ↓
2. Webhook → AppScript
   GET: ?action=getBotMessageCurrentTime
   ← Response: { executed: true, content: "测试消息" }
   ↓
3. Condition Check
   executed == true? → YES
   ↓
4. Webhook → Bot API (内网)
   POST: /personal/message
   Body: { email: "...", message: "测试消息" }
   ← Response: 200 OK
   ↓
5. 完成 ✅
```

### 无消息流程

```
1. Jira Trigger (每分钟)
   ↓
2. Webhook → AppScript
   GET: ?action=getBotMessageCurrentTime
   ← Response: { executed: false, message: "当前时间点没有需要执行的 Bot 消息" }
   ↓
3. Condition Check
   executed == true? → NO
   ↓
4. 跳过 Bot API 调用
   ↓
5. 完成 ✅
```

## 📊 与之前版本对比

| 特性 | v1 (Groovy) | v2 (AppScript 调用 Bot) | v3 (Jira 调用 Bot) |
|------|-------------|------------------------|-------------------|
| Groovy 依赖 | ❌ 需要 | ✅ 不需要 | ✅ 不需要 |
| 内网访问 | ✅ 支持 | ❌ 不支持 | ✅ 支持 |
| 逻辑维护 | ❌ 分散两处 | ✅ 集中 AppScript | ✅ 集中 AppScript |
| 用户配置 | ❌ 复杂 | ❌ 需要 Bot Token | ✅ 自动读取 |
| 调试难度 | ❌ 困难 | ✅ 容易 | ✅ 容易 |
| 可靠性 | ⚠️ 组件依赖 | ❌ 外网限制 | ✅ 完全可靠 |

## 🧪 测试步骤

### 1. 准备环境

```bash
# 编译扩展
npm run build

# 确保已有 Bot 配置
# 打开扩展 → 设置 → 检查 BOT_API_BASE_URL, BOT_TOKEN, BOT_ID
```

### 2. 创建 Rule

```bash
# 方式 1：使用扩展 UI
在扩展中点击 "配置 Bot 推送"
输入 Jira URL 和 Project Key
点击"创建规则"

# 方式 2：使用测试脚本
vi test-rule-payload-v3.json  # 填写必要信息
./test-create-rule.sh  # 使用 v3 payload
```

### 3. 验证功能

**添加测试消息到 Google Sheet**:
```
ID: TEST_BOT_001
Topic: 测试 Bot 推送 v3
Content: 这是 v3 架构的测试消息
Schedule_Date: 2025-10-29
Schedule_Time: 14:30  (当前时间 + 2 分钟)
Push_Method: Bot
Status: Active
```

**查看 Jira Automation 日志**:
1. 打开 Jira → Automation
2. 找到 `[Personal AI] Scheduled Messages Bot Executor`
3. 查看 Audit Log
4. 确认每分钟都有执行记录

**查看 AppScript 日志**:
1. 打开 Apps Script 编辑器
2. 执行 → 执行情况
3. 查看日志输出：
   ```
   [Bot 单条消息] 当前时间: 2025-10-29 14:30
   [优先级 1] 当前分钟消息: TEST_BOT_001
   返回待发送 Bot 消息数据: TEST_BOT_001 - 测试 Bot 推送 v3
   ```

**查看消息推送**:
- 打开 Glip/RingCentral
- 查收 Bot 发送的消息

## 🔍 调试技巧

### 1. 检查 AppScript 返回数据

```bash
curl "YOUR_WEB_APP_URL?action=getBotMessageCurrentTime"
```

期望返回：
```json
{
  "executed": true,
  "messageId": "TEST_BOT_001",
  "content": "这是 v3 架构的测试消息",
  "targetType": "private",
  "userName": "Esone Qiu",
  "rowIndex": 2
}
```

### 2. 检查 Jira Smart Values

在 Jira Rule 中添加 Log Action：
```
Message: {{webhookResponse.body.content}}
Executed: {{webhookResponse.body.executed}}
```

### 3. 检查 Bot API 调用

在 Jira Audit Log 中查看 Webhook 调用详情：
- URL: 是否正确
- Headers: Authorization, bot 是否正确
- Body: message 字段是否包含消息内容

## 📁 修改文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `appscripts/scheduled_messages_template.gs` | ✅ 修改 | 移除 sendBotMessage，只返回数据 |
| `src/scheduled-messages/jira-rule-template-v3.json` | ✅ 新建 | 两步式 Rule 模板 |
| `src/scheduled-messages/JiraAutomationService.ts` | ✅ 修改 | 自动读取 Bot 配置 |
| `src/scheduled-messages/ScheduledMessagesManager.tsx` | ✅ 修改 | 移除 Bot Token 输入 |
| `test-rule-payload-v3.json` | ✅ 新建 | 测试 payload |

## ✅ 优势总结

1. **完全兼容内网环境**
   - Jira Automation 在内网执行
   - 可以正常调用内网 Bot API

2. **无需额外配置**
   - 复用现有 Bot 配置
   - 用户体验更好

3. **职责清晰**
   - AppScript：数据管理
   - Jira：执行调度

4. **易于调试**
   - 可以单独测试 AppScript API
   - 可以查看 Jira 执行日志
   - 可以查看 Bot API 日志

5. **可靠性高**
   - 不依赖特殊 Jira 组件
   - 只使用标准 Webhook 功能

## 🚀 Ready to Deploy!

所有代码已实现并编译通过，可以开始测试了！

