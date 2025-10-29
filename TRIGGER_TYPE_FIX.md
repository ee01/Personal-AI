# Trigger Type 修复 - 基于 Import Rule 成功请求

## 🎯 问题发现

用户通过 `contentScriptJiraAutomation.ts` 的 Import Rule 功能成功导入了 rule，并提供了实际的 curl 请求数据。对比后发现 **trigger 类型和结构** 是导致之前创建失败的根本原因！

## 🔍 关键差异对比

### Trigger 类型

| | 之前的模板（错误） | 实际成功的请求 |
|---|---|---|
| **type** | `"jira.scheduled.trigger"` ❌ | `"jira.jql.scheduled"` ✅ |

### Trigger value 结构

**之前的模板（错误）**:
```json
{
  "value": {
    "scheduleConfig": {
      "expression": "0 * * * * ?"
    }
  }
}
```

**实际成功的请求**:
```json
{
  "value": {
    "schedule": {
      "cronExpression": "0 * * * * ?",
      "method": "CRON",
      "rate": 0,
      "rateInterval": 60
    },
    "jql": "project = MTR and ...",
    "executionMode": "nosearch",
    "onlyUpdatedIssues": false,
    "processIssuesInBulk": false
  }
}
```

## ✅ 修复内容

### 1. 更新模板 `jira-rule-template-v3-working.json`

```json
{
  "trigger": {
    "component": "TRIGGER",
    "schemaVersion": 1,
    "type": "jira.jql.scheduled",  // ✅ 修正
    "value": {
      "schedule": {                 // ✅ 修正
        "cronExpression": "0 * * * * ?",
        "method": "CRON",
        "rate": 0,
        "rateInterval": 60
      },
      "jql": "project = {{PROJECT_KEY}}",  // ✅ 添加
      "executionMode": "nosearch",         // ✅ 添加
      "onlyUpdatedIssues": false,          // ✅ 添加
      "processIssuesInBulk": false         // ✅ 添加
    },
    // ...
  }
}
```

### 2. 更新 `JiraAutomationService.ts`

添加 `PROJECT_KEY` 的替换：

```typescript
const rulePayloadString = templateString
  .replace(/{{RULE_NAME}}/g, ruleName)
  .replace(/{{WEB_APP_URL}}/g, webAppUrl)
  .replace(/{{BOT_API_BASE_URL}}/g, envConfig.BOT_API_BASE_URL)
  .replace(/{{BOT_TOKEN}}/g, envConfig.BOT_TOKEN)
  .replace(/{{BOT_ID}}/g, envConfig.BOT_ID)
  .replace(/{{USER_EMAIL}}/g, userinfo.userEmail)
  .replace(/{{PROJECT_KEY}}/g, config.projectKey)  // ✅ 恢复
  .replace(/{{PROJECT_ID}}/g, projectId)
  .replace(/{{USER_KEY}}/g, userKey);
```

## 📊 完整对比

### 实际成功的 curl 请求关键字段

```bash
curl 'https://jira.ringcentral.com/rest/cb-automation/latest/project/16552/rule' \
  -H 'content-type: application/json' \
  --data-raw '{
    "trigger": {
      "type": "jira.jql.scheduled",
      "value": {
        "schedule": {
          "cronExpression": "0 * * * * ?",
          "method": "CRON",
          "rate": 0,
          "rateInterval": 60
        },
        "jql": "project = MTR and ...",
        "executionMode": "nosearch",
        "onlyUpdatedIssues": false,
        "processIssuesInBulk": false
      }
    }
  }'
```

### 我们现在的模板（已修复）

```json
{
  "trigger": {
    "component": "TRIGGER",
    "schemaVersion": 1,
    "type": "jira.jql.scheduled",
    "value": {
      "schedule": {
        "cronExpression": "0 * * * * ?",
        "method": "CRON",
        "rate": 0,
        "rateInterval": 60
      },
      "jql": "project = {{PROJECT_KEY}}",
      "executionMode": "nosearch",
      "onlyUpdatedIssues": false,
      "processIssuesInBulk": false
    }
  }
}
```

## 💡 为什么这很重要？

### `jira.jql.scheduled` vs `jira.scheduled.trigger`

- **`jira.jql.scheduled`**: 
  - 基于 JQL 查询的定时触发器
  - 需要提供 `jql` 字段
  - 可以指定 `executionMode`（search, nosearch 等）
  - 这是 Jira Automation 实际支持的类型

- **`jira.scheduled.trigger`**:
  - 简化的定时触发器类型
  - 可能不被所有 Jira 版本支持
  - 我们之前误用了这个类型

### JQL 字段的作用

虽然我们的 rule 不需要查询 issue（`executionMode: "nosearch"`），但 Jira API 仍然要求提供 `jql` 字段。我们使用简单的 `"project = {{PROJECT_KEY}}"` 来满足这个要求。

## 🎉 测试结果

- ✅ 编译成功，没有错误
- ✅ 模板结构与实际成功的请求一致
- ✅ 所有必需字段都已包含

## 📝 其他观察

从 curl 请求中我们还确认了：

1. ✅ **Bot API URLs 正确**:
   - Private: `/v2/user/message`
   - Group: `/v2/team/message`

2. ✅ **customBody 格式正确**:
   - Smart values 可以直接嵌入 JSON 字符串
   - 如: `"message": {{webhookResponse.body.content.asJsonString}}`

3. ✅ **responseEnabled 设置**:
   - AppScript webhook: `true`
   - Bot API webhook: `true`
   - Callback webhook: `false`

4. ✅ **Condition 结构**:
   - 使用 `jira.condition.container.block`
   - 嵌套 `jira.condition.if.block`
   - Conditions 作为数组放在 block 内

## 🚀 下一步

现在可以在扩展中测试创建 rule：

1. 打开 Scheduled Messages Manager
2. 配置 Jira URL 和 Project Key
3. 配置 AppScript Web App URL
4. 点击"创建规则"
5. 应该能够成功创建（不再有 400 错误）

## 📚 相关文件

- ✅ `jira-rule-template-v3-working.json` - 已修复
- ✅ `JiraAutomationService.ts` - 已更新
- ✅ `contentScriptJiraAutomation.ts` - Import Rule 功能（用于验证）

---

**状态**: ✅ 已修复

**关键发现**: Trigger 类型必须是 `jira.jql.scheduled`，并且需要完整的 value 结构，包括 `schedule`, `jql`, `executionMode` 等字段

**验证方式**: 通过用户成功的 Import Rule curl 请求数据

