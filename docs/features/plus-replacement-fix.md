# GET 请求中 + 替换为空格的问题修复

## 问题描述

当使用 GET 请求传递 Groovy Map 数据时，Jira Automation 的 `urlEncode` 会把**空格**替换成 **`+`**，但是 `decodeURIComponent()` 函数**不会**把 `+` 还原为空格。

### 问题示例

**Jira 原始数据**：
```
{currentPhase=Regression, releaseInfo={Product DF=}}
```

**经过 urlEncode 后**：
```
{currentPhase=Regression,+releaseInfo={Product+DF=}}
```

**decodeURIComponent 后**（问题）：
```
{currentPhase=Regression,+releaseInfo={Product+DF=}}
                              ↑ 仍然是 +，不是空格
```

**期望结果**：
```
{currentPhase=Regression, releaseInfo={Product DF=}}
                              ↑ 应该是空格
```

## 解决方案

### 1. 在 doGet 函数中替换

在调用 `parseJiraJson` 之前，先将 `+` 替换为空格：

```javascript
// GET 请求中，urlEncode 会把空格替换成 +，但 decodeURIComponent 不会还原
// 需要手动将 + 替换回空格
if (mThor) {
  const decoded = decodeURIComponent(mThor).replace(/\+/g, ' ');
  releaseInfo['mThor'] = parseJiraJson(decoded, true); // true 表示来自 GET 请求
}
```

### 2. 在 parseJiraJson 函数中双重保险

在 `parseJiraJson` 函数内部也处理 `+` 替换：

```javascript
function parseJiraJson(jsonStr, isFromGet) {
  let str = jsonStr.trim();
  
  // GET 请求中，urlEncode 会把空格替换成 +，需要先替换回来
  if (isFromGet) {
    str = str.replace(/\+/g, ' ');
  }
  
  // ... 解析逻辑 ...
  
  // 在处理键值对时，也要替换
  if (isFromGet) {
    key = key.replace(/\+/g, ' ');
    value = value.replace(/\+/g, ' ');
  }
  
  // 递归解析嵌套对象时，传递 isFromGet 标志
  if (value.startsWith('{') && value.endsWith('}')) {
    result[key] = parseJiraJson(value, isFromGet);
  }
}
```

## 实际案例

### 用户提供的示例

**输入**（带 `+`）：
```
{currentRelease=25.4.20,+currentPhase=Regression,+releaseInfo={=M/J+Release+25.4.20,+CF=11/13/2025,+Product+DF=}}
```

**解析后**：
```json
{
  "currentRelease": "25.4.20",
  "currentPhase": "Regression",  // ✅ + 被替换为空格
  "releaseInfo": {
    "": "M/J Release 25.4.20",   // ✅ + 被替换为空格
    "CF": "11/13/2025",
    "Product DF": ""             // ✅ + 被替换为空格
  }
}
```

## 关键点

### 1. 双重处理

- **第一层**：在 `doGet` 中，`decodeURIComponent` 后立即替换 `+`
- **第二层**：在 `parseJiraJson` 中，再次替换（作为保险）

### 2. 递归处理

嵌套对象中的 `+` 也需要替换，通过传递 `isFromGet` 标志实现递归处理。

### 3. 键和值都要处理

```javascript
// 键中的 + 也要替换
key = key.replace(/\+/g, ' ');  // "Product+DF" → "Product DF"

// 值中的 + 也要替换
value = value.replace(/\+/g, ' ');  // "M/J+Release" → "M/J Release"
```

## 测试

### 测试用例 8：GET 请求中的 + 替换

```javascript
const groovyMapWithPlus = '{currentRelease=25.4.20,+currentPhase=Regression,+releaseInfo={=M/J+Release+25.4.20}}';
const result = parseJiraJson(groovyMapWithPlus, true);

// 验证
result.currentPhase === "Regression"  // ✅ 不是 "+Regression"
result.releaseInfo[''] === "M/J Release 25.4.20"  // ✅ 不是 "M/J+Release+25.4.20"
```

### 测试用例 9：实际复杂格式

基于用户提供的完整示例，测试包含：
- 多个带 `+` 的键：`Product+DF`, `Rollout+100%`, `Kira's+group+DF`
- 嵌套对象中的 `+`
- 空值处理

## 向后兼容

### POST 请求不受影响

- POST 请求不传递 `isFromGet` 参数（默认为 `undefined`）
- `if (isFromGet)` 为 `false`，不会替换 `+`
- POST 请求的数据中，`+` 保持原样（因为 POST body 中 `+` 就是 `+`，不是空格）

### 标准 JSON 格式不受影响

- 标准 JSON 格式中，空格会被编码为 `%20`，不是 `+`
- `decodeURIComponent` 会正确还原为空格
- 不需要额外处理

## 相关代码位置

- **doGet 函数**：第 554-567 行
- **parseJiraJson 函数**：第 1614-1710 行
- **测试函数**：第 1824-1842 行（测试用例 8 和 9）

## 总结

✅ **问题已解决**：
- GET 请求中的 `+` 会被正确替换为空格
- 嵌套对象中的 `+` 也会被处理
- 键和值中的 `+` 都会被替换
- POST 请求不受影响，向后兼容

✅ **双重保险**：
- 在 `doGet` 中替换一次
- 在 `parseJiraJson` 中再替换一次（递归处理嵌套）

✅ **测试覆盖**：
- 简单格式测试
- 复杂嵌套格式测试
- 实际 Jira 返回格式测试

