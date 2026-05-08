# Context Assist / 情境助理

_最后更新: 2026-05-08_

## 是什么

`Context Assist` 是 Personal AI 的场景化记忆提示层：在用户进入真实工作场景前，把已保存的消息、会议、网页、Jira、AI 对话和用户偏好整理成低打扰、可追溯、可确认使用的提示。

第一阶段包含两个 surface：

1. **会前准备**
   - 入口：`https://app.ringcentral.com/video/home*`
   - 形态：在 RingCentral Video Home 的会议详情右侧注入 `Personal AI 会前准备` 卡片。
   - 作用：读取日历会议，结合 Personal AI 记忆生成会前 cue cards，并可把 brief handoff 到 Meeting Pilot。
2. **写作护航**
   - 入口：RingCentral message/thread、Jira comment、ChatGPT/豆包/Claude/Gemini 等 Web Agent 输入框。
   - 形态：输入框旁的 Composer Guard chip / popover。
   - 作用：发出前提醒用户不要漏掉历史事实、承诺、风险和上下文。

它不是新的 recall 引擎。底层统一复用：

- `/context-recall`：低延迟、无 LLM 的快路径关联召回。
- `/recall`：需要更深证据时的主动召回能力。
- `/context-assist`：新增的场景编排层，把当前 surface、目标、事件、草稿和召回结果组织成 cue cards。

## 用户主流程

### 会前准备

1. 用户打开 RingCentral Video Home。
2. content script 读取当前选中的 upcoming meeting，并尝试读取 RingCentral 本地 `Calendar/event2`。
3. 未授权 Outlook 时，扩展会把轻量会议元数据静默同步到 memory-service：
   - title、start/end、organizer、attendees、location、join/source URL、description/body preview、series key、hash。
   - 不上传完整 HTML body。
4. 用户可在卡片里补充本次会议目标，例如“今天同步 Rooms 依赖进展”。
   - 会议目标按当前 meeting 隔离；切换会议不会沿用上一场会议的目标。
   - 如果用户在生成 brief 后修改目标，`发送到 Meeting Pilot` 会先禁用，直到重新生成建议。
5. 点击 `生成建议` 后，扩展调用 `/context-assist`：
   - `surface: meeting_prep`
   - `contextType: meeting`
   - event metadata + userGoal
6. 卡片展示：
   - 会前 brief。
   - 相关历史记忆。
   - 建议补充的问题。
   - 证据来源。
7. 点击 `发送到 Meeting Pilot` 后，brief 写入 `chrome.storage.local.meetingPrepHandoff`，供 Meeting Pilot 后续读取。

### 写作护航

1. 用户聚焦真实页面里的输入框。
2. `ComposerGuardController` 通过 `SiteContextAdapter` 读取当前页面/会话 snapshot。
3. background 调用兼容接口 `/composer/assist`。
4. `/composer/assist` 由 `ContextAssistService.assistComposer()` 执行，内部仍走 `/context-recall`。
5. 如果命中高置信记忆，输入框旁显示 Personal AI chip。
6. 用户点击后插入建议 context，不自动发送。

## 数据来源

### Outlook Calendar

Options 页面提供 Microsoft Outlook Calendar 授权：

- OAuth 方式：Microsoft Graph Authorization Code + PKCE。
- scopes：`offline_access User.Read Calendars.Read`。
- token 只存 `chrome.storage.local.outlookCalendarAuth`。
- 自动同步：background alarm 每 30 分钟检查并同步。
- 手动同步：Options 页面 `立即同步`。

Outlook 读取未来 14 天和过去 1 天的 `calendarView`，只同步 `bodyPreview`，不保存完整 body。

### RingCentral IndexedDB fallback

未授权 Outlook 或配置为 fallback 时，Video Home content script 读取：

- database：`Calendar`
- store：`event2`

读取范围：过去 1 天到未来 14 天。打开 Video Home 后静默同步到 `/calendar-events/sync`。

### Memory Service 存储

新增表：

- `calendar_events`

每次同步按 `source_system + external_id` upsert，并使用 `content_hash` 做变化检测。

为了让 `/context-recall` 能命中日历事件，同步会同时维护一条轻量 calendar memory：

- `messages_raw.source_type = calendar`
- `chunks.source_type = calendar`

取消会议会标记 `calendar_events.cancelled = 1`，并删除对应 calendar chunk，避免进入会前准备召回。

## API

### `POST /api/v1/calendar-events/sync`

用途：同步 Outlook / RingCentral 本地日历事件。

请求关键字段：

- `sourceSystem`: `outlook | ringcentral_indexeddb`
- `events[]`: event metadata
- `deletedExternalIds[]`: 可选，用于标记删除/取消

返回：

- `created`
- `updated`
- `unchanged`
- `cancelled`
- `deleted`
- `total`

### `POST /api/v1/context-assist`

用途：统一的场景编排接口。

支持 surface：

- `meeting_prep`
- `composer_guard`

会前准备请求包含：

- `event`
- `userGoal`
- `sourceTypes`
- `limit`

`event` 可以携带从日历同步对象来的轻量运行时字段，例如 `cancelled`、`lastModifiedTime`、`metadata.provider`。

返回：

- `cueCards`
- `evidence`
- `insertText`
- `riskLevel`
- `confidence`

### `POST /api/v1/composer/assist`

兼容旧 Composer Guard 调用。当前不删除这个接口，而是作为 `ContextAssistService.assistComposer()` 的包装，避免影响已注入的输入框体验。

## UX 原则

- 默认低打扰：只有用户打开 Video Home 或聚焦输入框时出现。
- 不替用户发消息、不自动发 prompt。
- 日历 fallback 静默同步只保存轻量 metadata。
- 每条建议必须能看到证据来源。
- daily / recurring meeting 默认生成 compact cues；用户补充目标后再生成更具体的准备内容。
- handoff 前必须确保 brief 与当前会议和当前目标一致。
- “会前准备”是当前 UI 文案；`Context Assist` 是统一功能名。

## 与已有功能关系

- `webpage_memory_detection`：仍负责 ambient 相关记忆提示。
- `Composer Guard`：纳入 Context Assist，负责真实输入框的写作护航 surface。
- `Meeting Pilot`：消费会前准备 handoff，并在会中继续做 transcript、memory refs、action items。
- `Memory Rehearsal Studio`：不作为第一阶段独立页面实现；语音 role-play / 深度演练作为后续扩展方向保留。

## 验证

已覆盖的后端测试：

- `/calendar-events/sync`：新增、更新、hash 未变化、取消会议。
- `/context-assist`：meeting prep 和 composer guard 两种 surface。
- `/composer/assist`：兼容旧请求。
- `/context-recall`：新增 surface schema 后保持原行为。

Extension 需要通过：

- `npm start` 首轮 dev build。
- RingCentral Video Home content script 的浏览器注入检查。
- Options 页面 Outlook 授权状态与手动同步检查。
