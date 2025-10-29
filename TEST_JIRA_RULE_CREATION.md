# 测试 Jira Rule 创建

## 快速测试

### 选项 1：使用测试脚本（推荐）

```bash
# 1. 编辑脚本，设置 BOT_TOKEN
vi test-create-rule.sh
# 找到 BOT_TOKEN="YOUR_BOT_TOKEN_HERE" 并替换为实际值

# 2. 运行测试
./test-create-rule.sh
```

### 选项 2：使用 curl 命令

```bash
# 1. 编辑 payload 文件
vi test-rule-payload.json
# 修改 botToken 参数

# 2. 执行请求
curl 'https://jira.ringcentral.com/rest/cb-automation/latest/project/16552/rule' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'X-Atlassian-Token: no-check' \
  --data @test-rule-payload.json
```

### 选项 3：使用扩展 UI

```bash
# 1. 构建扩展
npm run build

# 2. 在 Chrome 中重新加载扩展

# 3. 打开定时消息管理页面
# 4. 点击"配置 Bot 推送"
# 5. 填写信息并提交
```

## 核心改动

### ✅ 移除了什么
- Groovy 脚本组件（`codebarrel.action.groovy`）
- 复杂的字符串转义逻辑

### ✅ 保留了什么
- Scheduled trigger（每分钟执行）
- Webhook action（调用 AppScript）

### ✅ 新的工作流程
```
Jira Automation (每分钟)
  ↓
  GET https://script.google.com/.../exec?action=executeBotMessages&botToken=xxx
  ↓
AppScript 处理所有逻辑：
  - 查询 Sheet 中需要执行的消息
  - 调用 Bot API 发送消息
  - 更新执行状态
```

## 预期结果

### ✅ 成功
```json
{
  "id": 1234,
  "name": "[Personal AI Test] Scheduled Messages Bot Executor",
  "state": "ENABLED",
  "trigger": {
    "type": "jira.scheduled.trigger"
  },
  "components": [
    {
      "type": "jira.issue.outgoing.webhook"
    }
  ]
}
```

如果看到这个响应，说明创建成功！

**记录 Rule ID**：`1234`（示例）

**Rule URL**：
```
https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=MTR#/rule/1234
```

### ❌ 失败

如果还是失败，请检查：

1. **认证问题**
   - 确保已在浏览器中登录 Jira
   - 检查 cookies 是否有效

2. **权限问题**
   - 确认对项目 MTR 有管理员权限
   - 确认 Automation 功能已启用

3. **Payload 问题**
   - 检查 authorAccountId 是否正确（应该是 `esone.qiu`）
   - 检查 projectId 是否正确（应该是 `16552`）

## 删除测试 Rule

如果创建了测试 rule，可以这样删除：

### 通过 UI
1. 访问：https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=MTR
2. 找到 `[Personal AI Test] Scheduled Messages Bot Executor`
3. 点击删除

### 通过 API
```bash
# 替换 1234 为实际的 Rule ID
curl -X DELETE 'https://jira.ringcentral.com/rest/cb-automation/latest/rule/1234' \
  -H 'X-Atlassian-Token: no-check'
```

## 调试技巧

### 1. 查看完整的错误信息
```bash
curl -v 'https://jira.ringcentral.com/rest/cb-automation/latest/project/16552/rule' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'X-Atlassian-Token: no-check' \
  --data @test-rule-payload.json
```

### 2. 验证 Payload 格式
```bash
cat test-rule-payload.json | jq '.'
```

### 3. 检查用户信息
```bash
curl 'https://jira.ringcentral.com/rest/api/2/myself' \
  -H 'Accept: application/json'
```

### 4. 检查项目信息
```bash
curl 'https://jira.ringcentral.com/rest/api/2/project/MTR' \
  -H 'Accept: application/json'
```

## 简化的 Payload 结构

```json
{
  "name": "规则名称",
  "authorAccountId": "用户 Key",
  "actorAccountId": "用户 Key",
  "trigger": {
    "type": "jira.scheduled.trigger",
    "value": {
      "scheduleConfig": {
        "expression": "0 * * * * ?"  // 每分钟
      }
    }
  },
  "components": [
    {
      "type": "jira.issue.outgoing.webhook",
      "value": {
        "url": "AppScript URL + botToken",
        "method": "GET"
      }
    }
  ],
  "projects": [
    {
      "projectId": "16552"
    }
  ]
}
```

**关键点**：
- ✅ 只有 1 个 trigger
- ✅ 只有 1 个 component
- ✅ 没有 Groovy 脚本
- ✅ 结构简单，兼容性好

## 下一步

1. ✅ **测试创建** - 使用上述任一方法
2. 📋 **记录 Rule ID** - 如果创建成功
3. 🔗 **发送给我** - 如果需要删除，发送 Rule ID 或 URL
4. 📝 **更新 AppScript** - 添加 `executeBotMessages` handler

## 文件清单

- ✅ `test-create-rule.sh` - 自动化测试脚本
- ✅ `test-rule-payload.json` - 测试 payload
- ✅ `JIRA_GROOVY_FIX.md` - 详细说明文档
- ✅ `TEST_JIRA_RULE_CREATION.md` - 本文件（快速指南）

