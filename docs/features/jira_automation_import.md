# Jira 自动化规则导入功能

## 功能介绍

该功能允许在 Jira 自动化管理页面导入之前导出的自动化规则，解决了 Jira 只有导出功能而没有导入功能的问题。

## 使用方法

1. **访问 Jira 自动化页面**
   - 打开 Jira 项目的自动化管理页面
   - URL 格式：`https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=YOUR_PROJECT_KEY`

2. **导入规则**
   - 在页面加载完成后，会在 "Create rule" 按钮旁边看到新的 "Import Rule" 按钮
   - 点击 "Import Rule" 按钮
   - 选择之前导出的 JSON 文件（如 `automation-rule-1681-202507170228.json`）
   - 系统会自动处理导入并创建新规则

3. **导入完成**
   - 导入成功后会显示成功消息
   - 页面会自动刷新以显示新导入的规则

## 支持的文件格式

导入功能支持 Jira 标准导出格式的 JSON 文件，包含以下结构：

```json
{
  "rules": [
    {
      "name": "规则名称",
      "state": "ENABLED",
      "canOtherRuleTrigger": false,
      "notifyOnError": "FIRSTERROR",
      "authorAccountId": "用户ID",
      "trigger": { ... },
      "components": [ ... ],
      "projects": [ ... ],
      "labels": [ ... ]
    }
  ],
  "cloud": false
}
```

## 技术实现

### 核心功能

1. **JSON 格式转换**
   - 将导出格式转换为 API 创建格式
   - 自动生成新的组件 ID
   - 更新项目信息为当前项目

2. **API 调用**
   - 使用 `/rest/cb-automation/latest/project/{projectId}/rule` 接口
   - 自动处理认证和请求头

3. **用户界面**
   - 在 iframe 内动态添加导入按钮
   - 提供文件选择和进度反馈
   - 显示成功/错误消息

### 文件列表

- `src/contentScriptJiraAutomation.ts` - 主要实现文件
- 已在 `src/manifest.json` 中配置相应的 content script
- 已在 `webpack.common.cjs` 中添加构建配置

## 错误处理

- 文件格式验证
- API 调用错误处理
- 用户友好的错误消息提示
- 自动重试机制

## 注意事项

1. 导入的规则会使用当前项目的 projectId
2. 如果文件包含多个规则，只会导入第一个
3. 导入的规则会被标记为新规则（isNewRule: true）
4. 原有的规则 ID 会被替换为新的临时 ID

## 示例文件

项目中包含两个示例导出文件：
- `test/fixtures/automation-rule-1681-202507170228.json` - 定时任务示例
- `test/fixtures/QA_verify_ticket_merge.json` - 状态转换触发示例

这些文件可以用于测试导入功能。 