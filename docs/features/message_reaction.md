# 消息交互功能 (Message Reaction)

## 功能概述

消息交互功能提供了在 RingCentral 消息流中快速处理消息的能力。当前工具栏固定提供四个入口：稍后处理、关注后续、自动答复、联动操作。

## 功能开关

在插件的设置页面（Options）中，可以独立开启或关闭这四个功能：

| 配置项                 | 说明                 | 默认值 |
| ---------------------- | -------------------- | ------ |
| `ENABLE_SNOOZE`        | 启用「稍后处理」功能 | `true` |
| `ENABLE_FOLLOW_THREAD` | 启用「关注后续」功能 | `true` |
| `ENABLE_AUTO_REPLY`    | 启用「自动答复」功能 | `true` |
| `ENABLE_LINKED_ACTION` | 启用「联动操作」功能 | `true` |

- 如果四个功能都关闭，消息上将不会显示交互工具栏
- 如果只开启其中部分功能，工具栏只显示对应的按钮，顺序保持不变

---

## 工具栏结构

悬停消息 3 秒后显示工具栏，功能按钮顺序固定为：

1. **稍后处理**：闹钟 icon，点击默认创建 1 小时提醒，hover 展开快速菜单
2. **关注后续**：紫色按钮，打开关注后续规则配置
3. **自动答复**：琥珀 / 橙色按钮，打开自动答复规则配置
4. **联动操作**：红色按钮，打开“记忆入口规则”弹窗并预填一条带“关联操作”的规则
5. **PAI 图标**：视觉标识

---

## 自动答复 (Auto Reply)

### 功能说明

自动答复功能允许用户配置规则，当消息匹配特定条件时，系统自动生成并发送回复消息。

### 触发方式

- **定时消息分析**：在定时分析消息时（非实时），检测到匹配规则后触发
- 触发后将消息添加到定时消息队列执行

### 匹配条件

| 条件       | 说明                       |
| ---------- | -------------------------- |
| 匹配发送人 | 筛选特定发送者的消息       |
| 匹配群组   | 筛选特定群组的消息         |
| 匹配内容   | 基于语义相似度匹配消息内容 |

### 答复模式

| 模式     | 说明                                        |
| -------- | ------------------------------------------- |
| 直接发送 | 匹配后立即执行发送（下一分钟）              |
| 延迟拦截 | 设置延迟时间（如 X 小时后发送），期间可拦截 |
| 仅审核   | 添加到待审核列表，需手动批准后发送          |

### 答复内容生成

- **AI 生成**：勾选"每次 AI 生成类似答复"后，每次由 LLM 根据模板风格动态生成
- **固定文本**：不勾选时，使用用户编辑的固定回复内容

### 配置入口

1. **关注主题管理** (`topic-modal.tsx`)：添加关注项时勾选"自动答复"
2. **消息交互工具栏** (`message-reaction/MessageReactionUI.ts`)：点击"自动答复"按钮快速配置

### 核心数据结构

```typescript
interface AutoReplyConfig {
  enabled: boolean; // 是否启用
  replyContent: string; // 回复内容模板
  useAIGenerate: boolean; // 是否每次 AI 生成
  reviewMode: 'immediate' | 'delayed' | 'manual'; // 审核模式
  delayHours?: number; // 延迟小时数（delayed 模式）
}

interface TopicItem {
  // ... 其他字段
  filterSender?: string; // 匹配发送人
  filterGroup?: string; // 匹配群组
  autoReply?: boolean; // 是否启用自动答复
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

工具栏中和稍后处理相关的元素如下：

| 元素         | 功能                                                                |
| ------------ | ------------------------------------------------------------------- |
| 稍后处理按钮 | 蓝色闹钟 icon 按钮，点击默认设置 1 小时后提醒，悬浮显示快速选项菜单 |
| PAI 图标     | 视觉标识，不可点击                                                  |

### 快速选项

悬浮"稍后处理"按钮时显示快速选项菜单：

| 选项       | 提醒时间               |
| ---------- | ---------------------- |
| 1小时后    | 当前时间 + 1 小时      |
| 今晚       | 当天 20:00 (8:00 PM)   |
| 明天       | 第二天 09:00 (9:00 AM) |
| 下周一     | 下周一 09:00 (9:00 AM) |
| 自定义时间 | 打开日期时间选择器     |

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

| 字段          | 说明                           |
| ------------- | ------------------------------ |
| `id`          | 消息唯一 ID（从 data-id 属性） |
| `senderName`  | 发送者名称                     |
| `groupId`     | 群组 ID（从 URL 提取）         |
| `groupName`   | 群组名称                       |
| `content`     | 消息内容                       |
| `messageLink` | 消息直链                       |
| `timestamp`   | 消息时间戳                     |

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
  id: string; // 消息 ID
  senderName: string; // 发送者
  groupId: string; // 群组 ID
  groupName: string; // 群组名
  content: string; // 消息内容
  messageLink: string; // 消息链接
  timestamp: string; // 时间戳
}

// Background 请求
interface SnoozeRequest {
  type: 'CREATE_SNOOZE_REMINDER';
  data: {
    messageInfo: MessageInfo;
    remindAt: number; // 提醒时间戳
    note?: string; // 备注（暂未使用）
  };
}
```

