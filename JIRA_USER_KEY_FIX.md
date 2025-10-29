# Jira User Key 修复

## 问题描述

在创建 Jira Automation 规则时，遇到验证错误：

```json
{
  "RULE": {
    "author": "Please specify a valid user as the owner for this rule.",
    "actor": "Please specify a valid user that will execute this rule."
  }
}
```

错误原因是 `authorAccountId` 和 `actorAccountId` 字段为空字符串，Jira 要求必须指定有效的用户标识。

## 根本原因

在 `jira-rule-template.json` 中，`authorAccountId` 和 `actorAccountId` 被设置为空字符串：

```json
{
  "authorAccountId": "",
  "actorAccountId": ""
}
```

Jira Automation API 要求这两个字段必须是有效的用户标识（accountId 或 key）。

## 解决方案

### 1. 添加获取当前用户信息的方法

参考 `contentScriptJiraAutomation.ts` 的实现，在 `JiraAutomationService.ts` 中添加：

```typescript
/**
 * 获取当前用户的 account key
 */
private async getCurrentUserKey(config: JiraAutomationConfig): Promise<string> {
  const url = `${config.jiraUrl}/rest/api/2/myself`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`无法获取用户信息 (${response.status}): ${await response.text()}`);
  }
  
  const userInfo = await response.json();
  
  // Jira Cloud 使用 accountId，Jira Server/Data Center 使用 key
  const userKey = userInfo.accountId || userInfo.key;
  
  if (!userKey) {
    throw new Error('无法从用户信息中获取 accountId 或 key');
  }
  
  console.log('当前用户 Key:', userKey);
  return userKey;
}
```

### 2. 在创建规则时获取并使用用户 Key

在 `createBotExecutorRule` 方法中：

```typescript
async createBotExecutorRule(
  config: JiraAutomationConfig,
  webAppUrl: string,
  botToken: string
): Promise<BotExecutorRule> {
  // ...
  
  // 获取当前用户 Key
  console.log('正在获取当前用户信息...');
  const userKey = await this.getCurrentUserKey(config);
  console.log(`当前用户 Key: ${userKey}`);
  
  // 在模板中替换 USER_KEY
  const rulePayloadString = templateString
    .replace(/{{USER_KEY}}/g, userKey)
    // ...
  
  // ...
}
```

### 3. 更新 Rule 模板

在 `jira-rule-template.json` 中使用占位符：

```json
{
  "name": "{{RULE_NAME}}",
  "state": "ENABLED",
  "canOtherRuleTrigger": false,
  "notifyOnError": "FIRSTERROR",
  "authorAccountId": "{{USER_KEY}}",
  "actorAccountId": "{{USER_KEY}}",
  "trigger": {
    // ...
  }
}
```

## Jira 用户标识类型

### Jira Cloud
- 使用 `accountId`（如：`"5d123abc456def789"`）
- 格式：UUID 字符串

### Jira Server/Data Center
- 使用 `key`（如：`"esone.qiu"`）
- 格式：用户名格式

### 获取用户信息的 API

**端点**：
```
GET /rest/api/2/myself
```

**响应示例（Jira Server）**：
```json
{
  "self": "https://jira.ringcentral.com/rest/api/2/user?username=esone.qiu",
  "key": "esone.qiu",
  "name": "esone.qiu",
  "emailAddress": "esone.qiu@ringcentral.com",
  "displayName": "Esone Qiu",
  "active": true
}
```

**响应示例（Jira Cloud）**：
```json
{
  "self": "https://your-domain.atlassian.net/rest/api/2/user?accountId=5d123abc456def789",
  "accountId": "5d123abc456def789",
  "emailAddress": "user@example.com",
  "displayName": "User Name",
  "active": true
}
```

## 实现细节

### 兼容性处理

代码同时支持 Jira Cloud 和 Jira Server/Data Center：

```typescript
// Jira Cloud 使用 accountId，Jira Server/Data Center 使用 key
const userKey = userInfo.accountId || userInfo.key;
```

### 错误处理

如果无法获取用户信息，会抛出清晰的错误：

```typescript
if (!userKey) {
  throw new Error('无法从用户信息中获取 accountId 或 key');
}
```

### 日志输出

在创建规则时会输出详细的日志：

```
正在获取当前用户信息...
当前用户 Key: esone.qiu
正在获取项目 ID...
项目 MTR 的 ID: 16552
创建 Jira Automation 规则: [Personal AI] Scheduled Messages Bot Executor
用户 Key: esone.qiu
项目 ID: 16552
```

## 使用流程

1. **重新构建扩展**：
   ```bash
   npm run build
   ```

2. **重新加载扩展**：
   - 打开 Chrome 扩展管理页面
   - 点击"重新加载"

3. **配置 Bot 推送**：
   - 打开定时消息管理页面
   - 点击"配置 Bot 推送"
   - 系统会自动：
     1. 检查 Jira 登录状态
     2. 获取当前用户信息
     3. 获取项目 ID
     4. 创建 Automation 规则

4. **验证规则**：
   - 在 Jira 项目设置中查看 Automation 规则
   - 检查规则的 Owner 是否为当前用户

## 对比 contentScriptJiraAutomation.ts

### 相似之处

1. **使用相同的 API 端点**：
   - `/rest/api/2/myself`

2. **兼容性处理**：
   - 同时支持 `accountId` 和 `key`

3. **错误处理**：
   - 完善的异常捕获和错误提示

### 差异

| 功能 | contentScriptJiraAutomation.ts | JiraAutomationService.ts |
|------|-------------------------------|--------------------------|
| 存储位置 | localStorage | 不存储（每次创建时获取） |
| 获取方式 | 1. localStorage<br>2. 页面元素<br>3. API | 直接 API |
| 使用场景 | 在 Jira 页面中导入规则 | 在扩展中创建规则 |
| Cookie 认证 | 隐式（页面上下文） | 显式（`credentials: 'include'`） |

## 测试步骤

1. **测试获取用户信息**：
   - 打开浏览器控制台
   - 查看 "正在获取当前用户信息..." 日志
   - 确认 "当前用户 Key: xxx" 输出

2. **测试创建规则**：
   - 配置 Bot 推送
   - 观察控制台输出的 Rule Payload
   - 确认 `authorAccountId` 和 `actorAccountId` 已填充

3. **验证规则**：
   - 在 Jira 中查看创建的规则
   - 检查规则的所有者（Owner）

## 相关文件

- ✅ `src/scheduled-messages/JiraAutomationService.ts` - 添加 getCurrentUserKey 方法
- ✅ `src/scheduled-messages/jira-rule-template.json` - 使用 USER_KEY 占位符
- 📖 `src/contentScriptJiraAutomation.ts` - 参考实现

## 参考资料

- [Jira REST API - Get current user](https://docs.atlassian.com/software/jira/docs/api/REST/latest/#api/2/myself)
- [Jira Automation REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/)
- [Jira User Account ID vs Key](https://community.atlassian.com/t5/Jira-questions/What-is-the-difference-between-accountId-and-key/qaq-p/1234567)

