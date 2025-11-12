# Jira Automation 302 重定向问题解决方案

## 问题背景

Google Apps Script Web App 在处理 POST 请求时会返回 302 重定向响应，这是 Apps Script 的既定行为，不是代码问题。

参考资料：
- [Stack Overflow: Request from server to Google Web App returns 302 code](https://stackoverflow.com/questions/56521290/request-from-server-to-google-web-app-returns-302-code)
- [Atlassian Community: Jira Automation Web Request returning HTTP 302 REDIRECT](https://community.atlassian.com/forums/Jira-questions/Jira-Automation-Web-Request-to-Confluence-Cloud-returning-HTTP/qaq-p/2665396)

**核心问题**：
- ✅ Jira Automation 可以处理 GET 请求的 302 重定向
- ❌ Jira Automation **无法**处理 POST 请求的 302 重定向

## 解决方案：改用 GET 请求 + URL 参数传递

### 架构设计

```
旧方案（POST，失败）:
Jira → [POST with body] → Apps Script (302 redirect) → ❌ 失败

新方案（GET，成功）:
Jira → [GET with URL params] → Apps Script (直接处理) → ✅ 成功

支持两种模式：
1. 带 releaseInfo：匹配所有消息（包括 Timeline）
2. 不带 releaseInfo：只匹配普通时间触发消息（跳过 Timeline）
```

### 实现细节

#### 1. Jira Rule 配置变更

**原来的 POST 请求**：
```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime",
  "method": "POST",
  "contentType": "custom",
  "customBody": "{...releaseInfo...}"
}
```

**新方案：一个 GET 请求（通过 URL 参数传递所有数据）**：

```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime&currentTime={{now.format(\"yyyy-MM-dd HH:mm\").urlEncode}}&mThor={{mThorReleaseInfo.asJsonString.urlEncode}}&jupiterDesktop={{jupiterDesktopReleaseInfo.asJsonString.urlEncode}}&jupiterWeb={{jupiterWebReleaseInfo.asJsonString.urlEncode}}",
  "method": "GET",
  "responseEnabled": true
}
```

**关键点**：
- ✅ 使用 `.asJsonString.urlEncode` 将对象转为 URL 安全的字符串
- ✅ 所有数据通过 URL 参数传递，避免 POST body
- ✅ 一次请求完成，简单高效

#### 2. Apps Script 函数

##### 2.1 复用 `getMessageCurrentTimeWithReleaseInfo(postData)`

**功能**：统一处理 GET 和 POST 请求，查找当前时间需要执行的消息

**参数**：
- `postData.currentTime`: 当前时间（格式：`yyyy-MM-dd HH:mm`）
- `postData.releaseInfo`: 项目进度信息对象（可选）

**两种模式**：
1. **有 releaseInfo**：匹配所有消息（包括 Timeline 触发的消息）
2. **无 releaseInfo 或空对象**：只匹配普通时间触发消息，跳过 Timeline 消息

**流程**：
1. 解析当前时间
2. 调用 `findMessageWithTimelineSupport()` 查找匹配的消息
   - 如果是 Timeline 消息且没有 releaseInfo，自动跳过
   - 如果是普通时间触发消息，正常匹配
3. 返回消息数据或错误信息

**返回**：
```json
{
  "executed": true,
  "messageId": "MSG_001",
  "topic": "消息主题",
  "content": "消息内容",
  "targetType": "private",
  "userName": "esone.qiu",
  "teamId": "",
  "glipEmailAddress": "esone.qiu@reply.ringcentral.glip.com",
  "rowIndex": 5,
  "timestamp": "2025-11-11T06:24:29.177Z"
}
```

#### 3. doGet 和 doPost 函数更新

**doGet（支持 GET 请求）**：
```javascript
// 获取当前时间的消息（支持带或不带 releaseInfo）
if (action === 'getBotMessageCurrentTime') {
  const currentTimeStr = e.parameter.currentTime || '';
  
  // 从 URL 参数接收 releaseInfo（可选）
  const mThor = e.parameter.mThor || '';
  const jupiterDesktop = e.parameter.jupiterDesktop || '';
  const jupiterWeb = e.parameter.jupiterWeb || '';
  
  let releaseInfo = null;
  
  // 如果提供了 releaseInfo 参数，则解析
  if (mThor || jupiterDesktop || jupiterWeb) {
    try {
      releaseInfo = {};
      if (mThor) releaseInfo['mThor'] = JSON.parse(decodeURIComponent(mThor));
      if (jupiterDesktop) releaseInfo['Jupiter desktop'] = JSON.parse(decodeURIComponent(jupiterDesktop));
      if (jupiterWeb) releaseInfo['Jupiter web'] = JSON.parse(decodeURIComponent(jupiterWeb));
      
      Logger.log(`[GET] 接收到 releaseInfo 参数，项目: ${Object.keys(releaseInfo).join(', ')}`);
    } catch (parseError) {
      Logger.log(`[GET] 解析 releaseInfo 失败，使用原方案`);
      releaseInfo = null;
    }
  } else {
    Logger.log(`[GET] 未提供 releaseInfo，只匹配普通时间触发消息`);
  }
  
  // 构建 postData 格式，复用现有函数
  const postData = {
    releaseInfo: releaseInfo || {},
    currentTime: currentTimeStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  };
  
  // 复用 POST 处理函数
  const result = getMessageCurrentTimeWithReleaseInfo(postData);
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**doPost（保持向后兼容）**：
```javascript
// 支持 POST 请求（如果 Jira 将来修复 302 问题）
if (action === 'getBotMessageCurrentTime') {
  const postData = JSON.parse(e.postData.contents);
  const result = getMessageCurrentTimeWithReleaseInfo(postData);
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 部署步骤

### 1. 更新 Google Apps Script 代码

1. 打开 Google Apps Script 项目
2. 复制更新后的 `app-script-template.gs` 代码
3. 粘贴到编辑器
4. 点击 **"保存"**

### 2. 重新部署 Web App

1. 点击 **"部署"** → **"管理部署"**
2. 点击当前部署右侧的 **铅笔图标（编辑）**
3. 在 **"版本"** 下拉框中选择 **"新建版本"**
4. 版本描述：`修复 Jira 302 重定向问题 - 改用 GET 请求`
5. 确认设置：
   - **执行身份**：Me (你的邮箱)
   - **访问权限**：Anyone
6. 点击 **"部署"**
7. 复制新的 Web App URL

### 3. 更新 Jira Automation Rule

使用 Chrome Extension 的配置同步功能：

1. 打开扩展的 **"Scheduled Messages"** 页面
2. 点击 **"Configuration"** 标签
3. 确保 **Web App URL** 是最新的部署 URL
4. 点击 **"Download Jira Rule"** 下载新的 rule JSON
5. 在 Jira Automation 中导入新的 rule，或手动更新现有 rule

### 4. 测试验证

#### 4.1 测试完整请求

在浏览器中访问（替换为你的实际参数）：
```
https://script.google.com/.../exec?action=getBotMessageCurrentTime&currentTime=2025-11-11%2014:30&mThor=%7B%22test%22%3A%22value%22%7D&jupiterDesktop=%7B%7D&jupiterWeb=%7B%7D
```

应该返回消息数据或：
```json
{
  "executed": false,
  "message": "No message found for current time",
  ...
}
```

#### 4.2 在 Jira 中测试

1. 手动触发 Jira Automation Rule
2. 查看 Audit Log，确认 GET 请求成功（状态码 200）
3. 查看 Apps Script 的执行日志（**执行** → **执行记录**）
4. 确认消息被正确处理和发送

## 优势

✅ **避免 302 重定向问题**：使用 GET 方法，Jira Automation 可以正确处理  
✅ **简单高效**：只需一次请求，无需缓存  
✅ **代码复用**：GET 和 POST 复用同一个处理函数 `getMessageCurrentTimeWithReleaseInfo`  
✅ **灵活性强**：支持两种模式（带/不带 releaseInfo）  
✅ **向后兼容**：保留了原有的 POST 处理逻辑（`doPost` 函数）  
✅ **智能跳过**：没有 releaseInfo 时自动跳过 Timeline 消息，避免错误  
✅ **日志完整**：所有操作都有详细的日志记录  
✅ **无状态设计**：Apps Script 不需要存储任何数据，降低复杂度

## 注意事项

### 1. URL 长度限制

- **GET 请求 URL 长度限制**：约 2000-8000 字符（取决于服务器和浏览器）
- **当前 releaseInfo URL 长度**：约 1500-2000 字符
- **完全在限制范围内**：Google Apps Script 支持较长的 URL
- **如果未来数据增长超限**：可以考虑拆分为多个项目参数

### 2. 数据传输

- **编码格式**：使用 `.asJsonString.urlEncode` 确保 URL 安全
- **解码处理**：Apps Script 使用 `decodeURIComponent()` 解码
- **错误处理**：解析失败时 releaseInfo 为空对象，不影响非 Timeline 消息

## 故障排查

### 问题 1：URL 编码问题

**症状**：releaseInfo 数据解析失败

**解决方案**：
1. 确保 Jira 中使用了 `.urlEncode` 进行 URL 编码
2. 检查 Apps Script 中的 `decodeURIComponent()` 调用
3. 查看日志中的原始 URL 参数

### 问题 2：时间解析错误

**症状**：消息时间不匹配

**解决方案**：
1. 检查 Jira 传递的时间格式：`yyyy-MM-dd HH:mm`
2. 确认时区设置正确（Apps Script 使用 `Session.getScriptTimeZone()`）
3. 在日志中查看解析后的时间

## 相关文件

- `app-script-template.gs`: Google Apps Script 主文件
- `jira-rule-template.json`: Jira Automation Rule 模板
- `ScheduledMessagesManager.tsx`: Chrome Extension 配置管理
- `docs/features/scheduled-messages-config-sync.md`: 配置同步文档

## 参考资料

- [Google Apps Script Properties Service](https://developers.google.com/apps-script/reference/properties/properties-service)
- [Jira Automation Smart Values](https://support.atlassian.com/cloud-automation/docs/jira-smart-values-webhooks/)
- [Stack Overflow: Google Apps Script 302 Redirect](https://stackoverflow.com/questions/56521290/request-from-server-to-google-web-app-returns-302-code)
- [Atlassian Community: Jira Automation 302 Redirect](https://community.atlassian.com/forums/Jira-questions/Jira-Automation-Web-Request-to-Confluence-Cloud-returning-HTTP/qaq-p/2665396)

