# 消息交互功能 (Message Reaction)

## 功能概述

消息交互功能提供了在 RingCentral 消息流中快速处理消息的能力，包括自动答复和稍后处理（Snooze）两大核心功能。

## 功能开关

在插件的设置页面（Options）中，可以独立开启或关闭这两个功能：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `ENABLE_SNOOZE` | 启用「稍后处理」功能 | `true` |
| `ENABLE_AUTO_REPLY` | 启用「自动答复」功能 | `true` |

- 如果两个功能都关闭，消息上将不会显示交互工具栏
- 如果只开启其中一个功能，工具栏只显示对应的按钮

---

## 自动答复 (Auto Reply)

### 功能说明

自动答复功能允许用户配置规则，当消息匹配特定条件时，系统自动生成并发送回复消息。

### 触发方式

- **定时消息分析**：在定时分析消息时（非实时），检测到匹配规则后触发
- 触发后将消息添加到定时消息队列执行

### 匹配条件

| 条件 | 说明 |
|------|------|
| 匹配发送人 | 筛选特定发送者的消息 |
| 匹配群组 | 筛选特定群组的消息 |
| 匹配内容 | 基于语义相似度匹配消息内容 |

### 答复模式

| 模式 | 说明 |
|------|------|
| 直接发送 | 匹配后立即执行发送（下一分钟） |
| 延迟拦截 | 设置延迟时间（如 X 小时后发送），期间可拦截 |
| 仅审核 | 添加到待审核列表，需手动批准后发送 |

### 答复内容生成

- **AI 生成**：勾选"每次 AI 生成类似答复"后，每次由 LLM 根据模板风格动态生成
- **固定文本**：不勾选时，使用用户编辑的固定回复内容

### 配置入口

1. **关注主题管理** (`topic-modal.tsx`)：添加关注项时勾选"自动答复"
2. **消息交互工具栏** (`message-reaction/MessageReactionUI.ts`)：点击"自动答复"按钮快速配置

### 核心数据结构

```typescript
interface AutoReplyConfig {
  enabled: boolean;           // 是否启用
  replyContent: string;       // 回复内容模板
  useAIGenerate: boolean;     // 是否每次 AI 生成
  reviewMode: 'immediate' | 'delayed' | 'manual';  // 审核模式
  delayHours?: number;        // 延迟小时数（delayed 模式）
}

interface TopicItem {
  // ... 其他字段
  filterSender?: string;      // 匹配发送人
  filterGroup?: string;       // 匹配群组
  autoReply?: boolean;        // 是否启用自动答复
  autoReplyConfig?: AutoReplyConfig;
}
```

### 消息状态

自动答复生成的消息使用 `PendingReview` 状态，与普通的 `Paused` 状态区分，便于在定时消息管理器中过滤审核。

---

## 稍后处理 (Snooze)

### 功能说明

稍后处理功能允许用户在浏览消息时快速设置提醒，系统会在指定时间通过 Bot 推送提醒消息，帮助用户跟进重要信息。

### 触发方式

- **悬停触发**：在 RingCentral 消息页面，将鼠标悬停在任意消息上 **3 秒**后，自动显示浮动工具栏
- **排除规则**：Reply 输入框不会显示工具栏
- **功能开关**：需要在设置中启用对应功能，否则不显示工具栏或对应按钮

### UI 结构

工具栏包含三个元素：

| 元素 | 功能 |
|------|------|
| 稍后处理按钮 | 蓝色按钮，点击默认设置 1 小时后提醒，悬浮显示快速选项菜单 |
| 自动答复按钮 | 红色按钮，点击打开自动答复配置窗口 |
| 图标 | 视觉标识，不可点击 |

### 快速选项

悬浮"稍后处理"按钮时显示快速选项菜单：

| 选项 | 提醒时间 |
|------|----------|
| 1小时后 | 当前时间 + 1 小时 |
| 今晚 | 当天 20:00 (8:00 PM) |
| 明天 | 第二天 09:00 (9:00 AM) |
| 下周一 | 下周一 09:00 (9:00 AM) |
| 自定义时间 | 打开日期时间选择器 |

