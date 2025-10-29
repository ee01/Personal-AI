# Bot 推送功能实施总结

## 功能概述

成功实现了定时消息的 **Bot 推送方式**，通过 Jira Automation 作为执行引擎，解决了 Google AppScript 无法访问内网 Bot API 的限制。

## 核心架构

```
用户创建 Bot 消息
    ↓
Chrome Extension 管理界面
    ↓
Google Sheets（统一数据源）
    ↓
Google Apps Script Web App
    ↓ (每分钟轮询)
Jira Automation Scheduled Rule
    ↓
内网 Bot API
    ↓
RingCentral Glip/Message Queue
```

## 已实现的功能

### 1. AppScript 改进 ✅

**文件**: `appscripts/scheduled_messages_template.gs`

#### 改进的 `getMessagesToExecute()` 函数

- **新增 `timeScope` 参数**：支持 `'minute'`（精确到分钟）和 `'day'`（当天所有）
- **优化过滤逻辑**：在 AppScript 端完成所有时间判断，Jira Automation 直接执行
- **自动判断消息类型**：无需在 Sheet 中存储 Type 字段
- **返回详细信息**：包含 messageType, scheduleDate, scheduleTime 等字段

```javascript
// 调用示例
// 获取当前时间点需要执行的消息（默认）
${webAppUrl}?action=getActiveBotMessages&timeScope=minute

// 获取今天所有需要执行的消息
${webAppUrl}?action=getActiveBotMessages&timeScope=day
```

#### 新增 `shouldExecuteToday()` 函数

- 用于判断消息是否应该在今天执行（不考虑具体时间）
- 支持 Daily、Hourly、Periodic 三种类型

### 2. Jira Automation 服务类 ✅

**文件**: `src/scheduled-messages/JiraAutomationService.ts`

#### 核心方法

1. **`testAccess()`**: 测试 Jira Automation API 访问权限
   - 使用 `credentials: 'include'` 利用浏览器 cookies 认证
   - 无需 PAT (Personal Access Token)

2. **`createBotExecutorRule()`**: 创建统一的 Bot 执行器规则
   - **Trigger**: Cron 表达式 `0 * * * * ?`（每分钟执行）
   - **Action 1**: Web Request 调用 AppScript Web App
   - **Action 2**: Groovy Script 解析响应并调用 Bot API

3. **`generateGroovyScript()`**: 生成 Groovy 脚本
   - 解析 Web App 返回的 JSON
   - 遍历消息列表并调用 Bot API
   - 支持 groupId 和 userName 两种推送目标

#### Jira Automation 规则结构

```javascript
{
  name: "[Personal AI] Scheduled Messages Bot Executor",
  state: "ENABLED",
  trigger: {
    type: "jira.scheduled.trigger",
    value: {
      scheduleConfig: {
        expression: "0 * * * * ?"  // 每分钟
      }
    }
  },
  components: [
    {
      type: "web_request",
      value: {
        webhookUrl: "${webAppUrl}?action=getActiveBotMessages&timeScope=minute",
        method: "GET"
      }
    },
    {
      type: "groovy_script",
      value: {
        script: "/* Bot API 调用代码 */"
      }
    }
  ]
}
```

### 3. UI 集成 ✅

**文件**: `src/scheduled-messages/ScheduledMessagesManager.tsx`

#### 新增状态管理

- `botConfigured`: 是否已配置 Bot 推送
- `showBotConfigDialog`: 是否显示 Bot 配置对话框

#### Bot 配置提示

在用户选择 Bot 推送方式时：
- 如果未配置：显示警告提示 + "🔧 配置 Bot 后启用" 按钮
- 如果已配置：正常启用所有输入字段

#### BotConfigDialog 组件

**三步配置流程**：

1. **Input 阶段**：
   - Jira URL（默认 `https://jira.ringcentral.com`）
   - Project Key（如 `MTR`，必须有管理权限）
   - Bot Token（用于调用 Bot API）

2. **Testing 阶段**：
   - 测试 Jira Automation API 访问权限
   - 验证项目访问权限

3. **Creating 阶段**：
   - 创建 Jira Automation 规则
   - 保存配置到 Chrome Storage

## 技术要点

### 1. 网络限制解决方案

- **问题**: AppScript 无法访问内网 Bot API
- **解决**: Jira Automation 作为中间层，能访问外网（AppScript）和内网（Bot API）

### 2. 认证机制

#### Chrome Extension → Jira API
- 使用 `credentials: 'include'` 
- 依赖浏览器已登录的 Jira cookies
- 无需额外的 PAT 或 OAuth

#### Jira Automation → Bot API
- 通过 Bot Token 认证（存储在 Chrome Storage）
- Header: `Authorization: Bearer ${botToken}`

### 3. 数据流优化

- **AppScript 端过滤**: 只返回当前时间点需要执行的消息
- **Jira 端执行**: 直接遍历列表，无需重复判断时间
- **执行日志更新**: 仅在 `timeScope=minute` 时更新，避免重复

### 4. 错误处理

- API 调用失败时显示详细错误信息
- 分步骤显示进度（Testing → Creating）
- 失败后可重试，不会留下残留数据

## 使用流程

### 首次配置

1. 用户打开"定时消息管理"
2. 点击"➕ 新增"按钮
3. 选择"🤖 Bot（机器人）"推送方式
4. 看到警告提示，点击"🔧 配置 Bot 后启用"
5. 填写：
   - Jira URL: `https://jira.ringcentral.com`
   - Project Key: `MTR`（或其他有权限的项目）
   - Bot Token: `your-bot-token`
