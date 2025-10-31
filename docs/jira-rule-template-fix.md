# Jira Automation Rule 模板修复说明

## 问题描述
在配置 Bot 推送时，创建 Jira Automation rule 报错 500。通过对比手动创建的可工作的 rule，发现模板存在以下问题。

## 修复内容

### 1. `jira-rule-template.json` 修改

#### 修改 0：添加 Issue 过滤条件（重要！）
在第一个 webhook 调用之前，添加了一个 `CONDITION` 来过滤 issue：
- **类型**: `jira.issue.condition`
- **条件**: 检查自定义字段 `customfield_10050`（URL 类型）不包含 `"https://jira-"`
- **作用**: 确保规则只在特定的 issue 上执行，避免在不该执行的 issue 上触发

```json
{
  "component": "CONDITION",
  "schemaVersion": 3,
  "type": "jira.issue.condition",
  "value": {
    "selectedField": {
      "type": "ID",
      "value": "customfield_10050"
    },
    "selectedFieldType": "com.atlassian.jira.plugin.system.customfieldtypes:url",
    "comparison": "NOT_CONTAIN",
    "compareValue": {
      "type": "VALUE",
      "value": "https://jira-",
      "multiValue": false
    }
  }
}
```

#### 修改 1：executionMode
- **原值**: `"executionMode": "nosearch"`
- **新值**: `"executionMode": "jql"`
- **原因**: Jira 要求 scheduled JQL trigger 必须使用 `jql` 模式

#### 修改 2：条件块类型统一
- **原结构**: 
  - private: `if` block
  - group: `elseif` block  
  - AI GET: `elseif` block
  - AI POST: `else` block
- **新结构**: 所有条件块都改为独立的 `if` block
- **原因**: Jira Automation 的并发条件判断需要独立的 if 块，而不是 if-elseif-else 链

#### 修改 3：AI URL 分离
- **原值**: `"url": "{{webhookResponse.body.aiEndpoint}}"`
- **新值**: `"url": "https://{{webhookResponse.body.aiHost}}/{{webhookResponse.body.aiUri}}"`
- **原因**: Jira Automation 对 URL 格式有限制，需要将 host 和 URI 路径分开

#### 修改 4：AI POST 添加日志记录
- 在 AI POST 请求后添加了 `codebarrel.action.log` 组件
- 记录执行成功的 URL：`{{WEB_APP_URL}}?action=markBotMessageExecuted&messageId={{messageId}}&success=true`

### 2. `app-script-template.gs` 修改

#### 修改 `parseAIEndpoint` 函数
```javascript
// 原返回值
{ method: 'GET'|'POST', url: string }

// 新返回值  
{ method: 'GET'|'POST', host: string, uri: string, url: string }
```

**功能增强**:
- 自动提取协议（http/https）
- 分离 host 和 URI 路径部分
- 例如：`POST https://dify.int.rclabenv.com/v1/chat-messages`
  - host: `dify.int.rclabenv.com`
  - uri: `v1/chat-messages`
  - method: `POST`

#### 修改 `parseAIHeaders` 函数（重要！）

**背景**：Jira Automation 不支持在 header name 中使用变量，只能使用固定的字符串作为 header 名称。

**解决方案**：改为固定的 7 个常用 headers，用户只需填写 value。

```javascript
// 原返回值（动态 name）
{
  name1: '...', value1: '...',
  name2: '...', value2: '...',
  // ...
}

// 新返回值（固定 name）
{
  Authorization: '...',        // 认证 header
  ContentType: '...',          // 内容类型（默认 application/json）
  Accept: '...',               // 接受类型（默认 */*）
  XAPIKey: '...',              // API 密钥
  UserAgent: '...',            // 用户代理（默认 PersonalAI-ScheduledMessages/1.0）
  XRequestID: '...',           // 请求追踪 ID
  XCustomHeader: '...'         // 自定义 header
}
```

**默认值策略**：
- `ContentType`: 默认 `application/json`（避免某些 API 报错）
- `Accept`: 默认 `*/*`（接受所有响应类型）
- `UserAgent`: 默认 `PersonalAI-ScheduledMessages/1.0`
- 其他字段：默认空字符串

