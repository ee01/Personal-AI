# Google Auth Token 使用指南

## 概述

项目中所有 Google OAuth token 的获取已统一到 `src/utils/googleAuth.ts`。

**迁移已完成**：所有 `chrome.identity.getAuthToken` 直接调用已迁移到共用方法。

## 核心方法

### 1. `getGoogleAuthToken()` - 会弹窗的授权方法

**默认行为**：先尝试使用缓存的 token，如果没有缓存则弹出授权窗口

**适用场景**：用户主动操作（点击按钮、提交表单等）

```typescript
import {
  GOOGLE_AUTH_SCOPE_SETS,
  getGoogleAuthToken,
} from './utils/googleAuth';

// 基础用法
const token = await getGoogleAuthToken({
  caller: 'popup.analyzeSlides',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SLIDES,
});
if (!token) {
  alert('获取授权失败');
  return;
}
```

**参数**：
- `caller`: 调用者标识（用于日志追踪）
- `forceRefresh`: 是否先清除旧 token（默认 false）
- `silent`: 是否静默（不记录日志，默认 false）
- `scopes`: 当前功能实际需要的 scopes；传入后覆盖 manifest 全局 scopes
- `requiredScopes`: 必须授予的 scopes；默认与 `scopes` 相同

### 2. `getGoogleAuthTokenSilently()` - 静默授权方法

**默认行为**：只使用缓存的 token，如果没有缓存则返回 null（不弹窗）

**适用场景**：后台自动任务、页面初始化等不应打扰用户的场景

```typescript
import {
  GOOGLE_AUTH_SCOPE_SETS,
  getGoogleAuthTokenSilently,
} from './utils/googleAuth';

// 基础用法
const token = await getGoogleAuthTokenSilently({
  caller: 'background.autoUpdate',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
});
if (!token) {
  console.log('无缓存 token，跳过自动任务');
  return;
}
```

**参数**：
- `caller`: 调用者标识（用于日志追踪）
- `forceRefresh`: 是否先清除旧 token（默认 false）
- `scopes`: 当前后台任务实际需要的 scopes
- `requiredScopes`: 必须授予的 scopes；默认与 `scopes` 相同

## Scope 策略

每个调用点必须声明当前功能需要的最小 scope：

| 场景 | Scope set |
| --- | --- |
| Scheduled Messages 读写、Config、Schema、Jira Rule 同步 | `GOOGLE_AUTH_SCOPE_SETS.SHEETS` |
| Google Slides 分析和写回 | `GOOGLE_AUTH_SCOPE_SETS.SLIDES` |
| Google 用户名/邮箱识别 | `GOOGLE_AUTH_SCOPE_SETS.IDENTITY` |
| App Script 检查和升级 | `GOOGLE_AUTH_SCOPE_SETS.APPS_SCRIPT_ADMIN` |
| 首次 One Click Setup | `GOOGLE_AUTH_SCOPE_SETS.FULL` |

较小 scope 请求不会撤销已有的更大授权；如果该 scope 已授予，Chrome 会直接使用缓存或生成对应 token，不会仅仅因为本次 scope 集合更小而重新弹授权。`getGoogleAuthTokenResult()` / `getGoogleAuthTokenSilentlyResult()` 会同时返回 `grantedScopes`、`missingScopes` 和失败原因，适合需要向用户解释授权状态的页面。

## 使用场景详解

### 场景 1: 用户点击按钮触发操作

**示例**：用户点击"分析 Slides"按钮

```typescript
const analyzeSlidesProjects = async () => {
  try {
    setIsAnalyzingSlides(true);
    
    // ✅ 使用 getGoogleAuthToken（会弹窗）
    const token = await getGoogleAuthToken({ caller: 'popup.analyzeSlides' });
    if (!token) {
      alert('无法获取 Google 授权');
      return;
    }
    
    // 使用 token 调用 API
    // ...
  } finally {
    setIsAnalyzingSlides(false);
  }
};
```

**为什么用 `getGoogleAuthToken`**：
- 用户主动操作，可以弹窗
- 先尝试缓存，避免不必要的弹窗（更好的用户体验）

### 场景 2: 后台自动任务

**示例**：background.js 中的自动更新检查

```typescript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkUpdate') {
    // ✅ 使用 getGoogleAuthTokenSilently（不弹窗）
    const token = await getGoogleAuthTokenSilently({ 
      caller: 'background.autoUpdate',
      scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
    });
    
    if (!token) {
      console.log('无缓存 token，跳过自动更新');
      return;
    }
    
    // 执行自动更新
    await SheetSchemaUpdater.checkAndAutoUpdate(token);
  }
});
```

