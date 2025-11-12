# 最终方案总结：Jira 302 重定向问题

## 🎯 核心设计

### 统一处理函数 + 双模式支持

```
┌─────────────────────────────────────────────────┐
│  getMessageCurrentTimeWithReleaseInfo(postData) │  ← 统一处理函数
│  - 复用代码，减少重复                           │
│  - 支持 GET 和 POST 两种请求方式                │
│  - 支持带/不带 releaseInfo 两种模式             │
└─────────────────────────────────────────────────┘
          ↑                         ↑
          │                         │
     doGet (GET)              doPost (POST)
          │                         │
   解析 URL 参数            解析 JSON body
   构建 postData           直接使用 postData
```

## 📊 两种使用模式

### 模式 1：带 releaseInfo（完整功能）

**用途**：匹配所有消息，包括 Timeline 触发的消息

**URL 格式**：
```
{{WEB_APP_URL}}?action=getBotMessageCurrentTime
  &currentTime={{now}}
  &mThor={{mThorReleaseInfo.asJsonString.urlEncode}}
  &jupiterDesktop={{jupiterDesktopReleaseInfo.asJsonString.urlEncode}}
  &jupiterWeb={{jupiterWebReleaseInfo.asJsonString.urlEncode}}
```

**处理流程**：
```
1. Jira 获取内网 releaseInfo
2. Jira 通过 URL 参数传递给 Apps Script
3. Apps Script 解析 releaseInfo
4. 查找消息时：
   - Timeline 消息：使用 releaseInfo 匹配日期
   - 普通消息：使用时间匹配
5. 返回匹配的消息
```

### 模式 2：不带 releaseInfo（简化模式）

**用途**：只匹配普通时间触发的消息，跳过 Timeline 消息

**URL 格式**：
```
{{WEB_APP_URL}}?action=getBotMessageCurrentTime
  &currentTime={{now}}
```

**处理流程**：
```
1. Jira 直接调用（不获取 releaseInfo）
2. Apps Script 检测没有 releaseInfo
3. 查找消息时：
   - Timeline 消息：自动跳过（因为没有 releaseInfo）
   - 普通消息：使用时间匹配
4. 返回匹配的消息
```

## 🔧 技术实现

### 1. doGet 函数（GET 请求处理）

