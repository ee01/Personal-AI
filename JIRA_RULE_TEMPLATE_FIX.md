# Jira Automation Rule 创建失败修复

## 问题描述

在配置 Bot 推送功能时，用户遇到 500 错误：

```
Cannot deserialize value of type `java.lang.Long` from String "personal-ai": 
not a valid `java.lang.Long` value
```

错误发生在创建 Jira Automation 规则时，Jira API 无法解析 `labels` 字段。

## 根本原因

原代码中将 `labels` 设置为字符串数组：

```typescript
labels: ['personal-ai', 'scheduled-messages']
```

但 Jira Automation API 期望 `labels` 是 `Long[]` 类型（label ID 数组），而不是字符串数组。

## 解决方案

### 1. 创建 Rule 模板文件

创建了 `src/scheduled-messages/jira-rule-template.json`，包含标准的 Jira Automation 规则结构：

```json
{
  "name": "{{RULE_NAME}}",
  "state": "ENABLED",
  "canOtherRuleTrigger": false,
  "notifyOnError": "FIRSTERROR",
  "authorAccountId": "",
  "actorAccountId": "",
  "trigger": {
    "component": "TRIGGER",
    "schemaVersion": 1,
    "type": "jira.scheduled.trigger",
    "value": {
      "scheduleConfig": {
        "expression": "0 * * * * ?"
      }
    },
    "children": [],
    "conditions": [],
    "optimisedIds": [],
    "newComponent": false
  },
  "components": [
    {
      "component": "ACTION",
      "schemaVersion": 2,
      "type": "jira.issue.outgoing.webhook",
      "value": {
        "url": "{{WEB_APP_URL}}?action=getActiveBotMessages&timeScope=minute",
        "headers": [
          {
            "id": "_header_bot_token",
            "name": "Authorization",
            "value": {
              "keyOrValue": "Bearer {{BOT_TOKEN}}",
              "secret": false
            }
          }
        ],
        "sendIssue": false,
        "contentType": "empty",
        "method": "GET",
        "responseEnabled": true,
        "usedSecretsKeys": []
      },
      "children": [],
      "conditions": [],
      "optimisedIds": [],
      "newComponent": false
    },
    {
      "component": "ACTION",
      "schemaVersion": 1,
      "type": "codebarrel.action.groovy",
      "value": {
        "script": "{{GROOVY_SCRIPT}}"
      },
      "children": [],
      "conditions": [],
      "optimisedIds": [],
      "newComponent": false
    }
  ],
  "projects": [],
  "labels": [],
  "tags": []
}
```

**关键修复点：**
- ✅ `labels: []` - 设置为空数组（而不是字符串数组）
- ✅ `tags: []` - 设置为空数组
- ✅ 添加了 `schemaVersion`、`optimisedIds`、`newComponent` 等必需字段
- ✅ 使用占位符 `{{VARIABLE}}` 方便动态替换

### 2. 修改代码使用模板

在 `JiraAutomationService.ts` 中：

```typescript
import ruleTemplate from './jira-rule-template.json';

async createBotExecutorRule(
  config: JiraAutomationConfig,
  webAppUrl: string,
  botToken: string
): Promise<BotExecutorRule> {
  const ruleName = '[Personal AI] Scheduled Messages Bot Executor';
  
  // 生成 Groovy 脚本
  const groovyScript = this.generateGroovyScript(botToken);
  
  // 从模板创建规则 payload
  const templateString = JSON.stringify(ruleTemplate);
  const rulePayloadString = templateString
    .replace(/{{RULE_NAME}}/g, ruleName)
    .replace(/{{WEB_APP_URL}}/g, webAppUrl)
    .replace(/{{BOT_TOKEN}}/g, botToken)
    .replace(/{{GROOVY_SCRIPT}}/g, 
      groovyScript
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
    );
  
  const rulePayload = JSON.parse(rulePayloadString);
  
  // ... 发送请求
}
```

### 3. 更新 TypeScript 配置

在 `tsconfig.json` 中添加 JSON 模块支持：

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

## 优势

### 1. **可维护性**
- Rule 结构与代码分离，更容易修改和调试
- 可以直接从 Jira 导出成功的 rule 作为模板

### 2. **可扩展性**
- 可以创建多个不同的 rule 模板
- 支持更复杂的 rule 结构

### 3. **调试友好**
- 模板文件是标准 JSON 格式，易于验证
- 可以在 Jira UI 中导入导出，便于测试

## 如何从 Jira 导出 Rule 模板

1. **在 Jira 中创建并测试规则**
2. **导出规则**：
   - 进入项目设置 → Automation
   - 找到想要导出的规则
   - 点击右上角的 "..." → Export rule
   - 下载 JSON 文件

3. **处理导出的 JSON**：
   - 移除 `id`、`created`、`updated` 等运行时字段
   - 将动态值替换为占位符（如 `{{RULE_NAME}}`）
   - 清空 `labels` 和 `tags` 数组
   - 保存为模板文件

## 测试步骤

1. **重新构建扩展**：
   ```bash
   npm run build
   ```

2. **重新加载扩展**：
   - 打开 Chrome 扩展管理页面
   - 点击"重新加载"

3. **测试配置 Bot**：
   - 打开定时消息管理页面
   - 点击"配置 Bot 推送"
   - 填写信息并提交
   - 检查控制台输出的 Rule Payload

4. **验证规则**：
   - 在 Jira 项目设置中查看 Automation 规则
   - 检查规则是否正确创建
   - 测试规则是否能正常执行

## 相关文件

- `src/scheduled-messages/jira-rule-template.json` - Rule 模板文件
- `src/scheduled-messages/JiraAutomationService.ts` - 使用模板创建规则
- `tsconfig.json` - 添加 JSON 模块支持

## 后续优化建议

1. **支持多种 Rule 模板**：
   - 创建不同场景的模板（每分钟、每小时、每天等）
   - 支持用户自定义模板

2. **模板验证**：
   - 在发送前验证生成的 payload 是否符合 Jira API 规范
   - 提供更友好的错误提示

3. **Rule 管理**：
   - 支持查看已创建的规则
   - 支持更新和删除规则
   - 支持启用/禁用规则

4. **测试工具**：
   - 提供 Rule Payload 预览
   - 支持导出生成的 payload 用于调试

