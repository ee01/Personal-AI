# Bot 推送快速开始指南 (v3 架构)

## ✅ v3 架构核心改进

1. **AppScript 只管数据** - 不再调用 Bot API（因为外网无法访问内网）
2. **Jira 调用 Bot API** - 在内网执行，可以正常访问
3. **自动读取配置** - 无需手动输入 Bot Token

## 🚀 快速开始

### Step 1: 确保 Bot 配置存在

打开扩展 → 设置，确认以下配置已填写：
- ✅ `BOT_API_BASE_URL`
- ✅ `BOT_TOKEN`
- ✅ `BOT_ID`

### Step 2: 构建扩展

```bash
cd /Users/Esone/git/personal-ai
npm run build
```

### Step 3: 配置 Bot 推送

1. 打开扩展 → 定时消息管理
2. 点击 "配置 Bot 推送"
3. 填写：
   - **Jira URL**: `https://jira.ringcentral.com`
   - **Project Key**: `MTR` (或您有权限的项目)
4. 点击 "创建规则"

**不需要填写 Bot Token！** 系统会自动从扩展设置中读取。

### Step 4: 验证规则创建

1. 打开 Jira → Automation
2. 找到 `[Personal AI] Scheduled Messages Bot Executor`
3. 查看规则结构：
   - ✅ Trigger: 每分钟执行
   - ✅ Step 1: Webhook 调用 AppScript
   - ✅ Condition: executed == true
   - ✅ Step 2: Webhook 调用 Bot API

### Step 5: 添加测试消息

打开 Google Sheet，添加：

| 字段 | 值 |
|------|------|
| ID | `TEST_V3_001` |
| Topic | `测试 v3 架构` |
| Content | `这是 v3 架构的测试消息` |
| Schedule_Date | 今天 (YYYY-MM-DD) |
| Schedule_Time | 当前时间 + 2 分钟 (HH:mm) |
| Push_Method | `Bot` |
| Status | `Active` |

### Step 6: 等待执行

2 分钟后：
- ✅ Glip 收到 Bot 消息
- ✅ Sheet 中 `Last_Exec` 更新
- ✅ Sheet 中 `Exec_Log` 显示 ✅

## 🔍 调试方法

### 1. 测试 AppScript API

```bash
curl "YOUR_WEB_APP_URL?action=getBotMessageCurrentTime"
```

期望返回：
```json
{
  "executed": true,
  "messageId": "TEST_V3_001",
  "content": "这是 v3 架构的测试消息",
  "targetType": "private",
  "userName": "Esone Qiu"
}
```

### 2. 查看 Jira Audit Log

Jira → Automation → Rule → Audit Log

查看：
- Step 1 返回的数据
- Condition 是否通过
- Step 2 是否执行
- Bot API 返回状态

### 3. 查看 AppScript 日志

Apps Script 编辑器 → 执行 → 执行情况

查看：
```
[Bot 单条消息] 当前时间: 2025-10-29 14:30
[优先级 1] 当前分钟消息: TEST_V3_001
返回待发送 Bot 消息数据: TEST_V3_001 - 测试 v3 架构
```

## ⚠️ 常见问题

### Q: 创建规则时报错 "component.unknown.not.installed"

**原因**: 使用了旧版本的规则模板（v1 或 v2）

**解决**: 
1. 确保使用 `jira-rule-template-v3.json`
2. 重新 `npm run build`
3. 重新创建规则

### Q: 消息没有推送

**检查**:
1. Jira Rule 是否启用？
2. AppScript 是否返回 `executed: true`？
3. Condition 是否通过？
4. Bot API 是否返回 200？
5. Bot Token 是否过期？

### Q: Bot Token 在哪里配置？

**v3 改进**: 不需要在创建规则时配置！

Bot Token 自动从扩展设置中读取：
- 打开扩展 → 设置
- 查找 `BOT_TOKEN` 配置项
- 确保值正确且未过期

## 📚 详细文档

- **`JIRA_BOT_ARCHITECTURE_V3.md`** - 完整架构说明
- **`BOT_SINGLE_MESSAGE_IMPLEMENTATION.md`** - 实现细节
- **`test-rule-payload-v3.json`** - 测试 payload 示例

## ✅ 架构对比

| 特性 | v2 | v3 |
|------|----|----|
| AppScript 职责 | 数据 + 发送 | 只管数据 |
| Bot API 调用者 | AppScript (外网) | Jira (内网) |
| 内网访问 | ❌ 不支持 | ✅ 支持 |
| Bot Token 输入 | ❌ 需要 | ✅ 自动读取 |
| Jira Rule 结构 | 单步 | 两步 + Condition |
| 可靠性 | ⚠️ 外网限制 | ✅ 完全可靠 |

## 🎉 完成！

现在您可以使用 Bot 推送功能了！

如果有任何问题，请查看详细文档或 Jira Audit Log。

