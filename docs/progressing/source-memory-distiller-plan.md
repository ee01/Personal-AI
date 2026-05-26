# 新能力：Source Memory Distiller / 资料记忆蒸馏台

> Codex 会话标题建议：新能力：资料记忆蒸馏台  
> Demo: [source-memory-distiller-demo.html](./source-memory-distiller-demo.html)

## 结论

这轮没有从 Reminders 选题：本机 Reminders 可见列表里没有 `Personal AI` 清单，因此没有新的 Reminder idea 可随机选择，也没有需要标记 done 的事项。

我建议评估一个新能力：**Source Memory Distiller / 资料记忆蒸馏台**。它解决的是一个很日常但现在还没被 Personal AI 系统化解决的问题：用户看过一篇长网页、一段 YouTube/会议录音、一个 Google Doc/Slides、NotebookLM 资料包、AI 周报或论文后，Personal AI 不只要记住“我看过这个链接”，而要把它变成以后可召回、可引用、可交给其他 AI 的**资料记忆**。

一句话：**当用户认真阅读/观看/高亮某份资料时，Personal AI 在当前页面旁边生成一张可确认的资料记忆卡，把来源证据、用户为什么关心、可沉淀的事实/概念/流程/开放问题、未来触发场景一起保存下来。**

## 为什么值得做

Personal AI 的长期目标是保存用户和 AI、网页、会议、消息、操作、偏好、skill 等所有记忆，并在真实场景里提供关联提示。现在系统已经在多个方向有能力基础：

- 消息、会议、日程、Jira、AI 对话等已经能进入 Memory Service。
- Memory Lens 解决“当前页面/场景旁边应该提示哪些相关记忆”。
- Memory Day Pilot 解决“今天有哪些具体事项值得处理”。
- Context Passport 解决“把一件事的上下文交给外部 AI”。
- Personal Skill Foundry 解决“把可复用流程沉淀为 skill”。
- Memory Freshness Radar 解决“旧来源变了，哪些记忆需要更新”。

但中间缺一个关键体验：**资料从被看见到被长期复用之间的沉淀层**。

真实用户不会希望系统把所有浏览历史都变成长期记忆；也不想每次看到有价值资料都手工复制、总结、打标签。用户真正需要的是：

1. **低打扰保存**：我认真读过、划过重点、复制过内容、停留足够久时，系统才提示“这份资料值得沉淀吗”。
2. **证据不丢**：以后 AI 引用这条资料记忆时，能回到原文段落、视频时间点、文档页码或会议片段。
3. **用途一起记住**：不只存摘要，还要存“它和我的哪个项目、会议、skill、AI 讨论有关”。
4. **未来可触发**：下次打开 CoP 准备表、AI 周会、NotebookLM 讨论、Jira issue、ChatGPT 输入框时，这张资料记忆能以正确粒度出现。
5. **避免脏入库**：网页噪声、广告、随手划过的内容、低相关泛 AI 新闻不应该污染长期记忆。

## 本次输入信号

### Reminders 检查

