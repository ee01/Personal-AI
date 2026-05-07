# 快速指南：解决 Jira Groovy Map 格式问题

## 🎯 问题

Jira Automation 的 `{{webhookResponse.body.asJsonString}}` 返回的不是标准 JSON：

```
❌ Jira 返回：{currentRelease=25.4.20, currentPhase=Dev}
✅ 需要格式：{"currentRelease":"25.4.20","currentPhase":"Dev"}
```

## ✅ 解决方案（已实现）

在 Apps Script 中添加了 `parseJiraJson()` 函数，自动兼容两种格式。

### 1. Jira Rule 配置（正式链路）

当前正式实现使用双 Jira Rule：

```json
{
  "url": "{{WEB_APP_URL}}?action=cacheReleaseInfo",
  "method": "POST",
  "customBody": "{\n  \"project\": \"mThor\",\n  \"releaseInfo\": {{mThorReleaseInfo.asJsonString}}\n}"
}
```

Timeline Sync Rule 先把每个项目的 release info 写入 Apps Script 缓存，Executor Rule 再读取缓存匹配 Timeline 消息。

### 2. 旧链路兼容

继续使用 `.asJsonString`：

```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime&mThor={{mThorReleaseInfo.asJsonString.urlEncode}}",
  "method": "GET"
}
```

说明：

- 这类 inline URL 参数写法仍然被 Apps Script 兼容，方便旧 rule 继续运行或手工测试

### 3. Apps Script 自动处理

```javascript
// doGet 函数中
if (mThor) {
  // Apps Script 的 e.parameter 已经完成 form-urlencoded 解码
  releaseInfo['mThor'] = parseJiraJson(mThor);
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
| `{list=[a,b,{x=1}]}` | `{"list":["a","b",{"x":1}]}` | ✅ |
| `{nested={x=1}}` | `{"nested":{"x":1}}` | ✅ |
| `{empty=null}` | `{"empty":null}` | ✅ |
| `{notes="Alpha, Beta = ready"}` | `{"notes":"Alpha, Beta = ready"}` | ✅ |

## 📦 缓存大小限制

Timeline Sync Rule 会把每个项目单独写入 Apps Script Script Properties。Google Apps Script 对单个 property value 有 9KB 限制，所以 `cacheReleaseInfo` 会在写入前预检最终缓存 JSON 大小：

- 超过限制时返回 `TIMELINE_CACHE_TOO_LARGE`
- 响应只包含 payload 字节数、Milestone 数量和前 20 个 Milestone key，不暴露具体日期
- 扩展里的 Timeline 缓存状态卡会展示最近同步失败原因、payload 大小、Milestone 数量和样例 key，方便直接判断是格式问题还是缓存过大
- 处理方式：减少同步的 Milestone 数量或字段体积；如果项目确实需要更大 payload，需要改用 Sheet/Drive 等外部缓存

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
- **错误容错**：旧 inline 路径解析失败会安全返回空对象；`cacheReleaseInfo` 会返回失败并拒绝写入坏缓存

### ⚠️ 限制

- 无引号字符串中包含逗号时，原始 Groovy Map 字符串无法可靠区分文本逗号和字段分隔符
- 字段可能包含逗号、等号或换行时，优先让上游输出标准 JSON，或至少让字段值以单/双引号包裹
- `cacheReleaseInfo` 会校验 `releaseInfo` 对象；解析失败返回 `PARSE_RELEASE_INFO_FAILED`，schema 不匹配返回 `INVALID_RELEASE_INFO_SCHEMA`，不会把坏缓存写入 Script Properties
- Apps Script Script Properties 单值限制为 9KB；最终缓存 JSON 超限会返回 `TIMELINE_CACHE_TOO_LARGE`，不会进入不透明的 `setProperty` 异常

## 📚 相关文档

- **详细文档**：`jira-groovy-map-parsing.md`
- **整体方案**：`jira-302-redirect-fix.md`
- **代码位置**：`src/scheduled-messages/app-script-template.gs`

## 🆘 故障排查

### 问题：解析失败

**日志**：
```
Groovy Map 解析失败: ...
```

**解决**：
1. 先看 Jira Audit Log 里的 `errorCode` 和 `parseError`
2. 检查是否有未闭合括号、未闭合引号或未加引号的逗号文本
3. 在 `testParseJiraJson()` 中添加测试用例
4. 如果是边缘情况，可以临时在 Jira 端转换格式

### 问题：缓存过大

**Audit Log**:
```
errorCode: TIMELINE_CACHE_TOO_LARGE
```

**解决**：
1. 在定时消息界面查看 Timeline 缓存状态卡，确认 `payloadBytes / maxBytes`、Milestone 数量和样例 key
2. 打开 Timeline Sync Rule 查看最近一次运行结果
3. 减少 Timeline Sync Rule 中同步的 Milestone 数量或字段
4. 如果项目确实需要超过 9KB 的 release info，改用 Sheet/Drive 等外部缓存设计

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
