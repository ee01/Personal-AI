# Jira Automation Groovy Map 格式解析

## 问题描述

Jira Automation 的 `{{webhookResponse.body.asJsonString}}` 返回的不是标准 JSON 格式，而是 **Groovy Map 格式**。

### Jira 返回的格式

```groovy
{currentRelease=25.4.20, currentPhase=Dev, nextPhaseStartDate=11/20/2025}
```

### 标准 JSON 格式

```json
{"currentRelease":"25.4.20","currentPhase":"Dev","nextPhaseStartDate":"11/20/2025"}
```

### 关键差异

| 特性 | Groovy Map | 标准 JSON |
|-----|-----------|----------|
| **键** | 无引号 | 有引号 `"key"` |
| **字符串值** | 无引号 | 有引号 `"value"` |
| **分隔符** | `key=value` | `"key":"value"` |

**结果**：`JSON.parse()` 无法解析 Groovy Map 格式 ❌

## 解决方案

### 方案：在 Apps Script 中添加解析函数

由于旧版 Jira 不支持 `stringify` 功能，我们在 Apps Script 端添加了 `parseJiraJson()` 函数来处理两种格式。

### 核心函数

#### 1. `parseJiraJson(jsonStr)`

**功能**：智能解析 Jira 返回的字符串，兼容两种格式

**支持的格式**：
1. ✅ 标准 JSON：`{"key":"value"}`
2. ✅ POST JSON body 里的标准对象：`{ "releaseInfo": { "currentRelease": "...", "releaseInfo": {...} } }`
3. ✅ Groovy Map：`{key=value}`
4. ✅ 嵌套对象：`{outer={inner=value}}`
5. ✅ 数组：`{list=[item1, item2]}`，包括数组里的嵌套对象和基础类型
6. ✅ 数字：`{count=123}`
7. ✅ 布尔值：`{flag=true}`
8. ✅ null：`{value=null}`
9. ✅ 引号包裹的逗号或等号文本：`{notes="Alpha, Beta = ready"}`

**边界保护**：
- `releaseInfo` 字符串最长 12,000 字符
- Groovy Map / Array 最多 12 层嵌套
- 写入 Apps Script Script Properties 前会检查最终缓存 JSON 是否超过 9KB 单值限制
- 超限时 `cacheReleaseInfo` 会返回明确的 `errorCode`，不会继续写入缓存

**解析逻辑**：

```javascript
function parseJiraJson(jsonStr) {
  // 尝试 1: 标准 JSON 解析
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 标准 JSON 解析失败，尝试 Groovy Map 格式
  }
  
  // 尝试 2: Groovy Map 解析
  // {key1=value1, key2=value2} → {"key1":"value1","key2":"value2"}
  
  // 1. 移除外层大括号
  // 2. 分割键值对（处理嵌套）
  // 3. 解析每个键值对
  //    - 嵌套对象/数组 → 递归解析
  //    - 数字、布尔值、null → 转为原生类型
  //    - 引号包裹文本 → 保留逗号、等号和常见转义
  //    - 其他 → 字符串
  
  return parsedObject;
}
```

#### 2. `splitGroovyMapPairs(content)`

**功能**：智能分割 Groovy Map 的键值对，处理嵌套情况

**挑战**：
```groovy
key1=value1, key2={nested=value}, key3=value3
              ↑           ↑
         不应该在这里分割
```

**解决**：
- 追踪大括号 `{}` 深度
- 追踪方括号 `[]` 深度
- 追踪单/双引号和转义字符
- 只在深度为 0 时，逗号才是分隔符

## 使用示例

### 示例 1：简单对象

**Jira 返回**：
```
{currentRelease=25.4.20, currentPhase=Dev}
```

**解析结果**：
```json
{
  "currentRelease": "25.4.20",
  "currentPhase": "Dev"
}
```

**日志**：
```
标准 JSON 解析失败，尝试 Groovy Map 格式: Unexpected token c in JSON at position 1
Groovy Map 解析成功: {"currentRelease":"25.4.20","currentPhase":"Dev"}
```

### 示例 2：嵌套对象

**Jira 返回**：
```
{project=mThor, releaseInfo={currentRelease=25.4.20, currentPhase=Dev}}
```

**解析结果**：
```json
{
  "project": "mThor",
  "releaseInfo": {
    "currentRelease": "25.4.20",
    "currentPhase": "Dev"
  }
}
```

### 示例 3：混合类型

**Jira 返回**：
```
{name=Project, version=1.0, active=true, count=42, tags=[tag1, tag2], value=null}
```

**解析结果**：
```json
{
  "name": "Project",
  "version": 1.0,
  "active": true,
  "count": 42,
  "tags": ["tag1", "tag2"],
  "value": null
}
```

### 示例 4：数组中的对象和带逗号文本

**Jira 返回**：
```
{blockers=[{key=MTR-1, active=true}, "Alpha, Beta = ready"]}
```

**解析结果**：
```json
{
  "blockers": [
    { "key": "MTR-1", "active": true },
    "Alpha, Beta = ready"
  ]
}
```