**为什么用 `getGoogleAuthTokenSilently`**：
- 后台任务，用户无操作，不应弹窗
- 没有 token 就跳过，不影响用户

### 场景 3: 页面加载时初始化

**示例**：ScheduledMessagesManager 组件加载

```typescript
useEffect(() => {
  const initializeData = async () => {
    // ✅ 使用 getGoogleAuthTokenSilently（不弹窗）
    const authResult = await getGoogleAuthTokenSilentlyResult({
      caller: 'ScheduledMessagesManager.init',
      scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
    });
    const token = authResult.token;
    
    if (!token) {
      // 使用 formatGoogleAuthFailure(authResult) 显示缺少 Sheets、未登录或 OAuth 错误
      setNeedsReauth(true);
      return;
    }
    
    // 加载数据
    await loadMessages(token);
  };
  
  initializeData();
}, []);
```

**为什么用 `getGoogleAuthTokenSilently`**：
- 页面加载时不应弹窗（打扰用户）
- 没有 token 就显示提示，让用户主动授权

### 场景 4: 首次 One Click Setup 请求完整权限

**示例**：OneClickSetup 首次配置

```typescript
const handleInitialize = async () => {
  try {
    setCurrentStep('正在获取授权...');
    
    // ✅ 使用 getGoogleAuthToken + forceRefresh
    const token = await getGoogleAuthToken({ 
      caller: 'OneClickSetup.init',
      forceRefresh: true,
      scopes: GOOGLE_AUTH_SCOPE_SETS.FULL,
    });
    
    if (!token) {
      throw new Error('无法获取 Google 授权');
    }
    
    // 使用新 token 初始化
    // ...
  } catch (err) {
    setError(err.message);
  }
};
```

**为什么这里使用完整 scope**：首次初始化会创建 Sheet、Drive 文件、Apps Script 项目与部署，需要一次完成完整授权。普通 Scheduled Messages 页面不会复用这个完整 scope，而只请求 Sheets。

### 场景 5: API 返回 401，尝试刷新 token

**示例**：ScheduledMessageService 自动重试

```typescript
class ScheduledMessageService {
  private async refreshToken(): Promise<string> {
    // ✅ 使用 getGoogleAuthTokenSilently + forceRefresh
    const token = await getGoogleAuthTokenSilently({ 
      caller: 'ScheduledMessageService.refresh',
      forceRefresh: true,
      scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
    });
    
    if (!token) {
      throw new Error('Token 已过期，请手动重新授权');
    }
    
    this.token = token;
    return token;
  }
  
  private async withTokenRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (is401Error(error)) {
        console.log('🔄 检测到 401 错误，尝试刷新 token...');
        await this.refreshToken();
        return await operation();  // 重试
      }
      throw error;
    }
  }
}
```

**为什么用 `getGoogleAuthTokenSilently + forceRefresh`**：
- API 返回 401，说明 token 可能已过期
- 尝试静默刷新（不弹窗），给用户更好的体验
- 如果静默刷新失败，抛出错误，让调用方决定是否弹窗重新授权

## 迁移指南

### 从旧 API 迁移

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `getAuthToken()` | `getGoogleAuthToken({ caller: 'xxx' })` | 需要添加 caller |
| `getCachedAuthToken()` | `getGoogleAuthTokenSilently({ caller: 'xxx' })` | 需要添加 caller |
| `getAuthToken(false)` | `getGoogleAuthTokenSilently({ caller: 'xxx' })` | 非交互式 → 静默方法 |
| `getAuthToken(true)` | `getGoogleAuthToken({ caller: 'xxx' })` | 交互式 → 会弹窗方法 |

### 迁移示例

**Before**:
```typescript
const token = await getAuthToken();
```

**After**:
```typescript
const token = await getGoogleAuthToken({ caller: 'MyComponent.handleSubmit' });
```

---

**Before** (OneClickSetup):
```typescript
// 先清除旧 token，强制重新获取
chrome.identity.getAuthToken({ interactive: false }, (oldToken) => {
  if (oldToken) {
    chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        // ...
      });
    });
  }
});
```

**After**:
```typescript
const token = await getGoogleAuthToken({ 
  caller: 'OneClickSetup.init',
  forceRefresh: true 
});
```

## 最佳实践

### 1. 始终提供 caller 和 scopes

