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
2. ✅ Groovy Map：`{key=value}`
3. ✅ 嵌套对象：`{outer={inner=value}}`
4. ✅ 数组：`{list=[item1, item2]}`
5. ✅ 数字：`{count=123}`
6. ✅ 布尔值：`{flag=true}`
7. ✅ null：`{value=null}`

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
  //    - 嵌套对象 → 递归解析
  //    - 数组 → 分割元素
  //    - 数字 → parseFloat
  //    - 布尔值 → true/false
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

## 在代码中的应用

### doGet 函数中的使用

```javascript
// 从 URL 参数接收 releaseInfo
const mThor = e.parameter.mThor || '';

let releaseInfo = {};
if (mThor) {
  // ✅ 使用 parseJiraJson 替代 JSON.parse
  releaseInfo['mThor'] = parseJiraJson(decodeURIComponent(mThor));
  
  Logger.log(`解析成功: ${JSON.stringify(releaseInfo['mThor'])}`);
}
```

### Jira Rule 配置（兼容旧链路）

```json
{
  "url": "{{WEB_APP_URL}}?action=getBotMessageCurrentTime&mThor={{mThorReleaseInfo.asJsonString.urlEncode}}",
  "method": "GET"
}
```

**关键点**：
- ✅ 这套 inline 参数写法仍然被 Apps Script 兼容，用于旧 rule 或排障测试
- ✅ 当前正式链路已升级为“双 rule”模式：Timeline Sync Rule 先调用 `cacheReleaseInfo`，Executor Rule 再调用 `getBotMessageCurrentTime`
- ✅ Apps Script 端自动处理 Groovy Map 格式
- ✅ 如果将来 Jira 升级支持标准 JSON，代码也能兼容

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

**A**: 旧版 Jira Automation 不支持 `stringify` 功能，无法输出标准 JSON。升级 Jira 成本高，不如在 Apps Script 端兼容处理。

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
- ✅ 数组：`{list=[a, b]}` → `["a", "b"]`
- ✅ 嵌套对象：`{outer={inner=val}}` → `{"outer":{"inner":"val"}}`

### Q4: 有哪些限制？

**A**:
- ⚠️ 不支持字符串中包含 `=` 或 `,` 的情况（如果 Jira 返回这种数据，需要转义）
- ⚠️ 不支持特殊字符转义（如 `\n`、`\t`），但实际使用中很少遇到

### Q5: 如果解析失败会怎样？

**A**: 
1. 捕获异常，记录日志
2. 返回空对象 `{}`
3. 继续执行，使用原方案（跳过 Timeline 消息）
4. 不会导致整个流程失败

## 相关文件

- `app-script-template.gs`: 包含 `parseJiraJson()` 和 `splitGroovyMapPairs()` 函数
- `jira-rule-template.json`: Jira Automation Rule 配置
- `jira-302-redirect-fix.md`: 整体解决方案文档

## 参考资料

- [Jira Automation Smart Values](https://support.atlassian.com/cloud-automation/docs/jira-smart-values-reference/)
- [Google Apps Script Logger](https://developers.google.com/apps-script/reference/base/logger)
- [Groovy Map vs JSON](https://stackoverflow.com/questions/28341798/convert-groovy-map-to-json)