## 在代码中的应用

### doGet 函数中的使用

```javascript
// 从 URL 参数接收 releaseInfo
const mThor = e.parameter.mThor || '';

let releaseInfo = {};
if (mThor) {
  // Apps Script 的 e.parameter 已经完成 form-urlencoded 解码
  releaseInfo['mThor'] = parseJiraJson(mThor);
  
  Logger.log(`解析成功: ${JSON.stringify(releaseInfo['mThor'])}`);
}
```

### Jira Rule 配置（正式链路）

```json
{
  "url": "{{WEB_APP_URL}}?action=cacheReleaseInfo",
  "method": "POST",
  "customBody": "{\n  \"project\": \"mThor\",\n  \"releaseInfo\": {{mThorReleaseInfo.asJsonString}}\n}"
}
```

**关键点**：
- ✅ 当前正式链路已升级为“双 rule + POST JSON”模式：Timeline Sync Rule 先调用 `cacheReleaseInfo`，Executor Rule 再调用 `getBotMessageCurrentTime`
- ✅ 旧版 inline 参数写法仍然被 Apps Script 兼容，用于旧 rule 或排障测试
- ✅ Apps Script 端自动处理 Groovy Map 字符串；如果 Jira 将来直接传标准 JSON 对象，`cacheReleaseInfo` 也会按同一 schema 校验后缓存
- ✅ `cacheReleaseInfo` 成功响应会返回 `milestoneCount` / `milestoneKeys`，方便在 Jira Audit Log 排障，但不会暴露具体日期
- ✅ 如果将来 Jira 升级支持标准 JSON，代码也能兼容

## 设计原则

- 优先让上游输出标准 JSON：Atlassian 当前提供 `asJsonString`、`jsonStringToObject()` 等 JSON Smart Value 函数；能用标准 JSON 时不依赖兜底解析。
- 兜底解析只服务于 Jira/Java Map 风格的 `key=value` 响应：解析器会跟踪嵌套、数组、单双引号和常见转义字符。
- Timeline 缓存入口是 schema-first：无论输入是字符串还是对象，只有包含 `releaseInfo` 对象且至少有一个 Milestone 的项目数据才会写入缓存。
- 兜底解析是 bounded parser：对 payload 长度和嵌套深度设硬限制，避免畸形 webhook 输入拖慢 Apps Script 或生成难排查的缓存错误。
- Timeline 缓存写入前做 PropertiesService 9KB 单值预检：超过限制返回 `TIMELINE_CACHE_TOO_LARGE`，Jira Audit Log 会看到字节数、Milestone 数量和安全的 key 样本，而不是模糊的 `setProperty` 异常。
- 正式 `cacheReleaseInfo` 入口使用严格解析：解析失败返回 `PARSE_RELEASE_INFO_FAILED`，schema 不匹配返回 `INVALID_RELEASE_INFO_SCHEMA`，便于直接在 Jira Audit Log 排障。
- 旧 inline 兼容路径仍保持容错：解析失败会安全返回 `{}` 并跳过 Timeline 消息，避免旧 rule 阻断普通消息执行。

## 业内调研结论

- Atlassian Automation 已提供 `asJsonString`、`jsonStringToObject()` 和 Send web request response data，正式链路应持续优先走 POST JSON，而不是依赖 `{key=value}` 字符串兜底。
- Zapier、n8n 等自动化产品都会把 payload type、raw body、response data 显式暴露给用户；本功能的排障体验也应让 Jira Audit Log 直接看到支持格式、限制和下一步处理建议。
- Google Apps Script `PropertiesService` 的单 value 限制是 9KB；把大 payload 直接塞进 Script Properties 前必须先做大小诊断，否则用户只能看到底层配额异常。
- Robustness Principle / LangSec 相关讨论提醒：过度宽松的输入解析会累积互操作和安全风险。因此这里保留兼容解析，但用 schema 校验、长度限制、嵌套限制和安全诊断收口。

## 测试

### 手动测试

可以在 Google Apps Script 编辑器中测试：

```javascript
function testParseJiraJson() {
  // 测试 1: Groovy Map 格式
  const groovyMap = '{currentRelease=25.4.20, currentPhase=Dev}';
  const result1 = parseJiraJson(groovyMap);
  Logger.log(`测试 1: ${JSON.stringify(result1)}`);
  // 预期: {"currentRelease":"25.4.20","currentPhase":"Dev"}
  
  // 测试 2: 标准 JSON
  const standardJson = '{"currentRelease":"25.4.20","currentPhase":"Dev"}';
  const result2 = parseJiraJson(standardJson);
  Logger.log(`测试 2: ${JSON.stringify(result2)}`);
  // 预期: {"currentRelease":"25.4.20","currentPhase":"Dev"}
  
  // 测试 3: 嵌套对象
  const nested = '{project=mThor, info={version=1.0, active=true}}';
  const result3 = parseJiraJson(nested);
  Logger.log(`测试 3: ${JSON.stringify(result3)}`);
  // 预期: {"project":"mThor","info":{"version":1.0,"active":true}}
  
  // 测试 4: 数组
  const withArray = '{name=Project, tags=[tag1, tag2, tag3]}';
  const result4 = parseJiraJson(withArray);
  Logger.log(`测试 4: ${JSON.stringify(result4)}`);
  // 预期: {"name":"Project","tags":["tag1","tag2","tag3"]}
}
```