**Sheet 存储格式**（保持不变）：
```
AI_Headers 列内容：
Authorization: Bearer app-xxx
Content-Type: application/json
Accept: application/json
```

#### 修改 `getBotMessageDataCurrentTime` 函数
返回值中将完整 URL 拆分为 `aiHost` 和 `aiUri`：
```javascript
return {
  executed: true,
  messageId: messageId,
  targetType: 'api',
  aiEndpoint: endpointInfo.url,  // 完整 URL（保留，兼容旧逻辑）
  aiHost: endpointInfo.host,     // 主机名
  aiUri: endpointInfo.uri,       // URI 路径部分
  aiMethod: endpointInfo.method,
  aiHeaders: headersObj,          // 固定字段对象
  aiBody: bodyStr,
  // ...
};
```

## 关键变化对比

### 手动创建的 Rule vs 原模板

| 项目 | 手动创建的 Rule | 原模板 | 已修复 |
|------|----------------|--------|--------|
| Issue 过滤条件 | 有 `customfield_10050` 不包含 `https://jira-` | 无 | ✅ |
| executionMode | `jql` | `nosearch` | ✅ |
| 条件块结构 | 4 个独立的 `if` block | `if-elseif-else` 链 | ✅ |
| AI URL 格式 | `https://{{aiHost}}/{{aiUri}}` | `{{aiEndpoint}}` | ✅ |
| AI Headers | 固定 7 个 header 名称 | 动态 name/value 对 | ✅ |
| AI POST 日志 | 有 `codebarrel.action.log` | 无 | ✅ |

## 测试建议

### 测试步骤
1. 清理旧配置（如果存在）
   - 删除 Jira 中旧的 Automation rule
   - 清除 `chrome.storage.local` 中的 `scheduledMessagesConfig.botExecutor`

2. 重新配置 Bot 推送
   - 打开定时消息管理器
   - 点击"配置 Bot"
   - 输入正确的 Jira URL 和 Project Key
   - 验证是否成功创建 rule

3. 测试三种消息类型
   - **Private 消息**: 发送给单个用户
   - **Group 消息**: 发送到群组
   - **AI 消息**: 测试 GET 和 POST 两种方法

### 验证要点
- ✅ 创建 rule 时不再报错 500
- ✅ Rule 在 Jira Automation 中正常显示
- ✅ 每分钟自动执行
- ✅ AI 消息的 URL 能正确拼接（检查 Jira Automation 日志）
- ✅ 三种消息类型都能正常推送

## 相关文件
- `src/scheduled-messages/jira-rule-template.json` - Rule 模板
- `src/scheduled-messages/app-script-template.gs` - AppScript 代码
- `src/scheduled-messages/JiraAutomationService.ts` - 创建 rule 的服务类

## AI Headers 支持的字段

由于 Jira Automation 的限制，header name 必须是固定字符串，我们支持以下 7 个常用 headers：

| Header 名称 | 用途 | 默认值 | 示例 |
|------------|------|--------|------|
| `Authorization` | API 认证 | 空 | `Bearer app-xxx` |
| `Content-Type` | 内容类型 | `application/json` | `application/json` |
| `Accept` | 接受的响应类型 | `*/*` | `application/json` |
| `X-API-Key` | API 密钥认证 | 空 | `sk-xxxxxxx` |
| `User-Agent` | 用户代理 | `PersonalAI-ScheduledMessages/1.0` | 自定义值 |
| `X-Request-ID` | 请求追踪 | 空 | `req-12345` |
| `X-Custom-Header` | 自定义 header | 空 | 任意值 |

**使用方法**（在 Sheet 的 `AI_Headers` 列中）：
```
Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y
Content-Type: application/json
Accept: application/json
```

## 注意事项
1. 修改后需要重新创建 Automation rule，旧的 rule 不会自动更新
2. AI Endpoint 的输入格式保持不变（`POST https://example.com/api`），解析逻辑会自动处理
3. 确保 Jira 中有至少一个 issue（因为 executionMode 是 `jql`）
4. AI Headers 只支持上述 7 个固定名称，其他 header 名称将被忽略
5. 即使不填写某个 header，也会以默认值或空字符串发送（不会影响请求）