```javascript
if (action === 'getBotMessageCurrentTime') {
  const currentTimeStr = e.parameter.currentTime || '';
  
  // 从 URL 参数接收 releaseInfo（可选）
  const mThor = e.parameter.mThor || '';
  const jupiterDesktop = e.parameter.jupiterDesktop || '';
  const jupiterWeb = e.parameter.jupiterWeb || '';
  
  let releaseInfo = null;
  
  // 如果提供了参数，则解析
  if (mThor || jupiterDesktop || jupiterWeb) {
    try {
      releaseInfo = {};
      if (mThor) releaseInfo['mThor'] = JSON.parse(decodeURIComponent(mThor));
      if (jupiterDesktop) releaseInfo['Jupiter desktop'] = JSON.parse(decodeURIComponent(jupiterDesktop));
      if (jupiterWeb) releaseInfo['Jupiter web'] = JSON.parse(decodeURIComponent(jupiterWeb));
      
      Logger.log(`[GET] 接收到 releaseInfo，项目: ${Object.keys(releaseInfo).join(', ')}`);
    } catch (parseError) {
      Logger.log(`[GET] 解析失败，使用原方案`);
      releaseInfo = null;
    }
  } else {
    Logger.log(`[GET] 未提供 releaseInfo，只匹配普通消息`);
  }
  
  // 构建统一格式，复用处理函数
  const postData = {
    releaseInfo: releaseInfo || {},
    currentTime: currentTimeStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  };
  
  // ✅ 复用统一处理函数
  const result = getMessageCurrentTimeWithReleaseInfo(postData);
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. doPost 函数（POST 请求处理，向后兼容）

```javascript
if (action === 'getBotMessageCurrentTime') {
  // 解析 POST 数据
  const postData = JSON.parse(e.postData.contents);
  Logger.log(`[POST] 接收到数据: ${JSON.stringify(postData).substring(0, 200)}...`);
  
  // ✅ 复用统一处理函数
  const result = getMessageCurrentTimeWithReleaseInfo(postData);
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. 智能跳过 Timeline 消息

在 `findMessageWithTimelineSupport` 函数中：

```javascript
for (const msg of messages) {
  const rowData = msg.data;
  const isTimeline = !rowData.Schedule_Date && rowData.Timeline_Milestone;
  
  let matches = false;
  
  if (isTimeline) {
    // Timeline 消息需要 releaseInfo
    const hasReleaseInfo = releaseInfo && Object.keys(releaseInfo).length > 0;
    
    if (hasReleaseInfo) {
      // ✅ 有 releaseInfo，正常匹配
      matches = checkTimelineTrigger(rowData, now, releaseInfo);
    } else {
      // ⏭️ 没有 releaseInfo，跳过此消息
      Logger.log(`跳过 Timeline 消息（未提供 releaseInfo）: ${rowData.ID}`);
      continue;
    }
  } else {
    // ✅ 普通消息，使用时间匹配
    matches = shouldExecuteNow(rowData, now, messageType);
  }
  
  if (matches) {
    return message; // 返回匹配的消息
  }
}
```

## 📈 优势对比

| 特性 | 旧方案 (POST) | 新方案 (GET) |
|-----|--------------|-------------|
| **避免 302** | ❌ | ✅ |
| **代码复用** | ❌ 分散 | ✅ 统一函数 |
| **POST 支持** | ✅ | ✅ 保留 |
| **GET 支持** | ❌ | ✅ 新增 |
| **灵活性** | 单一模式 | ✅ 双模式 |
| **智能跳过** | ❌ | ✅ 自动跳过 Timeline |
| **维护成本** | 高 | ✅ 低（代码集中） |

## 🎯 使用建议

### 推荐配置

**完整功能的 Jira Rule**（带 releaseInfo）：
```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime&currentTime={{now.format(\"yyyy-MM-dd HH:mm\").urlEncode}}&mThor={{mThorReleaseInfo.asJsonString.urlEncode}}&jupiterDesktop={{jupiterDesktopReleaseInfo.asJsonString.urlEncode}}&jupiterWeb={{jupiterWebReleaseInfo.asJsonString.urlEncode}}",
  "method": "GET",
  "responseEnabled": true
}
```

**简化版 Jira Rule**（不带 releaseInfo）：
```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime&currentTime={{now.format(\"yyyy-MM-dd HH:mm\").urlEncode}}",
  "method": "GET",
  "responseEnabled": true
}
```

### 何时使用哪种模式？

| 场景 | 使用模式 | 原因 |
|-----|---------|------|
| 有 Timeline 消息需要发送 | 模式 1（带 releaseInfo） | 需要项目进度信息匹配日期 |
| 只有普通时间触发消息 | 模式 2（不带 releaseInfo） | 简化请求，减少 URL 长度 |
| 内网 API 不可用 | 模式 2（不带 releaseInfo） | 无法获取 releaseInfo |
| 测试环境 | 模式 2（不带 releaseInfo） | 快速测试普通消息 |

## 📝 日志示例

### 模式 1（带 releaseInfo）日志：

```
[GET] 接收到 releaseInfo 参数，项目: mThor, Jupiter desktop, Jupiter web
查找当前时间的消息: 2025-11-11 14:30
匹配消息: MSG_001 - Timeline 提醒 (优先级: 1)
```

### 模式 2（不带 releaseInfo）日志：

```
[GET] 未提供 releaseInfo，使用原方案（不匹配 Timeline 消息）
查找当前时间的消息: 2025-11-11 14:30
跳过 Timeline 消息（未提供 releaseInfo）: MSG_001 - Timeline 提醒
匹配消息: MSG_002 - 每日提醒 (优先级: 2)
```

## 🚀 部署清单

- [x] 更新 `app-script-template.gs`
  - [x] 修改 `doGet` 支持可选的 releaseInfo
  - [x] 保留 `doPost` 向后兼容
  - [x] 删除重复的 `getBotMessageCurrentTime` 函数
  - [x] 更新 `findMessageWithTimelineSupport` 智能跳过
- [x] 更新 `jira-rule-template.json`
  - [x] 修改为 GET 请求
  - [x] 添加 releaseInfo URL 参数
- [x] 更新文档
  - [x] `jira-302-redirect-fix.md`
  - [x] `solution-comparison.md`
  - [x] `final-solution-summary.md`

## ✅ 总结

**最终方案特点**：
1. ✅ **避免 302 重定向**：使用 GET 请求
2. ✅ **代码复用**：GET 和 POST 共用 `getMessageCurrentTimeWithReleaseInfo`
3. ✅ **双模式支持**：带/不带 releaseInfo 都能工作
4. ✅ **智能跳过**：没有 releaseInfo 时自动跳过 Timeline 消息
5. ✅ **向后兼容**：保留 POST 支持
6. ✅ **维护性强**：代码集中，易于维护

**核心改进**：
- 从 POST 改为 GET，解决 302 问题
- 统一处理函数，减少代码重复
- 灵活支持两种模式，适应不同场景
- 智能判断，自动跳过不适用的消息