### 隐藏逻辑

工具栏在以下情况下隐藏：

- 鼠标离开消息区域（除非移动到工具栏/菜单/选择器）
- 成功创建提醒后
- 点击页面其他区域

---

## 关注后续 (Follow Thread)

### 功能说明

关注后续允许用户对某条特定消息设置持续监听。当同群组内出现与该消息相关的后续讨论时，系统自动检测并通过配置的渠道（Bot / Chrome 通知）推送提醒，确保用户不错过重要话题的进展。

### 触发方式

- **消息交互工具栏**：将鼠标悬停在消息上，点击"👁 关注后续"按钮快速添加
- **关注主题管理**（`topic-modal.tsx`）：在关注项编辑界面启用"关注后续"开关，可进行详细配置

---

## 联动操作 / 关联操作

### 命名约定

- **联动操作**：消息悬浮工具栏里的入口名
- **关联操作**：规则编辑页里的能力名
- 底层持久化字段仍然使用 `automationPrompt` / `automationRequiresApproval`

### 触发方式

- 在 RingCentral 消息页面悬停一条消息后，点击工具栏里的 **联动操作**
- Background 会写入 `pendingLinkedActionConfig` 到 `chrome.storage.local`
- 随后打开 `topic-modal.html`

### 默认流程

```text
联动操作
  -> topic-modal / 记忆入口规则
  -> 预填一条规则
  -> 默认开启 写入记忆 + 关联操作
  -> 异步生成一条可编辑的关联操作建议
```

### 预填规则

- `text` 默认使用“发送了内容与以下语义相似：...”
- `filterSender` / `filterGroup` 直接带入当前消息上下文
- 不默认开启通知、自动答复、关注后续

### 建议生成策略

- 首选用户已经保存的 `automationPrompt` 历史
- 如果历史不足，则回退到内置样例目录
- 内置样例用作能力护栏，不是最终展示 schema；样例至少包含：
  - `sampleId`
  - `actionFamily`
  - `targetSystem`
  - `canSchedule`
  - `examplePrompt`

当前首批样例覆盖：

- 转发消息给某人
- 给 Jira ticket 加 comment
- 写入表格
- 设置 Glip 状态
- 创建日程 / 提醒

### OpenClaw 禁用态

- 当 `OPENCLAW_ENABLED` 未启用或 `OPENCLAW_BASE_URL` 未配置时，规则页中的 **关联操作** 输入框会 disabled
- UI 会显示遮罩与 CTA，跳转到 `options.html#OPENCLAW_ENABLED`
- 选项页配置完成后，topic-modal 通过 `chrome.storage.onChanged` 实时解除禁用；若当前来自联动操作入口且文本仍为空，会自动触发一次建议生成

### 关联关系检测

系统按优先级依次尝试以下六种匹配方式：

