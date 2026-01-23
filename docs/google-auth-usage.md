# Google Auth Token 使用指南

## 概述

项目中所有 Google OAuth token 的获取已统一到 `src/utils/googleAuth.ts`。

**迁移已完成**：所有 `chrome.identity.getAuthToken` 直接调用已迁移到共用方法。

## 核心方法

### 1. `getGoogleAuthToken()` - 会弹窗的授权方法

**默认行为**：先尝试使用缓存的 token，如果没有缓存则弹出授权窗口

**适用场景**：用户主动操作（点击按钮、提交表单等）

```typescript
import { getGoogleAuthToken } from './utils/googleAuth';

// 基础用法
const token = await getGoogleAuthToken({ caller: 'popup.analyzeSlides' });
if (!token) {
  alert('获取授权失败');
  return;
}
```

**参数**：
- `caller`: 调用者标识（用于日志追踪）
- `forceRefresh`: 是否先清除旧 token（默认 false）
- `silent`: 是否静默（不记录日志，默认 false）

### 2. `getGoogleAuthTokenSilently()` - 静默授权方法

**默认行为**：只使用缓存的 token，如果没有缓存则返回 null（不弹窗）

**适用场景**：后台自动任务、页面初始化等不应打扰用户的场景

```typescript
import { getGoogleAuthTokenSilently } from './utils/googleAuth';

// 基础用法
const token = await getGoogleAuthTokenSilently({ caller: 'background.autoUpdate' });
if (!token) {
  console.log('无缓存 token，跳过自动任务');
  return;
}
```

**参数**：
- `caller`: 调用者标识（用于日志追踪）
- `forceRefresh`: 是否先清除旧 token（默认 false）

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
      caller: 'background.autoUpdate' 
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
    const token = await getGoogleAuthTokenSilently({ 
      caller: 'ScheduledMessagesManager.init' 
    });
    
    if (!token) {
      // 显示"需要授权"提示，让用户主动点击授权按钮
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

### 场景 4: 需要新权限（manifest 更新了 scopes）

**示例**：OneClickSetup 首次配置

```typescript
const handleInitialize = async () => {
  try {
    setCurrentStep('正在获取授权...');
    
    // ✅ 使用 getGoogleAuthToken + forceRefresh
    const token = await getGoogleAuthToken({ 
      caller: 'OneClickSetup.init',
      forceRefresh: true  // 清除旧 token，应用新的权限范围
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

**为什么用 `forceRefresh: true`**：
- manifest.json 更新了 `oauth2.scopes`
- 旧 token 权限不足（例如只有 readonly，现在需要 write）
- 必须清除旧 token，重新授权以获取新权限

### 场景 5: API 返回 401，尝试刷新 token

**示例**：ScheduledMessageService 自动重试

```typescript
class ScheduledMessageService {
  private async refreshToken(): Promise<string> {
    // ✅ 使用 getGoogleAuthTokenSilently + forceRefresh
    const token = await getGoogleAuthTokenSilently({ 
      caller: 'ScheduledMessageService.refresh',
      forceRefresh: true  // 清除旧 token，尝试获取新的
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

### 1. 始终提供 caller 参数

```typescript
// ❌ 不好
const token = await getGoogleAuthToken();

// ✅ 好
const token = await getGoogleAuthToken({ caller: 'popup.analyzeSlides' });
```

**原因**：便于在日志中追踪 token 获取的来源，方便调试

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

// ✅ 好：只在需要新权限时强制刷新
const token = await getGoogleAuthToken({ 
  caller: 'OneClickSetup.init',
  forceRefresh: true  // 只在首次配置时强制刷新
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
1. **需要新权限**：manifest.json 更新了 scopes，旧 token 权限不足
2. **token 过期**：API 返回 401，尝试刷新 token

### Q3: `getGoogleAuthToken` 会每次都弹窗吗？

**不会**！它的默认行为是：
1. 先尝试使用缓存的 token
2. 只有缓存未命中时才弹窗

这样既保证了功能（最终能获取到 token），又提供了好的用户体验（避免不必要的弹窗）。

### Q4: 如何处理"用户拒绝授权"的情况？

```typescript
const token = await getGoogleAuthToken({ caller: 'MyComponent' });
if (!token) {
  // token 为 null 可能是：
  // 1. 用户拒绝授权
  // 2. 网络错误
  // 3. 其他错误
  
  alert('获取授权失败，请检查网络或重新授权');
  return;
}
```

## 技术细节

### Chrome Identity API 的缓存机制

Chrome 会自动缓存 OAuth token，直到：
- Token 过期
- 调用 `chrome.identity.removeCachedAuthToken`

即使调用 `chrome.identity.getAuthToken({ interactive: true })`，如果有缓存也会直接返回缓存，不会弹窗。

**这就是为什么需要 `forceRefresh`**：必须先清除缓存，才能强制重新授权。

### 日志记录

所有 token 获取操作都会记录到 `chrome.storage.local`，包括：
- 时间戳
- 调用者（caller）
- 是否成功
- 错误信息（如果有）
- 调用栈（用于调试）

日志保留最近 20 条，自动清理旧记录。