本机 Reminders 可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`，没有 `Personal AI` 清单。

### 真实记忆查询

通过 `10.32.56.212` 查询 `esone.qiu` 的真实记忆时，`/api/v1/stats` 可读，`/health` 仍显示 degraded。`/recall` 和 `/profile/items` 本轮超时，所以改用 SSH + SQLite immutable 只读查询。

当前数据规模大致为：

- `messages_raw`: 9493 条，其中 `glip` 8697、`meeting` 349、`calendar` 210、`system` 209、`jira` 17。
- `entities`: 13665，`relationships`: 49286。
- `reflection_threads`: active 593。
- `proposed_actions`: executed 342、pending 45。
- `personal_skills`: active 3、suggestion 2。

和本能力直接相关的真实信号：

- 日程里出现 `CoP - 基于AI的个人发展和工具`，说明用户会围绕 AI 工具和个人发展准备材料、分享资料。
- 日程里出现 `AI Refresh: Mastering Google AI Studio, Gems, and NotebookLM`，说明 NotebookLM/Gemini/Gems 这类“资料理解工具”已经进入用户工作环境。
- Glip 里有 `AI Insight Hub | AI 智汇圈` 周报类资料，内容包含新 AI 产品、工具和实践趋势；这些资料如果只是作为消息存起来，后续很难按“我当时关心什么”召回。
- 用户 profile 已确认 `role=scrum master`，同时有大量项目管理、Jira、会议、AI 工具、release/sprint 相关待确认画像；资料沉淀对 Scrum Master 的场景价值很高：会前准备、CoP 分享、release 风险解释、AI 工具选型、团队实践复盘。

## 和已有 progressing 的边界

| 已有方向 | 主问题 | 本能力不重复的点 |
| --- | --- | --- |
| Memory Lens | 当前页面/会议/输入框旁提示相关记忆 | Distiller 是“新资料如何入库并变成可复用记忆”，不是已有记忆的展示入口 |
| Memory Freshness Radar | 已保存来源变化后，哪些记忆需要更新 | Distiller 是首次沉淀和结构化；Freshness 可作为后续 source watcher |
| Memory Coverage Map | 哪些来源没接入、哪些记忆覆盖不足 | Distiller 处理单份长资料的保存体验和抽取结构 |
| Operation Memory Flight Recorder | 用户操作路径、步骤和失败重试 | Distiller 处理资料内容、证据和知识，而不是操作轨迹 |
| Personal Skill Foundry | 可执行流程沉淀为 skill | Distiller 可能发现 skill candidate，但不会直接替代 skill 管理 |
| AI Context Passport | 把当前任务上下文导出给另一个 AI | Distiller 产出可被 Passport 消费的资料记忆，不是一次性上下文包 |
| Context Gap Radar | 执行前发现缺少哪些信息 | Distiller 可补充资料来源，但不做任务 preflight 问答 |
| Memory Reality Check | 校验 AI 输出事实是否和记忆冲突 | Distiller 保存源证据；Reality Check 以后可引用这些证据 |
| Ambient Recall Calibration | 用真实使用信号校准召回质量 | Distiller 会产生保存/忽略/引用信号，可作为校准输入，但不是校准平台 |
| Memory-like-human 研究稿 | 总体记忆架构和脑科学类比 | Distiller 是一个可落地的用户体验切片，避免继续停留在通用架构层 |

## 业内产品与趋势参考

### NotebookLM：资料理解从“摘要”走向多模态 source workspace

[Google NotebookLM](https://notebooklm.google/) 已经把 PDF、网站、YouTube、音频、Google Docs/Slides 等资料放进一个 source-grounded workspace。Google 官方介绍里也提到，NotebookLM 可以给 YouTube/音频生成转录理解、带引用探索、study guide 和 Audio Overview。

对 Personal AI 的启示：

- 资料不是单条网页收藏，而是一个可问答、可输出、可引用的 source package。
- NotebookLM 强在 source workspace，但它不是用户所有记忆的统一系统；Personal AI 的机会是把资料和用户的消息、会议、Jira、AI 对话、偏好、skill 连接起来。

参考：

- [Google NotebookLM](https://notebooklm.google/)
- [NotebookLM adds audio and YouTube support](https://blog.google/innovation-and-ai/products/notebooklm-audio-video-sources/)

### Granola MCP：会议资料正在进入其他 AI 工作流

[Granola MCP](https://docs.granola.ai/help-center/sharing/integrations/mcp) 允许 Claude、ChatGPT 等 AI 工具查询 Granola 会议笔记、transcripts、action items 和 meeting insights。Granola 的官方博客也明确提到：用户常在 Claude、ChatGPT、Cursor 里工作，但需要“上周会议里说过的内容”。

对 Personal AI 的启示：

- 资料记忆最终必须能进入用户正在使用的 AI 工具，而不是只能停留在 Personal AI 页面里。
- MCP/Context Passport 可以是 Distiller 的下游出口，但前提是资料本身先被可靠沉淀。

参考：

- [Granola MCP docs](https://docs.granola.ai/help-center/sharing/integrations/mcp)
- [Introducing Granola MCP](https://www.granola.ai/blog/granola-mcp)

### Readwise Reader：高亮、稍后读和复习说明“主动选择”很关键

[Readwise Reader](https://docs.readwise.io/reader/docs) 的核心不是自动保存所有网页，而是围绕阅读、highlight、annotation、library 和 review 做长期沉淀。Readwise 的 highlight review 机制也说明：用户主动标出的片段，比浏览历史本身更能代表长期价值。

对 Personal AI 的启示：

- Distiller 不应该全自动吃掉浏览历史；高亮、停留、复制、二次打开、用户点击“保存资料记忆”才是更可靠的信号。
- 后续可把“被引用、被展开、被用于 Context Passport”作为类似复习的强化信号。

参考：

- [What is Readwise Reader](https://docs.readwise.io/reader/docs)
- [Reviewing your highlights](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights)

### OpenAI / Claude 记忆：平台内记忆变强，但跨资料和跨场景仍需要用户拥有

[ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-in-chatgpt-faq) 已经开始强调 Memory Sources；[OpenAI context personalization cookbook](https://cookbook.openai.com/examples/agents_sdk/context_personalization) 把 personalization 视为 context engineering；[Claude memory/chat search](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context) 和 [Claude context management](https://claude.com/blog/context-management) 也说明长任务需要上下文管理、搜索和 memory tool。

对 Personal AI 的启示：

- 单个平台可以记住一部分偏好和对话，但用户的资料来源分散在浏览器、会议、RingCentral、Jira、Google Docs、NotebookLM、ChatGPT、豆包、Codex 等多个地方。
- Distiller 的定位不是再做一个聊天机器人，而是把用户真正关心的资料转成用户拥有、可审计、可迁移的记忆对象。

## 相关论文与技术依据

### Mem0：长期记忆需要动态提取、整合、检索

[Mem0](https://arxiv.org/abs/2504.19413) 强调从持续对话中动态抽取、整合和检索显著信息，并用结构化长期记忆降低上下文窗口压力、延迟和 token 成本。

对 Distiller 的启示：资料保存不应只存全文 chunk，而要把“显著信息、关系、后续用途”抽出来，并保留来源证据。

### MemMachine：保留 episode ground truth 比只做摘要更可靠

[MemMachine](https://arxiv.org/abs/2604.04853) 强调保留完整 conversational episodes，减少有损 LLM 抽取，并在检索阶段通过上下文扩展和格式优化提高准确性。

对 Distiller 的启示：资料记忆卡应该同时保存：

- 原始 source anchor，例如 URL、段落、页码、视频时间点、文档版本；
- 压缩后的概念/事实/流程卡；
- 抽取结果和原文证据之间的引用关系。

### A-MEM：记忆需要动态连接成知识网络

[A-MEM](https://arxiv.org/abs/2502.12110) 借鉴 Zettelkasten，把新记忆组织为带上下文、关键词、标签和链接的动态知识网络，新记忆可以更新旧记忆的表示。

对 Distiller 的启示：一份新资料不应孤立保存，而要自动连接到已有项目、人、会议、skill、AI 工具、旧资料和未解决问题。

### MIRIX：真实记忆不止文本，还包括视觉/资源/知识库

[MIRIX](https://arxiv.org/abs/2507.07957) 把记忆拆成 core、episodic、semantic、procedural、resource memory、knowledge vault 等类型，并覆盖屏幕/多模态场景。

对 Distiller 的启示：资料记忆应该有明确类型分层：原始资源、情节证据、语义知识、流程候选、触发策略，而不是都塞进一个 summary 字段。

## 核心产品定义

### 一句话产品承诺

**看过的重要资料，不再只是浏览历史；它会变成可引用、可触发、可交给 AI 的私人资料记忆。**

### 目标用户

第一目标用户就是当前 Personal AI 的真实使用者：

- 经常看 AI 工具/产品/论文/内部周报，并要转化为 CoP 分享、团队实践或个人工具选型。
- 作为 Scrum Master，经常需要把会议、Jira、release、团队讨论和资料中的信息拼成清晰判断。
- 经常让 Codex/Claude/ChatGPT/豆包/OpenClaw 先跑一遍任务，希望 AI 拿到的是干净、可信、场景相关的资料上下文。

### 不是

- 不是全量浏览器历史记录器。
- 不是 NotebookLM 复制品。
- 不是网页摘要弹窗。
- 不是新的独立知识库页面优先。
- 不是强制用户每篇文章都审一遍。
- 不是把所有 highlight 都永久写入核心画像。

### 是

- 当前页面/资料旁的轻量保存与蒸馏层。
- 可追溯的资料记忆 capsule。
- Memory Lens、Context Passport、Day Pilot、Skill Foundry、Freshness Radar 的上游素材层。
- 用户意图驱动的“看过 -> 记住为什么 -> 以后何时出现”闭环。

## 核心对象模型

### Source Memory Capsule

一份被确认保存的资料记忆。建议字段：

```ts
type SourceMemoryCapsule = {
  id: string;
  userId: string;
  sourceKind: 'webpage' | 'youtube' | 'audio' | 'pdf' | 'google_doc' | 'google_slide' | 'notebooklm' | 'ai_chat' | 'manual';
  sourceUrl?: string;
  sourceTitle: string;
  sourceAuthor?: string;
  sourcePublishedAt?: number;
  capturedAt: number;
  lastCheckedAt?: number;
  sourceFingerprint: string;
  userIntent: string;
  relevanceScope: Array<'project' | 'meeting' | 'skill' | 'ai_tool' | 'personal_learning' | 'relationship' | 'decision'>;
  linkedEntities: Array<{ type: string; id?: string; name: string; confidence: number }>;
  summary: string;
  keyTakeaways: SourceTakeaway[];
  openQuestions: SourceOpenQuestion[];
  evidenceAnchors: SourceEvidenceAnchor[];
  futureTriggers: SourceMemoryTrigger[];
  privacyLevel: 'private' | 'work' | 'shareable_summary' | 'needs_review';
  status: 'draft' | 'saved' | 'archived' | 'stale' | 'dismissed';
};
```

### Source Evidence Anchor

不要只保存摘要。每条 takeaways 必须能回到证据：

```ts
type SourceEvidenceAnchor = {
  id: string;
  capsuleId: string;
  anchorKind: 'text_range' | 'video_timestamp' | 'audio_timestamp' | 'slide_page' | 'doc_heading' | 'screenshot_region';
  locator: string;
  quoteOrPreview: string;
  confidence: number;
  sensitivity: 'normal' | 'internal' | 'private' | 'secret_like';
};
```

### Source Takeaway

```ts
type SourceTakeaway = {
  id: string;
  kind: 'fact' | 'concept' | 'workflow' | 'tool_capability' | 'risk' | 'decision_input' | 'skill_candidate';
  title: string;
  body: string;
  evidenceAnchorIds: string[];
  confidence: number;
  suggestedMemoryLayer: 'temporary' | 'working' | 'semantic' | 'procedural_candidate' | 'profile_candidate';
  requiresUserConfirmation: boolean;
};
```

### Source Memory Trigger

```ts
type SourceMemoryTrigger = {
  id: string;
  triggerKind: 'scene' | 'entity' | 'calendar' | 'composer' | 'search' | 'day_pilot' | 'freshness_watch';
  description: string;
  matcher: Record<string, unknown>;
  defaultBehavior: 'quiet_match' | 'show_memory_lens_card' | 'offer_context_pack' | 'include_in_day_pilot' | 'watch_source_change';
};
```

## 核心 UX

### 入口 1：当前网页/文档旁的 Distill Chip

触发条件建议保守：

- 页面正文长度超过阈值，并且域名/页面类型在允许范围内。
- 用户停留超过 45-90 秒。
- 用户有 highlight、copy、scroll depth、二次访问、手动点击扩展图标等主动信号。
- 当前页面和已有项目/日程/会议/AI 工具主题有实体重合。

默认只显示一个低打扰 chip：`保存为资料记忆`。不自动弹大面板。

### 入口 2：选中文字后的 Mini Distill

当用户选中一段文字时，在选区附近出现小图标或菜单项：

- `保存片段到资料记忆`
- `加入当前资料卡`
- `用这段查关联记忆`

这和 Memory Lens 的 selected-text lookup 可以共用入口，但动作不同：Lens 是查已有记忆，Distiller 是把片段沉淀到资料记忆。

### 入口 3：Meeting / CoP / Day Pilot 中的资料候选

如果日程里出现 `CoP - 基于AI的个人发展和工具`，Day Pilot 可以提示：

> 有 3 份最近阅读的 AI 资料可加入本次 CoP 准备。

用户展开后看到资料卡，而不是一堆原始链接。

### 入口 4：Context Passport / 外部 AI 输入框

当用户在 ChatGPT/Claude/豆包/Codex 输入框里写：

> 帮我准备一个关于 NotebookLM / AI 工具个人发展的分享

Context Assist 可以引用 Distiller 保存的资料记忆，生成一个带证据的 context pack。

## 面板信息结构

右侧面板建议分成 5 个固定区域：

1. **保存意图**：为什么这份资料值得记住，可自动建议，用户一键改成自己的话。
2. **资料摘要**：3-5 条 takeaways，按 `事实 / 概念 / 流程 / 风险 / skill 候选` 标注。
3. **证据锚点**：每条 takeaway 右侧有来源段落、视频时间点或文档页码。
4. **未来触发**：这张资料以后应该在什么场景出现，例如 CoP、AI 工具讨论、NotebookLM、Jira、会议准备。
5. **保存边界**：保存到哪个记忆层，是否包含敏感片段，是否需要确认后才能外发给其他 AI。

## 用户交互原则

### 1. 默认不自动长期保存

系统可以生成 draft capsule，但进入长期记忆必须满足至少一个条件：

- 用户点击保存；
- 用户连续多次对该资料展开/高亮/复制，并且设置中允许“强兴趣资料自动保存为 draft”；
- 资料来自明确配置的工作来源，例如用户主动导入的 NotebookLM/Google Doc/AI 周报频道。

### 2. 摘要不等于事实

LLM 生成的 takeaway 初始只是 `draft`。如果它会进入 confirmed facts、profile、skill 或对外 Context Passport，应保留 `requiresUserConfirmation`。

### 3. 不把普通浏览当偏好画像

用户看过一篇文章，只能说明“这份资料曾被关注”，不能直接推断“用户喜欢/支持这个观点”。如果要写入 `user_profile_items`，必须走 profile confirmation。

### 4. 先保存证据，再保存结论

如果抽取失败，也可以保存 source capsule + evidence anchors，让后续重新蒸馏；不要因为摘要失败丢掉来源。

### 5. 不干扰阅读

默认 chip 小，面板可收起；大面板只在用户点击保存、打开扩展或显著主动行为后出现。

## 与现有系统的集成

### Memory Service

建议新增或复用以下表/接口：

- `source_memory_capsules`
- `source_memory_anchors`
- `source_memory_takeaways`
- `source_memory_triggers`
- `source_memory_feedback`

API 草案：

```http
POST /api/v1/source-memory/candidates
POST /api/v1/source-memory/capsules
GET  /api/v1/source-memory/capsules/:id
POST /api/v1/source-memory/capsules/:id/save
POST /api/v1/source-memory/capsules/:id/dismiss
POST /api/v1/source-memory/capsules/:id/feedback
POST /api/v1/source-memory/capsules/:id/render-context-pack
```

### Chrome Extension

内容脚本负责：

- 判断页面类型和正文候选。
- 提取标题、URL、正文结构、用户选区、scroll depth、copy/highlight 信号。
- 显示 chip 和 side panel。
- 对 YouTube/视频页尽量读取 transcript 或页面可见 captions；没有 transcript 时只保存 URL/title/user intent，不做假摘要。

### Context Recall

`/context-recall` 增加可选 source type：

```ts
sourceTypes: ['source_memory']
```

返回时要带：

- `whyRelevant`: 为什么这份资料和当前场景相关。
- `sourceAnchorPreview`: 证据片段。
- `sendability`: 能否直接给外部 AI，还是只能本地看。

### Day Pilot

当 source memory trigger 命中日程或今天任务时，Day Pilot 可以生成单张具体 mission：

> `CoP 分享准备：3 份 AI 工具资料可整理成 5 分钟分享`

而不是把它放进泛泛的“资料”分类。

### Skill Foundry

如果 takeaways 中有 `workflow` 或 `skill_candidate`，只创建 skill suggestion，不直接生成 active skill。

### Freshness Radar

用户保存 capsule 时可以选择：

- `不监控来源`
- `来源变化时提醒`
- `只在下次引用前检查`

## 排名与触发策略

### 资料候选分数

建议用保守加权：

```text
candidateScore =
  sourceQualityScore * 0.25 +
  userIntentScore * 0.30 +
  entityOverlapScore * 0.20 +
  interactionDepthScore * 0.15 +
  noveltyScore * 0.10
