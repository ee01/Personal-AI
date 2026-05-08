# 网页记忆探测与提示

*最后更新: 2026-05-07*

## 概述

这个功能负责在用户浏览网页或 RingCentral 消息会话时，静默判断当前上下文是否和记忆系统里的历史内容相关。如果命中，会在页面右下角显示一个轻量记忆 icon，用户点开后可以看到命中的摘要、来源和跳转到记忆探索页的入口。

当前线上主链路是：

- `src/contentScriptWebIntelligence.ts`
- `src/composer-guard/siteContextAdapters.ts`
- `src/background.ts`
- `src/services/MemoryServiceClient.ts`
- `memory-service/src/routes/contextRecall.ts`
- `memory-service/src/core/ContextRecallService.ts`

`src/web-intelligence/` 里还有早期实验架构，`docs/progressing/` 里也有旧 Web Intelligence 文档；它们可以参考，但不是当前网页记忆提示的 source of truth。

## 当前链路

### 网页智能分析

这条链路判断页面是否值得进一步理解或存储：

1. `contentScriptWebIntelligence.js` 由 manifest 注入 `<all_urls>`。
2. 内容脚本提取标题、URL、正文并做轻量规则分析。
3. 达到相关性阈值后发送 `WEB_INTELLIGENCE_ANALYSIS`。
4. `background.ts` 调用 `IntelligentAgent`，以 `type: 'webpage'` 做深度分析。

### 被动上下文召回

这条链路负责右下角记忆提示：

1. 内容脚本在页面稳定后构造当前上下文。
2. 发送 `CONTEXT_RECALL_REQUEST` 到 background。
3. Background 通过 `MemoryServiceClient.contextRecall()` 调用 memory-service 的 `/context-recall`。
4. `ContextRecallService` 使用 `vector + fts` 快速召回，不走 LLM。
5. 命中时显示 `.pai-context-bubble` 与 `.pai-context-card`。

## 前端行为

`src/contentScriptWebIntelligence.ts` 的核心职责：

- 跳过 Chrome 内部页、扩展页、Meeting Pilot 已接管的 `v.ringcentral.com/conf/on/*` 页面和部分低价值域名。低价值域名使用明确 host 判断，避免误伤 `docs.google.com` 这类工作页面。
- 在 Chrome 隐身窗口中不启用；跳过登录、支付、账单、密码、验证码等敏感 URL/域名或敏感输入页，避免在高隐私场景做页面分析或被动召回。
- 如果页面在被动召回请求发出后才出现密码、验证码等敏感输入，内容脚本会在响应回来时再次检查当前页面状态，不展示已过期的提示；如果提示已经显示后输入控件被动态改成敏感表单，也会立即撤销提示并作废挂起召回。
- 监听 DOM 变化、focus、`hashchange`、`popstate`，并用 URL 轮询补足 SPA 路由变化。
- 对普通网页使用标题、meta keywords、主内容摘要生成上下文；摘要会剔除 Personal AI 自己注入的 bubble/card，避免提示 UI 污染下一次召回。
- 对 Jira、RingCentral、AI Web Agent 和普通网页使用 `siteContextAdapters.ts` 生成统一 snapshot；被动召回请求会透传 `contextType`、`sourceTypes` 和关键 entity hints，避免把语义相似但来源/任务不兼容的记忆误召回。
- 被动召回请求只发送规范化后的 `http/https` 页面 URL：会去掉追踪参数、账号密码和 hash，查询参数稳定排序；如果 URL 带 `access_token`、OAuth `code`、session、密码、OTP 等敏感查询参数，会直接跳过分析和召回。
- 对 RingCentral 消息页使用会话级上下文，而不是整页 body。
- 按上下文 key 缓存召回结果，TTL 为 5 分钟，并会清理过期/超量缓存，避免长时间 SPA 会话保留过多旧提示。
- 用户关闭某个提示后，当前上下文在 30 分钟内不会反复弹出。
- 用户可从卡片内将当前站点暂停提示 24 小时，状态存入扩展本地 storage；内容脚本会先读取站点静默状态，再发起被动召回。设置页的 Memory Service 区域也能查看、恢复单个站点或清空全部临时静默站点。

## RingCentral 会话级探测

RingCentral 是 SPA，不能只按页面首次加载判断。当前实现会在 `app.ringcentral.com/messages/{conversationId}` 上提取：

- URL 中的 `conversationId`
- 主面板标题
- 当前选中 tab 文本
- `#message-chat-stream-wrapper`
- 最近/可见的 `.conversation-card-wrapper[data-id]` 文本

上下文 key 包含会话 id、标题、最近消息 id 和消息文本签名。这样同一会话里出现新消息或可见上下文变化时，也能重新走召回，而不是继续复用旧会话或旧消息的 bubble。

为了避免在 DOM 还没稳定时误触发，内容脚本会等待上下文稳定：

- 普通网页：约 250ms
- RingCentral 消息页：约 700ms

## UI

记忆提示使用页面右下角的固定圆形 icon：

- 首次命中带一次轻量 pulse/ring 动效。
- 点击 icon 展开卡片。
- 卡片展示命中标题、摘要、来源说明、匹配分数和跳转链接。
- “在记忆中查看”跳到扩展内的 `memory-exploring.html#...`。
- 卡片右上角可以隐藏当前提示；关闭后同一上下文短时间内不再打扰。
- 卡片内的外部来源链接只允许 `http` / `https` 协议，扩展内跳转只接受 `#/...` 记忆路由。
- 卡片渲染会对链接属性做转义，并拒绝带空白、引号或尖括号的异常 `exploreLink`，防止历史记忆里的坏链接污染当前网页。
- 卡片提供“此网站今天不提示”入口，用于临时降低打扰；点击后显示短暂确认，而不是只让提示突然消失。
- Options 页提供“网页记忆提示静默站点”管理入口，用户可以看到剩余静默时间，并恢复单个站点或全部站点。
- 卡片支持键盘打开、Tab 进入操作区、Escape 收起；关闭当前提示时会给出短暂确认；窄屏下会限制宽度不越界，并尊重 `prefers-reduced-motion`。