```typescript
// ❌ 不好
const token = await getGoogleAuthToken();

// ✅ 好
const token = await getGoogleAuthToken({
  caller: 'popup.analyzeSlides',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SLIDES,
});
```

**原因**：`caller` 便于追踪来源，`scopes` 避免一个功能捎带请求其它产品权限。

### 2. 根据场景选择正确的方法

```typescript
// ❌ 不好：后台任务使用会弹窗的方法
chrome.alarms.onAlarm.addListener(async () => {
  const token = await getGoogleAuthToken({ caller: 'background.alarm' });
  // 可能在用户无操作时弹出授权窗口，体验差
});

// ✅ 好：后台任务使用静默方法
chrome.alarms.onAlarm.addListener(async () => {
  const token = await getGoogleAuthTokenSilently({ caller: 'background.alarm' });
  if (!token) {
    console.log('无缓存 token，跳过任务');
    return;
  }
});
```

### 3. 处理 token 获取失败

```typescript
// ❌ 不好：不处理失败情况
const token = await getGoogleAuthToken({ caller: 'MyComponent' });
// 如果 token 为 null，后续代码会出错

// ✅ 好：检查并处理失败
const token = await getGoogleAuthToken({ caller: 'MyComponent' });
if (!token) {
  alert('获取授权失败，请重试');
  return;
}
// 继续使用 token
```

### 4. 只在必要时使用 forceRefresh

```typescript
// ❌ 不好：每次都强制刷新
const token = await getGoogleAuthToken({ 
  caller: 'MyComponent',
  forceRefresh: true  // 每次都清除缓存，增加不必要的授权次数
});

// ✅ 好：首次完整初始化明确请求完整 scope
const token = await getGoogleAuthToken({ 
  caller: 'OneClickSetup.init',
  forceRefresh: true,
  scopes: GOOGLE_AUTH_SCOPE_SETS.FULL,
});
```

## 调试

### 查看授权日志

在浏览器控制台中：

```javascript
// 查看所有授权日志
await logs.auth().print();

// 导出授权日志
const text = await logs.auth().export();
console.log(text);

// 清空授权日志
await logs.auth().clear();
```

### 日志格式

```
✅ [auth] 14:23:45 popup.analyzeSlides.tryCache - 使用缓存 token
   📊 { interactive: false }

❌ [auth] 14:25:12 background.autoUpdate
   消息: The user is not signed in.
   📊 { interactive: false }
```

## 常见问题

### Q1: 什么时候用 `getGoogleAuthToken`，什么时候用 `getGoogleAuthTokenSilently`？

**简单规则**：
- 用户主动操作（点击按钮等）→ `getGoogleAuthToken`
- 后台自动任务、页面加载 → `getGoogleAuthTokenSilently`

### Q2: 为什么需要 `forceRefresh`？

**两个场景**：
1. **首次完整初始化**：One Click Setup 明确刷新并请求 `FULL`
2. **token 无效**：API 实际返回 401 后，清除该 access token 缓存并静默重取

新增权限不应仅依赖 manifest 变更；调用点应声明新的功能 scope，并检查 `missingScopes`。

### Q3: `getGoogleAuthToken` 会每次都弹窗吗？

**不会**！它的默认行为是：
1. 先尝试使用缓存的 token
2. 只有缓存未命中时才弹窗

这样既保证了功能（最终能获取到 token），又提供了好的用户体验（避免不必要的弹窗）。

### Q4: 如何处理"用户拒绝授权"的情况？

```typescript
const token = await getGoogleAuthToken({ caller: 'MyComponent' });
if (!token) {
  // 需要精确原因时改用 getGoogleAuthTokenResult()
  alert('未取得当前功能所需的 Google 权限');
  return;
}
```

## 技术细节

### Chrome Identity API 的缓存机制

Chrome 会自动缓存 OAuth token，直到：
- Token 过期
- 调用 `chrome.identity.removeCachedAuthToken`

即使调用 `chrome.identity.getAuthToken({ interactive: true })`，如果有缓存也会直接返回缓存，不会弹窗。

应用只应在 API 确认 token 无效或首次完整初始化时使用 `forceRefresh`。粒度授权缺少 scope 时，共享 helper 会识别 `grantedScopes`，并在用户主动授权路径中移除该 access token 缓存后补请求缺失权限。

### 日志记录

所有 token 获取操作都会记录到 `chrome.storage.local`，包括：
- 时间戳
- 调用者（caller）
- 是否成功
- 错误信息（如果有）
- 调用栈（用于调试）

日志保留最近 20 条，自动清理旧记录。