6. 点击"✅ 开始配置"
7. 系统自动：
   - 测试 Jira 连接
   - 创建 Automation 规则
   - 保存配置
8. 配置成功后，可以正常创建 Bot 消息

### 创建 Bot 消息

1. 填写消息信息（主题、内容、时间等）
2. 选择"🤖 Bot（机器人）"推送方式
3. 选择推送目标：
   - **私发消息**: 输入用户名（如 `Esone Qiu`）
   - **群组消息**: 输入群组 ID
4. 填写 **Bot API 端点**（必填，内网地址）
5. 点击"✅ 创建消息"

### 执行流程

1. 每分钟，Jira Automation 规则自动触发
2. 调用 AppScript Web App: `${webAppUrl}?action=getActiveBotMessages&timeScope=minute`
3. AppScript 返回当前需要执行的 Bot 消息列表
4. Groovy Script 解析 JSON，遍历消息
5. 对每条消息调用对应的 Bot API 端点
6. AppScript 更新 Sheet 中的执行日志

## 与 AsMe 推送的对比

| 特性 | AsMe 推送 | Bot 推送 |
|------|-----------|----------|
| **执行引擎** | AppScript Trigger | Jira Automation |
| **推送方式** | Email → Glip | Bot API |
| **显示身份** | 用户本人 | 机器人 |
| **网络限制** | 只能访问外网 | 可访问内网 |
| **适用场景** | 个人提醒、私密消息 | 通知、报告、系统消息 |
| **配置复杂度** | 无需额外配置 | 需配置 Jira Rule |

## 配置信息存储

### Chrome Storage

```javascript
{
  // Bot 执行器配置
  botExecutorConfig: {
    ruleId: "12345",
    ruleName: "[Personal AI] Scheduled Messages Bot Executor",
    webhookUrl: "https://script.google.com/...",
    projectKey: "MTR",
    jiraUrl: "https://jira.ringcentral.com",
    botToken: "your-bot-token",  // 注意：生产环境应加密
    createdAt: "2025-10-28T10:00:00.000Z"
  }
}
```

## 后续优化建议

### 1. 安全性

- [ ] Bot Token 加密存储
- [ ] 支持 Token 轮换
- [ ] 添加 Token 有效期检查

### 2. 功能增强

- [ ] 支持多个 Bot API 端点
- [ ] Bot 推送失败重试机制
- [ ] Bot 推送成功率统计
- [ ] 支持自定义 Groovy Script

### 3. 用户体验

- [ ] 可视化显示 Jira Automation 规则状态
- [ ] 支持编辑 Bot 配置
- [ ] 支持删除 Bot 配置（同时删除 Jira 规则）
- [ ] 测试 Bot API 连接功能

### 4. 监控告警

- [ ] Bot 推送失败告警
- [ ] Jira Automation 规则失效告警
- [ ] AppScript Web App 异常监控

## 测试建议

### 单元测试

1. **AppScript 函数**：
   ```javascript
   // 测试 getMessagesToExecute()
   // 测试 shouldExecuteToday()
   // 测试 determineMessageType()
   ```

2. **Jira Automation Service**：
   ```typescript
   // 测试 testAccess()
   // 测试 createBotExecutorRule()
   // 测试 generateGroovyScript()
   ```

### 集成测试

1. 创建测试消息（1分钟后执行）
2. 等待 Jira Automation 执行
3. 检查 Bot API 是否收到请求
4. 验证 Sheet 中执行日志是否更新

### 回归测试

1. AsMe 推送是否仍正常工作
2. Periodic 消息是否正常执行
3. 多条 Bot 消息同时执行是否正常

## 常见问题

### Q: 为什么不直接在 AppScript 中调用 Bot API？
A: AppScript 运行在 Google 服务器上，无法访问公司内网的 Bot API。

### Q: Jira Automation 可以运行多久？
A: Jira Automation 规则没有时间限制，可以 24/7 运行。但建议定期检查规则状态。

### Q: 如果 Jira Automation 失败了怎么办？
A: 
1. 检查 Jira Project 是否仍有访问权限
2. 检查 Bot Token 是否过期
3. 检查 Web App URL 是否可访问
4. 查看 Jira Automation 执行日志

### Q: Bot Token 存储在哪里？
A: 存储在 Chrome Extension 的 Local Storage 中。生产环境建议加密存储。

### Q: 可以创建多个 Bot 执行器规则吗？
A: 理论上可以，但推荐只创建一个统一的规则，避免重复执行。

## 相关文档

- [Google Apps Script 文档](https://developers.google.com/apps-script)
- [Jira Automation 文档](https://support.atlassian.com/cloud-automation/docs/jira-automation/)
- [Jira Automation REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [功能总览](./docs/features/scheduled_messages_manager.md)

## 总结

Bot 推送功能通过巧妙的架构设计，解决了网络限制问题，实现了：

✅ **统一管理**: 所有定时消息在一个 Sheet 中管理  
✅ **灵活推送**: 支持 AsMe 和 Bot 两种推送方式  
✅ **自动执行**: Jira Automation 24/7 可靠运行  
✅ **简单配置**: 用户只需填写 3 个字段即可完成配置  
✅ **无需维护**: 创建后无需手动干预  

这个方案充分利用了各个平台的优势，实现了一个强大而灵活的定时消息推送系统！🎉