```

其中：

- `sourceQualityScore`: 文档/视频/文章是否可解析、是否有作者/日期、是否是工作可信域名。
- `userIntentScore`: 停留、选中、复制、二次打开、手动点击保存。
- `entityOverlapScore`: 和日程、项目、Jira、会议、AI 工具、已有记忆的实体重合。
- `interactionDepthScore`: scroll depth、阅读时间、highlight 数量。
- `noveltyScore`: 和已有资料的差异。

如果 `userIntentScore` 低，不应自动弹出大面板。

### 保存后召回分数

```text
recallScore =
  sceneMatch * 0.35 +
  entityMatch * 0.25 +
  savedIntentMatch * 0.15 +
  evidenceQuality * 0.10 +
  freshness * 0.10 +
  userFeedback * 0.05
```

## MVP 范围

### P0：网页/文档片段资料记忆

目标：先做最小可用闭环。

- 支持普通网页、Google Docs/Slides 只读可见文本、AI 周报类消息页面。
- 支持选中文字保存和整页保存 draft。
- 生成 source capsule、3-5 条 takeaways、evidence anchors、future triggers。
- 在 Memory Exploring 或现有搜索结果里能查到 source capsule。
- Context Recall 能返回 source memory card。
- HTML demo 模拟集成在外部网页里的侧栏。

不做：

- 不做全量浏览历史。
- 不做视频深度解析。
- 不做自动创建 skill。
- 不做复杂 freshness watch。

### P1：YouTube/音频/会议录音资料

- 读取公开 transcript / captions。
- 支持时间戳 evidence anchors。
- 可以生成“用于 CoP/会议分享”的 brief。
- 和 Meeting Pilot 的 transcript source 统一 evidence 模型。

### P2：NotebookLM / Google Drive source workspace

- 支持用户主动把 NotebookLM、Google Doc/Slides、PDF 作为 source bundle 保存。
- 把一组资料沉淀成一个 topic-level source capsule。
- 支持“本周 AI 工具资料包”“某项目 release 资料包”。

### P3：跨 AI 资料接力

- 在 ChatGPT/Claude/豆包/Codex 输入框旁显示可用资料记忆。
- 可一键插入最小 context pack。
- 对外发资料走 Memory Egress Firewall 或同等 sendability 检查。

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| 保存太多网页噪声 | 必须有用户意图信号；默认只生成 draft，不长期入库 |
| 摘要幻觉 | 每条 takeaway 绑定 evidence anchor；无证据则标为 open question |
| 用户被审阅打扰 | 只在保存时展示 3-5 条核心内容；细节可折叠 |
| 把阅读推断成偏好 | 不直接写 profile；偏好类必须走确认 |
| 内部资料外泄 | 每个 anchor 有 sensitivity；Context Passport 使用前检查 sendability |
| 与 NotebookLM 重复 | Personal AI 不做完整 source workspace，而做用户私有跨场景记忆层 |
| 与 Memory Lens 重复 | Lens 展示旧记忆；Distiller 保存新资料，并产生 Lens 可用的记忆对象 |

## 真实使用场景

### 场景 1：准备 AI CoP 分享

用户看到公司 AI 周报里介绍 NotebookLM、Gemini Gems、Claude context management。页面右侧出现小 chip。用户选中两段关于 NotebookLM 和 MCP 的内容，点击 `保存为资料记忆`。

Personal AI 自动生成：

- 保存意图：`用于 6 月 4 日 CoP - 基于AI的个人发展和工具分享`
- 3 条 takeaways：NotebookLM 适合 source-grounded study；Granola MCP 说明会议记忆会进入外部 AI；长期记忆要保存证据而非只存摘要。
- 未来触发：当打开 CoP 日程、Google Sheet 准备表、ChatGPT 输入“准备 AI 工具分享”时展示。

到 CoP 当天，Day Pilot 给出一张具体 mission：`整理 AI 工具资料为 5 分钟分享`，点开后直接有证据和可复制的分享提纲。

### 场景 2：看论文/产品文档后让 Codex 设计功能

用户阅读 MemMachine 或 A-MEM 论文摘要，选中“保留 episode ground truth”和“动态链接记忆网络”的段落保存。

几天后用户在 Codex 里说：

> 给 Personal AI 设计一个资料入库能力，别只做网页摘要。

Context Assist 从 source memory 中找到这两条资料记忆，并生成 context pack：

- 不要只存 summary。
- 保留 source anchor。
- 资料应该连接到 project/person/skill/meeting。
- 低置信提取必须等待确认。

用户不需要重新翻论文，也不需要把所有资料复制给 Codex。

## 验证建议

如果后续决定实现，验证顺序建议：

1. `source-memory` service 单元测试：candidate scoring、save/dismiss、anchor/takeaway 关系、sendability。
2. `context-recall` 测试：source memory 命中当前场景时返回 `whyRelevant` 和 evidence preview；不相关时安静。
3. `npm start` 首次 webpack compile。
4. Playwright extension E2E：模拟网页、选中文字、保存资料记忆、刷新后仍能查到 capsule。
5. `git diff --check`。

## 这轮产物

- Plan: `docs/progressing/source-memory-distiller-plan.md`
- Demo: `docs/progressing/source-memory-distiller-demo.html`

