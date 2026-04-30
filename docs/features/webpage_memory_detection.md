# 网页记忆探测与提示

*最后更新: 2026-04-30*

## 概述

这个功能负责在用户浏览网页或 RingCentral 消息会话时，静默判断当前上下文是否和记忆系统里的历史内容相关。如果命中，会在页面右下角显示一个轻量记忆 icon，用户点开后可以看到命中的摘要、来源和跳转到记忆探索页的入口。

当前线上主链路是：

- `src/contentScriptWebIntelligence.ts`
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

- 跳过 Chrome 内部页、扩展页、Meeting Pilot 已接管的 `v.ringcentral.com/conf/on/*` 页面和部分低价值域名。
- 监听 DOM 变化、focus、`hashchange`、`popstate`，并用 URL 轮询补足 SPA 路由变化。
- 对普通网页使用标题、meta keywords、主内容摘要生成上下文。
- 对 RingCentral 消息页使用会话级上下文，而不是整页 body。
- 按上下文 key 缓存召回结果，TTL 为 5 分钟。
- 用户关闭某个提示后，当前上下文在 30 分钟内不会反复弹出。

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
- 卡片右上角可以关闭当前提示；关闭后同一上下文短时间内不再打扰。

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
- Microsoft Recall 强调从一开始让用户选择、可以暂停、过滤网站和删除数据。
- Notion AI connectors 强调跨工具检索要尊重原工具权限，并显示引用来源。
- Mem0 contextual add v2 强调会话级上下文自动管理，避免调用方每次传完整历史。
- MemGPT / LongMem / MemoryAgentBench 都指向同一个工程要求：记忆系统必须能准确召回、可更新、避免 stale context，并能选择性遗忘。

因此，本功能的产品原则是：

- 只在上下文足够明确时提示。
- 提示必须带来源和跳转。
- 旧上下文切换时必须清理。
- 用户必须能就地关闭当前提示。
- RingCentral 这类动态页面必须按会话和最近消息重新评估。

## 已知边界

- 站点适配器还没有抽象出来，RingCentral 特化逻辑仍在 `contentScriptWebIntelligence.ts` 内。
- 普通网页的 snippet 仍是通用主内容抽取，对复杂应用页面不一定准确。
- 目前只有页面内关闭当前提示，还没有全局“关闭此站点记忆提示”的设置入口。
- 还没有针对内容脚本的常驻单元测试；当前主要依赖构建和浏览器脚本验证。

## 后续方向

1. 抽出 `SiteContextAdapter`，把 Generic / RingCentral / Jira / Google Docs 的上下文提取分离。
2. 增加站点级静默设置，尤其是隐私敏感页面。
3. 在 context recall 结果里展示更明确的来源类型和时间。
4. 为内容脚本增加可复用的浏览器端测试 harness，覆盖 SPA 切换、关闭提示和跳转链接。