| 优先级 | 匹配方式          | 判断逻辑                                          |
| ------ | ----------------- | ------------------------------------------------- |
| 1      | **parentId 匹配** | 新消息的 `parentId` 等于原消息 `postId`（最准确） |
| 2      | **线程匹配**      | 新消息与原消息的 `threadId` 相同                  |
| 3      | **@提及匹配**     | 新消息内容中 @了原消息发送者                      |
| 4      | **引用匹配**      | 新消息包含原消息前 50 字符的内容片段              |
| 5      | **关键词过滤**    | 若配置了关键词，新消息必须包含至少一个关键词      |
| 6      | **语义匹配**      | 向量相似度 ≥ 0.7（ChromaDB，最耗时）              |

LLM 在消息分析阶段也会独立识别后续消息，并在 JSON 返回 `follow_thread_info` 字段作为补充。

### 数据流程

```
新消息进入分析流程
        ↓
contentScriptGlip: checkFollowThreadRelation()
（实时检测：parentId / threadId / @提及 / 引用 / 关键词 / 语义匹配）
        ↓
或 LLM 分析返回 follow_thread_info 字段
        ↓
messageDealing.ts: 更新 relatedMessages 记录 + 存储到 ChromaDB
        ↓
NotificationService.sendNotification()
  ├─ Bot 推送：包含原消息预览 + 后续回复内容 + 跳转链接
  └─ Chrome 通知：仅展示 summary，点击跳转原消息
```

### 通知内容

**Bot (Glip) 推送**格式示例：

```
`Esone Qiu 确认身份定义已完成，询问是否还需补充。`

📌 关注的消息（来自 AI Service）：
> 你是想给我做"身份定义"（也就是：我是谁、你是谁、我们怎么称呼...
🔗 [查看原消息](https://app.ringcentral.com/...)

💬 后续回复：
__关注项__：规则12 [RULE_ID:11]: 在 esone.qiu+sync.service 中...
__在群__：@esone.qiu+sync.service
__发送者__：Esone Qiu
__时间__：2026-02-04 14:17:47
__原文__：我已经定义完了，还有什么要定义的么？
__回复建议__：...

🔗 [点击查看原消息](https://app.ringcentral.com/...)
```

**Chrome 浏览器通知**：仅展示 `summary`（最多 200 字），点击跳转到原消息链接。

### 通知方式配置 (notifyMethod)

通知方式使用逗号分隔的字符串，支持多选：

| 值             | 说明                     |
| -------------- | ------------------------ |
| `'bot'`        | 仅发送 Bot (Glip) 消息   |
| `'chrome'`     | 仅发送 Chrome 浏览器通知 |
| `'bot,chrome'` | 两者同时推送             |

> 旧版 `pushToGlip: true` 在加载时自动迁移为 `'bot,chrome'`；`pushToGlip: false` 迁移为 `'chrome'`。  
> 新建关注项默认为 `'chrome'`。

### 关注项生命周期

| 阶段       | 说明                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| **创建**   | 在 topic-modal 中配置，或从消息交互工具栏快速添加                                        |
| **监听中** | `expiredAt` 未到期，持续检测后续消息                                                     |
| **延长**   | 在"关注后续"管理界面点击"⏰ 延长"                                                        |
| **到期**   | `expiredAt` 到达后停止匹配，标记为"已过期"                                               |
| **清理**   | 每天凌晨 2:00 执行 `cleanupExpiredFollowThreads()`，同时清理 ChromaDB 中 90 天前的旧数据 |

### 核心数据结构

```typescript
interface FollowThreadConfig {
  originalMessage: {
    postId: string; // 被关注的原消息 ID
    threadId?: string;
    teamId: string;
    teamName: string;
    sender: string;
    content: string;
    datetime: string | number;
    messageUrl: string;
  };
  createdAt: string;
  keywordFilter?: string[]; // 可选关键词过滤
  relatedMessages: RelatedMessageMeta[]; // 已捕获的后续消息记录
  lastCheckedAt?: string;
  lastNotifiedAt?: string;
}

// 后续消息元数据
interface RelatedMessageMeta {
  postId: string;
  sender: string;
  datetime: string;
  relationType:
    | 'thread_reply'
    | 'mention'
    | 'quote'
    | 'semantic'
    | 'direct_reply'
    | 'same_thread'
    | 'semantic_related';
  notifiedAt?: string;
  summary?: string;
}

// 关注项（在 TopicItem 外层）
interface TopicItem {
  notifyMethod?: string; // 如 'bot,chrome'（替代旧的 pushToGlip）
  notifyFrequency?: 'immediate' | 'merged';
  followThread?: boolean; // 是否启用关注后续
  followConfig?: FollowThreadConfig;
  expiredAt: number; // 到期时间戳（统一管理生命周期）
}
```