### 在浏览器中测试

访问以下 URL（替换为你的实际 URL）：

```
https://script.google.com/.../exec
  ?action=getBotMessageCurrentTime
  &currentTime=2025-11-11%2014:30
  &mThor=%7BcurrentRelease%3D25.4.20%2C%20currentPhase%3DDev%7D
```

URL 编码说明：
- `{` → `%7B`
- `}` → `%7D`
- `=` → `%3D`
- `,` → `%2C`
- 空格 → `%20`

## 常见问题

### Q1: 为什么不在 Jira 端修复？

**A**: 新版 Atlassian Automation 已有 JSON Smart Value 函数，但当前链路需要兼容旧 rule、Data Center/混合环境和 `webhookResponse.body` 被渲染成 `{key=value}` 的情况。Apps Script 端保留兜底解析，可以让升级过程不中断。

当前实现也接受 `cacheReleaseInfo` 的标准 JSON 对象 body，因此将来上游能稳定输出对象时，只需要替换 Jira Rule 的 smart value 表达式，不需要再改 Apps Script 解析入口。

### Q2: 性能影响如何？

**A**: 
- 标准 JSON：直接 `JSON.parse()`，毫秒级
- Groovy Map：需要字符串处理，约 5-10ms（取决于数据大小）
- 对于当前数据量（几KB），性能影响可忽略

### Q3: 支持哪些数据类型？

**A**: 
- ✅ 字符串：`{key=value}` → `"value"`
- ✅ 数字：`{count=123}` → `123`
- ✅ 布尔值：`{flag=true}` → `true`
- ✅ null：`{value=null}` → `null`
- ✅ 数组：`{list=[a, b, {x=1}]}` → `["a", "b", {"x": 1}]`
- ✅ 嵌套对象：`{outer={inner=val}}` → `{"outer":{"inner":"val"}}`
- ✅ 引号文本：`{notes="Alpha, Beta = ready"}` → `"Alpha, Beta = ready"`

### Q4: 有哪些限制？

**A**:
- ⚠️ 无引号字符串中如果包含逗号，Groovy Map 字符串本身无法可靠区分“文本逗号”和“字段分隔符”
- ⚠️ 如字段可能包含逗号、等号或换行，优先让上游输出标准 JSON，或者至少让该字段以单/双引号包裹
- ⚠️ `releaseInfo` 最长 12,000 字符，Groovy Map / Array 最多 12 层嵌套；超过限制会拒绝缓存并返回可读错误
- ⚠️ Apps Script Script Properties 单 value 只有 9KB，最终 Timeline 缓存 JSON 超限会返回 `TIMELINE_CACHE_TOO_LARGE`；需要减少同步字段或改用外部缓存

### Q5: 如果解析失败会怎样？

**A**: 
1. `cacheReleaseInfo` 会拒绝写入缓存，并返回 `success:false`
2. Jira Audit Log 可看到 `errorCode`、安全的 `parseError` 或大小诊断、期望结构、支持格式、限制和 `nextAction`，但不会返回具体日期值
3. 旧 inline 兼容路径返回空对象 `{}`，Timeline 消息会被跳过
4. 普通定时消息不受影响

## 相关文件

- `app-script-template.gs`: 包含 `parseJiraJson()` 和 `splitGroovyMapPairs()` 函数
- `jira-rule-template.json`: Jira Automation Rule 配置
- `src/scheduled-messages/__tests__/timelineSyncRule.test.ts`: Apps Script 模板级解析验证
- `jira-302-redirect-fix.md`: 整体解决方案文档

## 参考资料

- [Jira Automation Smart Values](https://support.atlassian.com/cloud-automation/docs/jira-smart-values-reference/)
- [Jira Smart Values - JSON functions](https://support.atlassian.com/cloud-automation/docs/jira-smart-values-json-functions/)
- [Jira Smart Values - text fields](https://support.atlassian.com/cloud-automation/docs/jira-smart-values-text-fields/)
- [Jira Automation actions - Send web request](https://support.atlassian.com/cloud-automation/docs/jira-automation-actions/)
- [n8n Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Zapier Webhooks - payload type](https://help.zapier.com/hc/en-us/articles/8496326446989-Send-webhooks-in-Zaps)
- [Apps Script quotas - Properties value size](https://developers.google.com/apps-script/guides/services/quotas)
- [The Robustness Principle Reconsidered](https://queue.acm.org/detail.cfm?id=1999945)
- [Language-theoretic Security](https://langsec.org/)
- [Google Apps Script Logger](https://developers.google.com/apps-script/reference/base/logger)
- [Groovy Map vs JSON](https://stackoverflow.com/questions/28341798/convert-groovy-map-to-json)
