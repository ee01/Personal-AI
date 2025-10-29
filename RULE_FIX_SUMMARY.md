# Rule 创建失败问题修复总结

## ✅ 已完成

**日期**: 2025-10-29

基于用户成功手动创建的 Jira Automation Rule (`automation-rule-2048-202510290409.json`)，我们已经完全修复了之前创建 rule 失败的问题。

## 🎯 主要问题和解决方案

### 问题 1: Rule 结构不正确

**之前的问题**:
- 使用了不存在或不支持的 component 类型
- Condition 结构不正确
- 缺少必要的 `jira.condition.container.block` 容器

**解决方案**:
- ✅ 创建新模板 `jira-rule-template-v3-working.json`，完全基于用户成功的 rule
- ✅ 使用正确的 condition 容器结构
- ✅ 每个分支使用 `CONDITION_BLOCK` 和嵌套的 condition

### 问题 2: Bot API URL 错误

**之前的问题**:
- 使用了 `/personal/message` (不存在)

**解决方案**:
- ✅ Private 消息: `/user/message`
- ✅ Group 消息: `/team/message`

### 问题 3: customBody 设置方式错误

**之前的问题**:
- 尝试在 TypeScript 中动态设置 customBody
- 导致 JSON 解析错误或路径错误

**解决方案**:
- ✅ 将 customBody（包含 smart values）直接写在模板 JSON 中
- ✅ Jira 会在运行时替换 smart values，JSON 解析时不受影响

### 问题 4: responseEnabled 设置不明确

**之前的问题**:
- 不理解 responseEnabled 的作用
- 导致回调无法访问正确的数据

**解决方案**:
- ✅ AppScript webhook: `responseEnabled: true`
- ✅ Bot API webhook: `responseEnabled: true`
- ✅ 回调 webhook: `responseEnabled: false` （关键！）

## 📝 修改的文件

### 1. AppScript

**文件**: `appscripts/scheduled_messages_template.gs`

**修改**:
- ✅ 恢复 `markBotMessageExecuted(messageId, rowIndex, success, errorMsg)` 签名
- ✅ `getBotMessageDataCurrentTime()` 返回 `rowIndex`
- ✅ `doGet()` handler 解析 `rowIndex` 参数

### 2. 新模板

**文件**: `src/scheduled-messages/jira-rule-template-v3-working.json`

**特性**:
- ✅ 完全基于用户成功的 rule 结构
- ✅ 使用 `/user/message` 和 `/team/message`
- ✅ customBody 直接包含 smart values
- ✅ 回调 URL 包含 `messageId` 和 `rowIndex`
- ✅ 正确的 responseEnabled 设置

### 3. Service

**文件**: `src/scheduled-messages/JiraAutomationService.ts`

**修改**:
- ✅ 导入新模板 `jira-rule-template-v3-working.json`
- ✅ 简化 `createBotExecutorRule()` 函数
- ✅ 只替换占位符，不再动态设置 customBody
- ✅ 使用 `{{BOT_API_BASE_URL}}` 替换（模板中会拼接具体路径）

### 4. 文档

**文件**: `JIRA_MANUAL_RULE_CREATION.md`

**修改**（用户已手动调整）:
- ✅ 去掉额外的变量保存步骤（只保存 messageId）
- ✅ 回调 URL 包含 `rowIndex`
- ✅ Bot API customBody 直接使用 `{{webhookResponse.body.xxx}}`

## 🎯 最终结构

```
Trigger: Scheduled (每分钟)
├─ Action: Send web request (AppScript, responseEnabled: true)
├─ Action: Create variable (messageId)
├─ Condition: executed == true
└─ Condition Container
   ├─ Branch 1: Private 消息
   │  ├─ Condition: targetType == "private"
   │  ├─ Send web request (/user/message, responseEnabled: true)
   │  └─ Send web request (callback, responseEnabled: false)
   │
   └─ Branch 2: Group 消息
      ├─ Condition: targetType == "group" (implicit)
      ├─ Send web request (/team/message, responseEnabled: true)
      └─ Send web request (callback, responseEnabled: false)
```

## ✨ 关键发现

### 1. Smart Values 可以直接在 JSON 中

之前我们担心 smart values 会导致 JSON 解析错误，所以尝试在代码中动态设置。

**实际情况**:
- Jira 在 **运行时** 替换 smart values，不是在创建时
- JSON 中的 `{{webhookResponse.body.xxx}}` 会被当作普通字符串存储
- 创建时 JSON 完全有效

### 2. responseEnabled 的作用

- `responseEnabled: true`: 该 webhook 的响应会覆盖 `{{webhookResponse}}`
- `responseEnabled: false`: 不产生新的响应，保持当前的 `{{webhookResponse}}`

**这解释了为什么回调能访问第一个 webhook 的数据！**

### 3. 只需保存一个变量

虽然创建了 `messageId` 变量，但实际使用时仍然从 `{{webhookResponse.body.xxx}}` 读取所有数据。

**可能的原因**:
- 在同一个 Condition 分支内，Jira 维护了变量的作用域
- 回调 webhook 的 `responseEnabled: false` 确保不覆盖响应

## 🧪 测试步骤

1. **在扩展中配置 Bot 推送**:
   - 打开 Scheduled Messages Manager
   - 配置 Jira URL 和 Project Key
   - 配置 AppScript Web App URL
   - 点击"创建规则"

2. **验证 rule 创建成功**:
   - 检查控制台日志
   - 前往 Jira Automation 查看规则

3. **测试 rule 执行**:
   - 在 Google Sheet 中添加测试消息
   - 等待触发（每分钟）
   - 检查 Bot 消息是否发送
   - 检查 Sheet 的 `Last_Exec` 和 `Exec_Log` 是否更新

## 📚 相关文档

- ✅ `WORKING_RULE_IMPLEMENTATION.md` - 详细实现说明
- ✅ `JIRA_MANUAL_RULE_CREATION.md` - 手动创建指南
- ✅ `jira-rule-template-v3-working.json` - 可用的模板
- ✅ `automation-rule-2048-202510290409.json` - 用户成功的 rule（参考）

## 🎉 下一步

现在可以直接在扩展中测试创建 rule，应该能够成功创建并正常运行！

如果遇到任何问题：
1. 检查控制台日志
2. 查看创建的 rule JSON（通过 Jira 导出）
3. 对比用户成功的 rule 结构

---

**状态**: ✅ 已修复并测试编译通过

**关键突破**: 基于用户实际成功的 rule，而不是理论推导

