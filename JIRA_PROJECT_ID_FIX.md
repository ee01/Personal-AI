# Jira Project ID 修复

## 问题描述

在创建 Jira Automation 规则时，遇到 500 错误：

```
java.lang.NumberFormatException: For input string: "MTR"
```

错误发生在 `JiraAutomationPermissionService.checkAdminPermission` 中，尝试将项目 Key "MTR" 解析为 `Long` 类型失败。

## 根本原因

Jira Automation API 期望使用**项目 ID**（数字），而不是**项目 Key**（字符串）：

- ❌ 错误：`/rest/cb-automation/latest/project/MTR/rule`
- ✅ 正确：`/rest/cb-automation/latest/project/16552/rule`

从导出的成功 rule 中也可以看到，`projects` 字段使用的是项目 ID：

```json
{
  "projects": [
    {
      "projectId": "16552",
      "projectTypeKey": "software"
    }
  ]
}
```

## 解决方案

### 1. 添加获取项目 ID 的方法

在 `JiraAutomationService.ts` 中添加：

```typescript
/**
 * 通过项目 Key 获取项目 ID
 */
private async getProjectId(config: JiraAutomationConfig): Promise<string> {
  const url = `${config.jiraUrl}/rest/api/2/project/${config.projectKey}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {})
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`无法获取项目信息 (${response.status}): ${await response.text()}`);
  }
  
  const project = await response.json();
  return project.id;
}
```

### 2. 更新所有 API 调用使用项目 ID

#### testAccess 方法

```typescript
async testAccess(config: JiraAutomationConfig): Promise<{ success: boolean; message: string }> {
  // ...
  
  // 获取项目 ID
  console.log('正在获取项目 ID...');
  const projectId = await this.getProjectId(config);
  console.log(`项目 ${config.projectKey} 的 ID: ${projectId}`);
  
  const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
  
  // ...
}
```

#### createBotExecutorRule 方法

```typescript
async createBotExecutorRule(
  config: JiraAutomationConfig,
  webAppUrl: string,
  botToken: string
): Promise<BotExecutorRule> {
  // 获取项目 ID
  const projectId = await this.getProjectId(config);
  
  // 在模板中替换 PROJECT_ID
  const rulePayloadString = templateString
    .replace(/{{PROJECT_ID}}/g, projectId)
    // ...
  
  // 在 URL 中使用项目 ID
  const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
  
  // ...
}
```

#### getRules 方法

```typescript
async getRules(config: JiraAutomationConfig): Promise<any[]> {
  // 获取项目 ID
  const projectId = await this.getProjectId(config);
  const url = `${config.jiraUrl}/rest/cb-automation/latest/project/${projectId}/rule`;
  
  // ...
}
```

### 3. 更新 Rule 模板

在 `jira-rule-template.json` 中添加 `projects` 字段：

```json
{
  "projects": [
    {
      "projectId": "{{PROJECT_ID}}",
      "projectTypeKey": "software"
    }
  ],
  "labels": [],
  "tags": []
}
```

## API 端点对比

### Jira Project API

**获取项目信息**（使用 Project Key）：
```
GET /rest/api/2/project/{projectKeyOrId}
```

响应示例：
```json
{
  "id": "16552",
  "key": "MTR",
  "name": "Mobile Thor",
  "projectTypeKey": "software"
}
```

### Jira Automation API

**创建规则**（必须使用 Project ID）：
```
POST /rest/cb-automation/latest/project/{projectId}/rule
```

**获取规则列表**（必须使用 Project ID）：
```
GET /rest/cb-automation/latest/project/{projectId}/rule
```

**删除规则**（使用 Rule ID，不需要 Project ID）：
```
DELETE /rest/cb-automation/latest/rule/{ruleId}
```

## 使用流程

1. **用户输入项目 Key**（如：MTR）
2. **调用 Jira Project API 获取项目 ID**
3. **使用项目 ID 调用 Automation API**

### 测试步骤

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
   - 确保先登录 Jira
   - 填写配置信息：
     - Jira URL: `https://jira.ringcentral.com`
     - Project Key: `MTR`（将自动转换为项目 ID）
     - Bot Token: `你的 Bot Token`
   - 点击"开始配置"

4. **查看控制台日志**：
   ```
   正在获取项目 ID...
   项目 MTR 的 ID: 16552
   创建 Jira Automation 规则: [Personal AI] Scheduled Messages Bot Executor
   项目 ID: 16552
   ```

5. **验证规则**：
   - 在 Jira 项目设置中查看 Automation 规则
   - 确认规则已成功创建

## 优势

### 1. **用户体验**
- 用户只需输入易记的项目 Key（如 MTR）
- 系统自动处理 Key 到 ID 的转换

### 2. **兼容性**
- 符合 Jira Automation API 的要求
- 避免 NumberFormatException 错误

### 3. **可维护性**
- 清晰的日志输出，便于调试
- 错误信息更准确

## 错误处理

### 项目不存在

如果项目 Key 不存在，会收到清晰的错误提示：

```
无法获取项目信息 (404): {"errorMessages":["No project could be found with key 'INVALID'."],"errors":{}}
```

### 权限不足

如果没有项目访问权限：

```
无法获取项目信息 (403): {"errorMessages":["You do not have permission to view this project."],"errors":{}}
```

## 相关文件

- `src/scheduled-messages/JiraAutomationService.ts` - 添加 getProjectId 方法
- `src/scheduled-messages/jira-rule-template.json` - 添加 projects 字段

## 参考资料

- [Jira REST API - Project](https://docs.atlassian.com/software/jira/docs/api/REST/latest/#api/2/project)
- [Jira Automation REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/)