这个设计偏向 ambient notification：提示要容易被看到，但不应抢占用户当前任务。

## 后端召回

`memory-service/src/routes/contextRecall.ts` 提供 `POST /context-recall`，请求体包含：

- `surface`：例如 `web_passive` / `meeting_passive`
- `contextType`：例如 `webpage` / `message_thread`
- `title`
- `url`
- `primaryText`
- `secondaryTexts`
- `entityHints`
- `sourceTypes`
- `scope`
- `limit`

`ContextRecallService` 的约束：

- 默认返回少量结果，硬上限 5 条。
- 只使用 `vector + fts`，不做图遍历和 LLM 总结。
- 拒绝过短或低信号 payload。
- 返回 `exploreLink`，供前端跳转到记忆探索页。

## 竞品与研究启发

本功能更接近“当前工作表面上的被动记忆提醒”，不是全局搜索页。调研结论：

- ChatGPT Memory 强调用户可以查看、删除、关闭记忆，并区分显式保存记忆和历史对话引用。
- ChatGPT Atlas 的 Browser Memories 更贴近网页场景：浏览器记忆独立于 ChatGPT Memory，支持查看、归档/删除、关闭，以及按页面控制可见性。
- Microsoft Recall 强调从一开始让用户选择、可以暂停、过滤网站/应用、过滤私密浏览活动和删除数据。
- Notion AI connectors 强调跨工具检索要尊重原工具权限，并显示引用来源。
- Mem0 contextual add v2 强调会话级上下文自动管理，避免调用方每次传完整历史。
- MemGPT / LongMem / MemoryAgentBench 都指向同一个工程要求：记忆系统必须能准确召回、可更新、避免 stale context，并能选择性遗忘。
- 关于 ChatGPT 记忆的用户研究提示：自动生成记忆会带来用户代理权和隐私解释成本，所以被动提示必须保持可见、可关、可追溯。

因此，本功能的产品原则是：

- 只在上下文足够明确时提示。
- 提示必须带来源和跳转。
- 旧上下文切换时必须清理。
- 用户必须能就地关闭当前提示，且关闭/敏感状态变化要能撤销已显示提示并拦截尚未返回的异步召回结果。
- RingCentral 这类动态页面必须按会话和最近消息重新评估。

## 已知边界

- 普通网页的 snippet 仍是通用主内容抽取，对复杂应用页面不一定准确。
- 目前有 24 小时站点暂停和设置页恢复入口，但还没有永久站点 allow/deny 列表。
- 内容脚本已有 helper 级验证和浏览器脚本验证，仍缺常驻的完整站点适配器测试矩阵。

## 后续方向

1. 增加永久站点级 allow/deny 设置，尤其是隐私敏感页面。
2. 在 context recall 结果里展示更明确的来源类型和时间。
3. 为内容脚本增加可复用的浏览器端测试 harness，覆盖 SPA 切换、关闭提示和跳转链接。

## 与 Context Assist 的关系

`Memory Composer Guard` 已纳入 `Context Assist / 情境助理`，不再作为独立 progressing 方案推进。它和 `webpage_memory_detection` 共享页面上下文探测、敏感场景跳过、SPA 切换清理和 memory-service recall 能力。

当前分层：

| 层 | 职责 | 当前来源 |
|---|---|---|
| `SiteContextAdapter` | 判断站点、构造页面/会话 snapshot、生成 context key | `src/composer-guard/siteContextAdapters.ts` |
| `RingCentralMessageAdapter` | 提取 conversation id、标题、可见消息、thread root、composer | `src/composer-guard/siteContextAdapters.ts` + `message-reaction/SnoozeManager.ts` |
| `ContextRecallController` | 根据 snapshot 调 `/context-recall`、缓存、处理敏感场景和站点静默 | `contentScriptWebIntelligence.ts` |
| `AmbientMemoryBubble` | 右下角相关记忆提示 | 当前 `.pai-context-bubble` / `.pai-context-card` |
| `ComposerGuardController` | 监听输入框 focus/draft、调用 `/composer/assist`、显示输入框旁 chip | `src/composer-guard/*` |
| `ContextAssistService` | 统一会前准备与写作护航的 cue cards / evidence 编排 | `memory-service/src/core/ContextAssistService.ts` |

RingCentral 的上下文策略应保持一致：

- 会话切换时，仍以 URL 中的 `conversationId`、标题、可见消息 id、文本签名构造 context key。
- 浏览器端只读取可见消息，默认最近 6 条；不滚动虚拟列表抓完整历史。
- Composer Guard 若需要更多历史，应让 memory-service 按 `group_id`、`source_url`、`metadata_json.postId` 从 `messages_raw` 补水。
- thread reply 必须读取 thread 原帖；若原帖不在 DOM 中，传 `threadRootPostId` / `chainId` 给后端补水。

这样 `webpage_memory_detection` 继续负责“当前页面有相关记忆”的 ambient 提醒，`Context Assist` 负责“当前草稿/会议发生前是否漏了关键记忆”的场景化提示。完整功能文档见 [`context_assist.md`](./context_assist.md)。
