# 快速指南：解决 Jira Groovy Map 格式问题

## 🎯 问题

Jira Automation 的 `{{webhookResponse.body.asJsonString}}` 返回的不是标准 JSON：

```
❌ Jira 返回：{currentRelease=25.4.20, currentPhase=Dev}
✅ 需要格式：{"currentRelease":"25.4.20","currentPhase":"Dev"}
```

## ✅ 解决方案（已实现）

在 Apps Script 中添加了 `parseJiraJson()` 函数，自动兼容两种格式。

### 1. Jira Rule 配置（无需修改）

继续使用 `.asJsonString`：

```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime&mThor={{mThorReleaseInfo.asJsonString.urlEncode}}",
  "method": "GET"
}
```

### 2. Apps Script 自动处理

```javascript
// doGet 函数中
if (mThor) {
  // ✅ 使用 parseJiraJson 替代 JSON.parse
  releaseInfo['mThor'] = parseJiraJson(decodeURIComponent(mThor));
}
```

**自动兼容**：
- ✅ Groovy Map：`{key=value}` → 正常解析
- ✅ 标准 JSON：`{"key":"value"}` → 正常解析

## 🧪 测试

### 在 Apps Script 编辑器中测试

1. 打开 Google Apps Script 编辑器
2. 找到 `testParseJiraJson()` 函数
3. 点击 **运行**
4. 查看日志（**查看** → **日志**）

**预期输出**：

```
========== 开始测试 parseJiraJson ==========

测试 1: Groovy Map 格式
输入: {currentRelease=25.4.20, currentPhase=Dev, nextPhaseStartDate=11/20/2025}
标准 JSON 解析失败，尝试 Groovy Map 格式: Unexpected token c in JSON at position 1
Groovy Map 解析成功: {"currentRelease":"25.4.20","currentPhase":"Dev","nextPhaseStartDate":"11/20/2025"}
输出: {"currentRelease":"25.4.20","currentPhase":"Dev","nextPhaseStartDate":"11/20/2025"}
验证: currentRelease = 25.4.20

测试 2: 标准 JSON 格式
输入: {"currentRelease":"25.4.20","currentPhase":"Dev"}
输出: {"currentRelease":"25.4.20","currentPhase":"Dev"}

...

========== 测试完成 ==========
```

### 在浏览器中测试完整流程

访问以下 URL（替换为你的实际 Web App URL）：

```
https://script.google.com/.../exec
  ?action=getBotMessageCurrentTime
  &currentTime=2025-11-11%2014:30
  &mThor=%7BcurrentRelease%3D25.4.20%2C%20currentPhase%3DDev%7D
```

**预期响应**：

```json
{
  "executed": true,
  "messageId": "MSG_001",
  "topic": "Timeline 提醒",
  ...
}
```

**日志**：

```
[GET] 接收到 releaseInfo 参数，项目: mThor
标准 JSON 解析失败，尝试 Groovy Map 格式
Groovy Map 解析成功: {"currentRelease":"25.4.20","currentPhase":"Dev"}
```

## 📊 支持的格式

| 输入格式 | 解析结果 | 状态 |
|---------|---------|------|
| `{key=value}` | `{"key":"value"}` | ✅ |
| `{"key":"value"}` | `{"key":"value"}` | ✅ |
| `{num=123}` | `{"num":123}` | ✅ |
| `{flag=true}` | `{"flag":true}` | ✅ |
| `{list=[a,b]}` | `{"list":["a","b"]}` | ✅ |
| `{nested={x=1}}` | `{"nested":{"x":1}}` | ✅ |
| `{empty=null}` | `{"empty":null}` | ✅ |

## 🔧 部署步骤

1. ✅ **更新 Apps Script 代码**（已完成）
   - 已添加 `parseJiraJson()` 函数
   - 已添加 `splitGroovyMapPairs()` 辅助函数
   - 已在 `doGet` 中使用

2. **重新部署 Web App**
   ```
   Apps Script 编辑器 → 部署 → 管理部署 → 编辑
   → 新建版本 → 描述：添加 Groovy Map 解析支持
   → 部署
   ```

3. **测试**
   - 运行 `testParseJiraJson()` 函数
   - 在浏览器中测试完整 URL
   - 在 Jira 中手动触发 Automation Rule

## 💡 注意事项

### ✅ 优点

- **无需修改 Jira**：继续使用 `.asJsonString`
- **向后兼容**：支持标准 JSON 和 Groovy Map
- **自动处理**：透明转换，无需手动干预
- **错误容错**：解析失败返回空对象，不影响流程

### ⚠️ 限制

- 字符串值中包含 `=` 或 `,` 可能导致解析错误（实际很少遇到）
- 不支持特殊字符转义（如 `\n`），但实际使用中够用

## 📚 相关文档

- **详细文档**：`jira-groovy-map-parsing.md`
- **整体方案**：`jira-302-redirect-fix.md`
- **代码位置**：`app-script-template.gs` (第 1588-1726 行)

## 🆘 故障排查

### 问题：解析失败

**日志**：
```
Groovy Map 解析失败: ...
```

**解决**：
1. 查看日志中的原始字符串
2. 检查是否有特殊字符
3. 在 `testParseJiraJson()` 中添加测试用例
4. 如果是边缘情况，可以临时在 Jira 端转换格式

### 问题：类型不正确

**示例**：数字被解析为字符串

**原因**：可能包含非数字字符（如 `25.4.20` 被识别为字符串）

**解决**：这是预期行为，版本号应该作为字符串处理

## ✅ 总结

- ✅ 问题已解决：Groovy Map 格式自动转换为标准 JSON
- ✅ 无需修改 Jira 配置
- ✅ 向后兼容标准 JSON 格式
- ✅ 自动处理，透明转换

**一切就绪，可以正常使用！** 🎉

