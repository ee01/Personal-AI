# Bot 配置认证问题修复

## 问题描述

在配置 Bot 推送功能时，用户遇到"认证失败，请检查是否已登录 Jira 或 Token 是否正确"的错误提示。

## 根本原因

Chrome Extension 的 fetch 请求无法自动使用浏览器的 cookies，即使设置了 `credentials: 'include'`，因为：

1. **缺少 cookies 权限**：manifest.json 中没有声明 `cookies` 权限
2. **错误信息不够详细**：原有的错误提示无法帮助用户定位具体问题

## 解决方案

### 1. 添加 cookies 权限

在 `src/manifest.json` 中添加了 `cookies` 权限：

```json
"permissions": [
  "tabs",
  "storage",
  "activeTab",
  "alarms",
  "background",
  "unlimitedStorage",
  "offscreen",
  "scripting",
  "identity",
  "clipboardWrite",
  "cookies"  // ✅ 新增
]
```

### 2. 增强 Jira 认证检查

在 `JiraAutomationService.ts` 中添加了 `checkJiraLoginStatus()` 方法：

- 使用 `chrome.cookies.getAll()` 检查 Jira 认证 cookies
- 支持检测多种 Jira 部署类型的 cookies：
  - `cloud.session.token` (Jira Cloud)
  - `JSESSIONID` (Jira Server/Data Center)
  - `atlassian.xsrf.token`

### 3. 改进错误提示

提供更详细的错误信息，区分不同的失败场景：

- **未登录**：提示用户先在浏览器中登录 Jira
- **权限不足**：提示检查项目管理员权限和 Automation 功能
- **项目不存在**：提示检查 Project Key 是否正确
- **其他错误**：显示具体的 HTTP 状态码和响应内容

### 4. 优化用户体验

在 Bot 配置对话框中：

- **添加"打开 Jira"按钮**：让用户可以快速打开 Jira 登录页面
- **改进错误显示**：支持多行错误信息显示（使用 `whiteSpace: 'pre-wrap'`）
- **添加提示文本**：提醒用户需要先登录 Jira

## 使用流程

### 配置 Bot 推送的正确步骤

1. **先登录 Jira**：
   - 点击对话框中的"🔗 打开 Jira"按钮
   - 在新标签页中登录 Jira
   - 确保使用的账号对目标项目有管理员权限

2. **填写配置信息**：
   - Jira URL：如 `https://jira.ringcentral.com`
   - Project Key：如 `MTR`（需要有管理员权限）
   - Bot Token：用于调用内网 Bot API

3. **测试连接**：
   - 系统会先检查 Jira cookies 是否存在
   - 然后测试是否能访问 Jira Automation API
   - 如果失败，会显示详细的错误原因

4. **创建 Automation 规则**：
   - 如果测试通过，系统会自动创建 Bot 执行器规则
   - 该规则每分钟执行一次，检查并发送 Bot 消息

## 技术细节

### Jira Automation API

- **API 端点**：`/rest/cb-automation/latest/project/{projectKey}/rule`
- **认证方式**：
  1. Cookie 认证（Session）- 优先使用
  2. Bearer Token（Personal Access Token）- 备选方案

### Chrome Extension Cookies 访问

```typescript
// 获取指定域名的所有 cookies
const cookies = await chrome.cookies.getAll({ domain: 'jira.ringcentral.com' });

// 过滤认证相关的 cookies
const authCookies = cookies.filter(cookie => 
  cookie.name === 'JSESSIONID' || 
  cookie.name === 'cloud.session.token'
);
```

### Fetch 请求配置

```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include'  // 自动携带 cookies
});
```

## 测试建议

1. **测试场景 1：未登录 Jira**
   - 预期：提示"未检测到 Jira 登录状态"
   - 操作：点击"打开 Jira"按钮，完成登录后重试

2. **测试场景 2：权限不足**
   - 预期：提示检查项目权限
   - 操作：确保对项目有管理员权限

3. **测试场景 3：项目不存在**
   - 预期：提示"项目不存在"
   - 操作：检查 Project Key 拼写

4. **测试场景 4：正常流程**
   - 预期：成功创建 Automation 规则
   - 验证：在 Jira 项目设置中查看 Automation 规则

## 后续优化建议

1. **支持 Personal Access Token**：
   - 对于无法使用 Cookie 认证的场景
   - 提供手动输入 Token 的选项

2. **自动刷新 Token**：
   - 检测 Session 过期
   - 自动引导用户重新登录

3. **权限预检查**：
   - 在配置前检查用户对项目的权限
   - 提前发现权限问题

4. **配置向导**：
   - 提供分步引导
   - 自动检测和修复常见问题

## 相关文件

- `src/manifest.json` - 添加 cookies 权限
- `src/scheduled-messages/JiraAutomationService.ts` - 增强认证检查逻辑
- `src/scheduled-messages/ScheduledMessagesManager.tsx` - 改进 UI 和错误提示