### LLM Prompt 中的关注规则格式

当关注项在分析 Prompt 中生成时，格式如下（由 `agentThinking.ts` 处理）：

```
规则12 [RULE_ID:11]: 在 esone.qiu+sync.service 中 关于以下内容的后续讨论：
"原消息内容..."

【匹配细节】在 xxx 群组中，检测所有与 post_id="xxxxxx" 相关的后续讨论。
原消息由 "AI Service" 在 2026/2/4 13:59:32 发送。
匹配条件（满足任一）：
(1) reply_to 属性指向 "xxxxxx" 的直接回复
(2) 在同一 <thread> 中且时间在原消息之后的消息
(3) 虽然不在同一 thread，但语义上是在讨论或回应原消息内容的消息
(4) @提及原消息发送者且内容与原话题相关的消息
【注意】排除原消息本身，只识别后续的讨论消息。
```

LLM 返回的匹配结果格式：

```json
"follow_thread_info": {
  "original_post_id": "76751614156804",
  "relation_type": "direct_reply",
  "relevance_score": 0.95
}
```

### 关注后续管理界面

路径：记忆探索页面（`memory-exploring.vue`）→「关注后续」Tab

功能：

- 按状态筛选（全部 / 进行中 / 已过期）
- 按创建时间、到期时间、关联消息数排序
- 查看原消息内容和已捕获的后续消息列表
- 延长关注时间
- 取消关注（删除关注项及 ChromaDB 记录）

---

## 相关文件

| 文件                                               | 说明                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/message-reaction/`                            | 消息交互功能模块                                                         |
| `src/message-reaction/index.ts`                    | 模块入口，导出所有公共接口                                               |
| `src/message-reaction/MessageReactionUI.ts`        | 消息交互工具栏 UI、消息信息提取、功能开关控制                            |
| `src/message-reaction/SnoozeManager.ts`            | Snooze 功能核心逻辑                                                      |
| `src/message-reaction/AutoReplyHandler.ts`         | 自动答复处理逻辑                                                         |
| `src/message-reaction/FollowThreadHandler.ts`      | 关注后续核心逻辑：关联关系检测、ChromaDB 存储、过期清理                  |
| `src/services/NotificationService.ts`              | 统一通知推送服务（Bot / Chrome），替代旧的 `sendBotMessage`              |
| `src/types/followThread.ts`                        | 关注后续功能类型定义                                                     |
| `src/modals/topic-modal.tsx`                       | 关注主题管理：关注后续 + 自动答复 + 通知方式配置 UI                      |
| `src/modals/components/FollowThreads.vue`          | 关注后续管理界面组件                                                     |
| `src/messageDealing.ts`                            | 消息分析主流程，调用关注后续匹配与推送                                   |
| `src/agentThinking.ts`                             | Agent 模式消息分析，生成关注后续规则 Prompt                              |
| `src/contentScriptGlip.tsx`                        | RingCentral 页面内容脚本，初始化消息交互功能                             |
| `src/background.ts`                                | Snooze 请求处理、Chrome 通知点击事件处理                                 |
| `src/bot.ts`                                       | Bot 消息底层发送                                                         |
| `src/scheduled-messages/`                          | 定时消息管理                                                             |
| `src/scheduled-messages/ScheduledMessagesUtils.ts` | 定时消息共用工具                                                         |
| `src/llm.ts`                                       | LLM 调用，`generateAutoReply`、摘要生成                                  |
| `src/utils.ts`                                     | 包含 `ENABLE_SNOOZE`、`ENABLE_AUTO_REPLY`、`LLM_REVIEW_BEFORE_SEND` 配置 |
| `src/options.tsx`                                  | 设置页面，消息交互功能开关 UI                                            |

---

**相关文档**:

- [定时消息管理](./scheduled_messages_manager.md)
- [消息分析过滤](./message_analysis_filter.md)