### 自定义时间选择器

点击"自定义时间"后弹出选择器：
- **日期选择**：点击日期预设按钮或使用日期选择框
- **时间选择**：输入具体时间（HH:mm 格式）
- **确认**：点击确认按钮完成设置

### 工作流程

```
用户点击快速选项/确认自定义时间
         ↓
  发送消息到 Background
         ↓
  创建定时消息到 Google Sheets
         ↓
  [异步] LLM 生成摘要更新 Topic
         ↓
  [异步] 存储到云端记忆系统
         ↓
  到达提醒时间 → Bot 推送消息
```

### 消息信息提取

从消息 DOM 中提取以下信息：

| 字段 | 说明 |
|------|------|
| `id` | 消息唯一 ID（从 data-id 属性） |
| `senderName` | 发送者名称 |
| `groupId` | 群组 ID（从 URL 提取） |
| `groupName` | 群组名称 |
| `content` | 消息内容 |
| `messageLink` | 消息直链 |
| `timestamp` | 消息时间戳 |

### 提醒消息格式

创建的定时消息包含：

- **Topic**: `稍后处理: {LLM摘要}` （异步生成，默认使用群组名）
- **Content**: 包含原消息摘要、发送者、群组、原消息链接
- **Category**: `Snooze,提醒`
- **Push_Method**: `Bot`
- **Target_Type**: `private`

### 核心数据结构

```typescript
interface MessageInfo {
  id: string;           // 消息 ID
  senderName: string;   // 发送者
  groupId: string;      // 群组 ID
  groupName: string;    // 群组名
  content: string;      // 消息内容
  messageLink: string;  // 消息链接
  timestamp: string;    // 时间戳
}

// Background 请求
interface SnoozeRequest {
  type: 'CREATE_SNOOZE_REMINDER';
  data: {
    messageInfo: MessageInfo;
    remindAt: number;   // 提醒时间戳
    note?: string;      // 备注（暂未使用）
  };
}
```

### 隐藏逻辑

工具栏在以下情况下隐藏：
- 鼠标离开消息区域（除非移动到工具栏/菜单/选择器）
- 成功创建提醒后
- 点击页面其他区域

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/message-reaction/` | 消息交互功能模块（稍后处理、自动答复） |
| `src/message-reaction/index.ts` | 模块入口，导出所有公共接口 |
| `src/message-reaction/MessageReactionUI.ts` | 消息交互工具栏 UI、消息信息提取、功能开关控制 |
| `src/message-reaction/SnoozeManager.ts` | Snooze 功能核心逻辑 |
| `src/message-reaction/AutoReplyHandler.ts` | 自动答复处理逻辑（含初始化检查） |
| `src/modals/topic-modal.tsx` | 关注主题管理，自动答复配置 UI |
| `src/messageDealing.ts` | 消息分析，调用自动答复处理 |
| `src/agentThinking.ts` | Agent 模式消息分析 |
| `src/contentScriptGlip.tsx` | RingCentral 页面内容脚本，初始化消息交互功能 |
| `src/background.ts` | Snooze 请求处理、定时消息创建 |
| `src/bot.ts` | Bot 消息发送，包含原消息链接和自动答复信息 |
| `src/scheduled-messages/` | 定时消息管理 |
| `src/scheduled-messages/ScheduledMessagesUtils.ts` | 定时消息共用工具（初始化检查、提示对话框） |
| `src/llm.ts` | LLM 调用，`generateAutoReply`、摘要生成 |
| `src/utils.ts` | 包含 `ENABLE_SNOOZE`、`ENABLE_AUTO_REPLY` 配置 |
| `src/options.tsx` | 设置页面，消息交互功能开关 UI |

---

**相关文档**:
- [定时消息管理](./scheduled_messages_manager.md)
- [消息分析过滤](./message_analysis_filter.md)
