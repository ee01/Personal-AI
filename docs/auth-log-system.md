# 授权日志系统使用说明

## 概述

授权日志系统会自动记录所有 `chrome.identity.getAuthToken` 的调用，并保存到 localStorage 中，方便调试授权弹窗问题。

## 功能特性

- ✅ 自动记录所有授权调用
- ✅ 保存最近 20 条日志
- ✅ 记录调用栈信息
- ✅ 区分 interactive 和 cached 模式
- ✅ 实时自动刷新
- ✅ 一键复制和清空
- ✅ 可视化界面查看

## 使用方法

### 方法 1: 可视化界面（推荐）

1. 打开授权日志页面：
   ```
   chrome-extension://YOUR_EXTENSION_ID/auth-logs.html
   ```

2. 或者在任何扩展页面的控制台输入：
   ```javascript
   window.open(chrome.runtime.getURL('auth-logs.html'))
   ```

3. 界面功能：
   - **自动刷新**：实时更新日志（默认开启）
   - **🔄 刷新**：手动刷新日志
   - **📋 复制**：复制所有日志到剪贴板
   - **🗑️ 清空**：清空所有日志
   - **点击日志条目**：展开查看详细信息（错误、调用栈）

### 方法 2: 控制台命令

在任何扩展页面（popup、scheduled-messages、options 等）的控制台中使用：

```javascript
// 查看所有日志
authLogs.print()

// 获取日志数组
authLogs.get()

// 导出为文本
authLogs.export()

// 清空日志
authLogs.clear()
```

## 日志格式

每条日志包含以下信息：

```typescript
{
  timestamp: "2026-01-15T13:05:15.769Z",  // 时间戳
  location: "slide.getAuthToken",          // 调用位置
  interactive: true,                       // 是否交互式
  success: true,                           // 是否成功
  error: "错误信息",                       // 错误信息（如果失败）
  stack: "调用栈..."                       // 调用栈信息
}
```

## 日志位置标识

| 标识 | 说明 | 环境 |
|------|------|------|
| `slide.getAuthToken` | slide.ts 中的交互式授权 | 调用者环境 |
| `slide.getCachedAuthToken` | slide.ts 中的缓存授权 | 调用者环境 |
| `Sheet.getToken` | sheet.ts 中的授权 | 调用者环境 |
| `ScheduledMessageService.refreshToken` | 刷新 token | 调用者环境 |
| `ScheduledMessagesManager.getAuthToken` | 主管理器授权 | scheduled-messages.html |
| `BotConfigDialog.getAuthToken` | Bot 配置授权 | scheduled-messages.html |
| `OneClickSetup.getAuthToken` | 一键设置授权 | scheduled-messages.html |
| `popup.openJiraQueryDialog` | Popup Jira 查询 | Popup 页面 |
| `popup.expandEpicTickets` | Popup Epic 展开 | Popup 页面 |
| `JiraRuleUpdater.syncConfigToSheet` | Jira 规则同步 | Background |

## 调试流程

### 当授权弹窗出现时：

1. **立即打开授权日志页面**：
   ```javascript
   window.open(chrome.runtime.getURL('auth-logs.html'))
   ```

2. **查看最新的日志条目**：
   - 最上面的就是最新的
   - 查看 `location` 确定是哪里触发的
   - 查看 `interactive` 确定是否应该弹窗
   - 点击展开查看调用栈

3. **分析调用栈**：
   - 调用栈会显示完整的函数调用链
   - 可以追踪到具体的触发位置

### 示例：调试授权弹窗

```
✅ [2026-01-15 13:05:15] slide.getAuthToken (interactive)
   调用栈:
   at getAuthToken (slide.ts:494)
   at async analyzeSlidesProjects (popup.tsx:140)
   at HTMLButtonElement.<anonymous> (popup.tsx:340)
```

从这个日志可以看出：
- 是 `slide.getAuthToken` 被调用
- 使用了 `interactive=true` 模式
- 是用户点击 popup 中的按钮触发的
- 这是**正常的**用户主动操作

### 异常情况示例

```
❌ [2026-01-15 13:05:15] slide.getAuthToken (interactive)
   调用栈:
   at getAuthToken (slide.ts:494)
   at async preloadManagedRules (contentScriptJiraAutomation.ts:784)
   at async initScheduleButtons (contentScriptJiraAutomation.ts:1654)
```

从这个日志可以看出：
- 是自动预加载触发的
- 不应该使用 `interactive=true`
- 需要修改为使用 `getCachedAuthToken()`

## 技术实现

### 核心文件

- `src/utils/authLogger.ts` - 日志记录核心逻辑
- `src/components/AuthLogViewer.tsx` - 可视化界面组件
- `src/auth-logs.tsx` - 独立页面入口
- `public/auth-logs.html` - HTML 页面

### 集成方式

所有调用 `chrome.identity.getAuthToken` 的地方都已集成：

```typescript
import { logAuthCall } from './utils/authLogger';

chrome.identity.getAuthToken({ interactive: true }, (token) => {
  if (chrome.runtime.lastError) {
    logAuthCall('MyModule.myFunction', true, false, chrome.runtime.lastError.message);
  } else {
    logAuthCall('MyModule.myFunction', true, true);
  }
});
```

### 存储机制

- 使用 `localStorage` 存储（key: `personal_ai_auth_logs`）
- 自动保留最近 20 条记录
- 超过 20 条时自动删除最旧的记录

## 注意事项

1. **日志仅在扩展页面中可用**
   - Background Service Worker 有独立的 localStorage
   - Content Script 无法访问扩展的 localStorage

2. **日志会在扩展重载后清空**
   - localStorage 会在扩展重载时重置
   - 建议在调试时先导出日志

3. **调用栈信息**
   - 只保留前 5 层调用栈
   - 跳过日志系统自身的调用栈

## 常见问题

### Q: 为什么看不到日志？

A: 可能的原因：
1. 日志在不同的环境中（Background vs Popup vs 其他页面）
2. 扩展已重载，日志被清空
3. 授权调用发生在 Content Script 中（无法记录）

### Q: 如何持久化日志？

A: 使用导出功能：
```javascript
const logs = authLogs.export();
console.log(logs);  // 复制控制台输出
```

### Q: 如何添加新的授权调用记录？

A: 在新的授权调用位置添加：
```typescript
import { logAuthCall } from './utils/authLogger';

chrome.identity.getAuthToken({ interactive }, (token) => {
  logAuthCall('YourModule.yourFunction', interactive, !!token, error);
});
```
