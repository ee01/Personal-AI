# 新能力：Memory Outcome Loop / 记忆成效回路

> 生成时间：2026-06-09 CST
> Codex 会话标题建议：`新能力：记忆成效回路`
> 交付物：完整 plan + 可预览 demo
> Demo：[`memory-outcome-loop-demo.html`](./memory-outcome-loop-demo.html)

## 结论

建议设计一个新的 Personal AI 底层能力：**Memory Outcome Loop / 记忆成效回路**。

它不是新的搜索页、不是又一个 review queue，也不是简单的 thumbs up/down。它要给 Personal AI 的每一次“记忆介入”建立一条轻量成效账本：

- 哪条记忆、反思、会议信号、Jira 证据或个人偏好被拿来提示用户。
- 它出现在什么场景里：聊天、会议、Jira、外部 AI composer、Day Pilot、Ask、Memory Lens、OpenClaw 委派等。
- 用户做了什么：忽略、展开、复制、插入、编辑后发送、标记不相关、转给外部 AI、交给 OpenClaw。
- 后续发生了什么：消息是否发出、Jira 是否被打开/修改、会议后是否有跟进、Ask 是否还在反复问同一个问题、OpenClaw 是否失败、confirm request 是否减少。
- 下次系统应该怎样调整：减少同类噪声、提升真正有用的来源、压低失败动作、把成功流程送给 Skill Foundry。

一句话：

> Personal AI 不只要记住“我看过什么、AI 建议过什么”，还要记住“哪条记忆真的帮我推进了事情”。

本能力的产品形态应该是一个后台学习回路，加少量嵌入式 UI。用户日常只看到更准、更少、更能解释的提示；只有需要排障或复盘时才打开成效详情。

## 2026-06-09 反馈澄清：这个 plan 的真实边界

这不是一个“把所有记忆重新存一遍”的底层重构，也不是一个新的主页面。

更准确地说，它是一个**记忆提示出现之后的成效回路**：

```text
已有召回/提示生成
  -> 记录这次为什么把某条记忆展示给用户
  -> 复用现有反馈、展开、复制、插入、发送、失败、重复追问等信号
  -> 评估这次介入有没有帮上忙
  -> 写入可撤销的排序/静默/合并策略
  -> 下次召回或行动建议时读取这些策略
```

它不主要优化“存储”或“提取”的第一步：

- **不是录入优化**：不决定一条网页/会议/消息是否应该入库，这部分属于 Memory Capture、Intake、Lifecycle 等能力。
- **不是原始检索算法替换**：不替代 `/context-recall`、Scene Memory Autopilot、MemoryContextMatchService、vector/FTS/rerank。
- **不是用户维护页面**：可以有 `memory-exploring.html#/outcomes` 诊断页，但它不是核心体验，不是让用户看“A 记忆将用于什么场景、B 记忆将用于什么场景”的规划表。
- **不是新建 thumbs-down drawer**：Memory Lens 现有 thumb-down 后的原因面板已经覆盖“只是主题相似 / 群组或项目不对 / 空页面误触发”等反馈。Outcome Loop 应该消费这些已有 feedback event，而不是重复实现一套原因选择 UI。

它主要优化的是**提示之后到下一次提示之前**这一段：

- 这条提示被用户展开了吗？
- 用户点了现有的有用/不相关原因吗？
- 用户把建议插入草稿了吗？
- 插入后是否大量改写？
- 是否真的发送了？
- 后续是否解决了问题，还是又问了一遍？
- 外部核实 / OpenClaw action 是成功、失败，还是反复缺能力？
- 同类提示下次应该增强、静默、合并，还是要求更强证据？

因此如果用一句产品边界概括：

> Outcome Loop 不负责“第一次想起哪条记忆”，它负责“系统想起并提示之后，如何根据真实结果学会下次少打扰、少重复、少失败”。

### 关于“estimate 口径是人天”这种精准提示

文档原来的例子写得过于像 P0 承诺了。需要收紧：

`Memory Outcome Loop` 本身不能凭空把普通关联记忆变成“estimate 口径是人天”这种精准业务 cue。要做到这类提示，前置还需要已有或另一个切片提供：

1. **场景锚点**：当前页面或输入框明确是 Jira estimate / Q3 planning / original estimate / due date 场景。
2. **结构化记忆或强摘要**：记忆里不只是“聊过 estimate”，而是抽出了 `unit = 人天 / 也可 3h`、`field = original estimate`、`规则 = close 无硬要求` 这类可复用片段。
3. **Cue Compiler**：把召回结果从“相关记忆”压成一句可行动提示，而不是直接展示原始片段。
4. **证据边界**：卡片能说明这句话来自哪个 Glip/Jira/日历来源，不能把推断当事实。

Outcome Loop 的作用是：当这类 cue 已经由 Memory Lens / Compose Assist / Ask 生成并展示后，记录它是否真的被采用、是否被编辑、是否解决了后续追问。多次有效后，下次类似 estimate 场景可以更早、更短地展示；多次无效则降权或静默。

所以这个能力**可以帮助精准提示变得越来越稳定**，但不应被理解为“只做 Outcome Loop 就能立刻产出精准提示”。如果下一步要实现这个方向，P0 应该先选一个具体链路：

```text
Jira/Glip estimate 场景锚点
  + 已有 context-recall 候选
  + 小型 Cue Compiler
  + Outcome Loop 记录采纳/忽略
```

而不是泛化地宣称所有 Memory Lens 关联都会变成精准业务建议。

### 用户额外操作成本约束

按当前收紧后的定义，P0 **不应该增加用户日常操作**。

P0 只消费用户本来已经会产生的信号：

- Memory Lens 已有的有用 / 不相关反馈和不相关原因。
- 用户是否展开卡片、打开来源、关闭提示。
- Compose Assist 已有的插入、复制、编辑、发送结果。
- Ask 是否被同义重复追问、是否创建 confirm request。
- proposed action / OpenClaw action 是否 succeeded、failed、dead_letter。
- Meeting Pilot / Day Pilot 已有的确认、忽略、完成、复制等动作。

也就是说，第一版不新增“请评价这次提示”“请选择原因”“请确认这条 outcome”这类额外步骤。

允许增加的只有低打扰、非必需的可见性：

- 已有卡片 footer 里多一个很短的状态回执，例如 `已记录为不相关，将减少同类提示`。
- 详情里多一个可展开的成效时间线，用于排障，不要求用户打开。
- 高风险或高责任边界仍沿用现有确认路径，例如外发、长期画像写入、外部动作执行，不因 Outcome Loop 新增日常确认。

因此验收标准应写死：

```text
P0 explicit user actions added = 0
P0 must reuse existing feedback/action events
P0 cannot introduce a new review queue
P0 cannot block the user's current flow while waiting for outcome feedback
```

如果某个实现切片必须新增按钮，它应该先证明该按钮替代了一个现有更重的操作，而不是把 outcome learning 的成本转嫁给用户。

## 2026-06-09 研究补充：场景锚点 + 结构化记忆 + Cue Compiler

用户追问后，这里需要把一个关键前置能力写清楚：

> 要实现“上次 estimate 口径是人天”这种精准提示，不能只靠 Outcome Loop。需要先把当前场景结构化成锚点，把记忆结构化成可复用事实/强摘要，再由 Cue Compiler 把候选压成一句可行动提示。Outcome Loop 只在 cue 已经出现后，学习它是否应该更早、更短、更少打扰。

### 业内和研究结论

调研后可以归纳成几条约束：

1. **Context Engineering 不是把更多文本塞进 prompt。**
   Anthropic 在 [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 里把 context engineering 视为 prompt engineering 之后的自然演进，重点是 compaction、structured note-taking / agentic memory、避免 context pollution。对 Personal AI 的含义是：Memory Lens 不应该把“相关片段”直接展示给用户，而应该先裁剪成当前任务需要的 cue。
2. **Retrieval 需要给 chunk 补上下文，而不是只存原文。**
   Anthropic 的 [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) 把每个 chunk 先生成 50-100 tokens 的 chunk-specific context，再进入 embedding 和 BM25；他们报告 Contextual Embeddings 将 top-20 retrieval failure 降低 35%，结合 Contextual BM25 降低 49%。对本项目的含义是：`chunks` / `source_memory` 里应增加“这段记忆在什么业务语境下可复用”的检索上下文，而不是只依赖 raw message 相似度。
3. **行业产品强调 grounding、权限和可核查来源。**
   Microsoft Copilot 的 [grounding 说明](https://support.microsoft.com/en-US/Microsoft-365-Copilot/what-information-does-copilot-use-to-answer-my-prompt) 明确区分 work/web/local grounding，并提醒用户核查来源、权限和过期文件；Google [NotebookLM source guide](https://support.google.com/notebooklm/answer/16215270) 也要求用户选择具体 sources，且 Drive source 会随权限/删除变成 inaccessible。对 Personal AI 的含义是：Cue Compiler 生成的句子必须携带 `sourceRefs`、freshness、权限/不可访问状态，不能只显示一句“AI 判断相关”。
4. **结构化输出比自由文本更适合 cue 合约。**
   OpenAI [Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) 和 [API structured outputs docs](https://platform.openai.com/docs/guides/structured-outputs) 都强调 JSON mode 不等于 schema reliability，生产系统应让模型输出匹配开发者定义的 schema。对本项目的含义是：Cue Compiler 不应该只返回字符串，而应该返回 `ContextCue` 类型，包含 cue 文案、动作类型、证据引用、置信度、风险、不可生成原因。
5. **论文方向也从“检索片段”转向“检索后结构化”。**
   [RAS: Retrieval-And-Structuring](https://arxiv.org/abs/2502.10996) 提出面向 query 动态构造知识图谱，解决 unstructured retrieved context 导致的脆弱推理；[FG-RAG](https://arxiv.org/abs/2504.07103) 用 query-level fine-grained summarization 提升 query-focused summarization；[PAHF](https://arxiv.org/abs/2602.16173) 强调 personalized agent 要结合 pre-action clarification、memory grounding 和 post-action feedback。对本项目的含义是：精准 cue 应该是“当前 scene + query-specific structured facts + post-action feedback”的闭环，而不是单轮相似度。
6. **Agent memory 产品正在分层：事实、事件、指令、任务、时间有效性。**
   Cloudflare [Agent Memory](https://developers.cloudflare.com/agent-memory/concepts/how-agent-memory-works/) 把 memory 分成 Facts / Events / Instructions / Tasks，并在 recall 中做 query analysis、parallel retrieval、ranking、grounded synthesis；Zep/Graphiti 的 [Graphiti](https://www.getzep.com/platform/graphiti/) 和 [Zep paper](https://arxiv.org/abs/2501.13956) 强调 temporal context graph、hybrid retrieval、过期事实 invalidation；LangGraph [Memory overview](https://docs.langchain.com/oss/javascript/langgraph/memory) 也把 long-term memory 分为 semantic / episodic / procedural，并提醒 hot path 写 memory 会增加延迟。对本项目的含义是：Personal AI 现有 `messages_raw/chunks/metadata/entities/relationships` 基础足够，但需要在召回和展示之间增加一个 typed cue/fact 层，而不是把 UI 层继续写成 string heuristic。

### 业内常见实现模式

可以抽象成 5 层：

```text
Source Grounding
  -> Contextualized Retrieval
  -> Structured Memory / Strong Summary
  -> Cue Compiler
  -> Outcome Loop
```

- **Source Grounding**：每条候选保留来源、权限、时间、可打开链接、是否过期、是否来自用户主动保存或系统捕获。
- **Contextualized Retrieval**：chunk 写入或后台整理时生成 `retrievalContext`，说明这段内容属于哪个项目/人/会议/字段/规则，供 embedding、FTS、rerank 一起使用。
- **Structured Memory / Strong Summary**：把记忆沉淀成可复用的事实、事件、流程或偏好，例如 `estimate.unit = 人天`、`jira.field = original estimate`、`team.rule = close 无硬要求`。
- **Cue Compiler**：根据当前场景锚点和 top evidence 生成一句 cue，必要时拒绝生成，并返回结构化原因。
- **Outcome Loop**：只记录这个 cue 出现后的真实结果：展开、忽略、点不相关、插入、编辑、发送、后续重复追问、action 成功/失败，并反向影响下次 cue 的时机和强度。

这意味着：当前 plan 的 Outcome Loop 仍然成立，但要把 `SceneFrame + ContextCue` 写成 P0 前置，否则精准提示只能停留在例子层面。

### 当前代码检查结论

现有代码已经具备不少基础能力：

- `memory-service/src/core/ContextRecallService.ts` 已经有 `extractSceneAnchors()`，会从 `title`、`primaryText`、`secondaryTexts`、`sourceContext`、`entityHints` 提取 people/topics/projects/source。
- 同一个服务里已有 Scene Memory Autopilot 逻辑：`rankContextMatches()`、`applySceneMemoryAutopilot()`、`buildWhyRelevant()`、`displayPriority`、`suppressionReason`，能过滤弱关联和解释为什么相关。
- `memory-service/src/types/index.ts` 的 `ContextRecallMatch` 已包含 `whyRelevant`、`matchedAnchors`、`uiSummary`、`evidenceRole`、`displayPriority`、`metadata`、`sourceClusterKey`。
- `src/contentScriptWebIntelligence.ts` 的 `selectContextLensTitle()`、`selectContextLensSummary()`、`selectContextLensEvidence()` 是 Memory Lens 展示 hook；现在它们主要从 `metadata.summary`、`uiSummary`、`snippet`、`metadata.actions`、`replyAdvice` 里挑文案。
- `src/composer-guard/ComposerGuardController.ts` 已有 Compose Assist 的插入、接受、撤销、发送 trace：`acceptedInsertionDraft`、`sendTraceRecorded`、`AMBIENT_CALIBRATION_TRACE`，可作为 Outcome Loop 的低成本信号源。
- `src/services/MemoryServiceClient.ts`、`src/composer-guard/types.ts`、`src/meeting-shell/protocol.ts` 已经多处镜像 `ContextRecallMatch` / `ComposerAssistEvidence`，说明新增类型必须同步更新，不宜只在后端偷偷加字段。

但目前还缺少 4 个关键对象：

1. **Typed SceneFrame**：现有 `AnchorBuckets` 是 people/topics/projects/source 的集合，足够做相关性过滤，但不足以表达“这是 Jira estimate 字段场景 / RingCentral reply 场景 / 会中提问场景”。缺少 `sceneType`、`intent`、`fieldHints`、`surface`、`risk`。
2. **Reusable Cue Facts**：现有 `uiSummary` 和 `metadata.summary/actions/replyAdvice` 可以展示，但没有稳定的 fact schema。系统可能知道“聊过 estimate”，却不一定能稳定抽出 `unit = 人天`。
3. **ContextCue 合约**：`ContextRecallMatch` 里没有 `cue` 字段。UI 只能在 title/summary/evidence 之间挑句子，不能知道这是“提醒 / 提问 / 写作提示 / 风险警告 / 打开来源”。
4. **Cue-level outcome id**：Outcome Loop 如果只记录 match id，会分不清“同一条记忆被 raw 展示”和“同一条记忆被编译成 estimate 口径 cue”的效果差异。

### 建议改造：把 Cue Compiler 插入召回和 UI 之间

#### 1. 新增 `SceneFrameService`

位置建议：

```text
memory-service/src/core/SceneFrameService.ts
```

职责：

- 输入 `ContextRecallRequest` / `ComposerAssistRequest` / meeting snapshot。
- 复用现有 `sourceContext`、`currentContext`、`entityHints`、site adapter 输出。
- 输出稳定结构：

```ts
export interface SceneFrame {
  sceneType:
    | 'jira_estimate'
    | 'jira_issue_update'
    | 'ringcentral_reply'
    | 'meeting_live'
    | 'external_ai_prompt'
    | 'web_reading'
    | 'unknown';
  surface: 'memory_lens' | 'compose_assist' | 'ask' | 'meeting_pilot';
  anchors: {
    people?: string[];
    projects?: string[];
    topics?: string[];
    source?: string[];
    issueKey?: string;
    conversationId?: string;
    groupId?: string;
  };
  fieldHints?: Array<{
    field: 'estimate' | 'original_estimate' | 'due_date' | 'status' | 'assignee' | 'close_policy' | string;
    rawText: string;
    confidence: number;
  }>;
  userIntent?: 'read' | 'reply' | 'fill_field' | 'summarize' | 'decide' | 'delegate' | 'unknown';
  riskLevel: 'low' | 'medium' | 'high';
}
```

P0 不需要 LLM，先做 deterministic extractor：

- Jira URL / DOM / issue key + 页面字段名包含 estimate、original estimate、due date、status。
- RingCentral composer + thread/group id + 当前输入意图。
- Web AI composer + prompt box + source allowlist。
- Meeting Pilot + participants + title + live transcript topic。

现有 `extractSceneAnchors()` 可以继续保留，但应变成 `SceneFrameService` 的一个 helper，而不是所有场景理解的最终形态。

#### 2. 新增 `MemoryCueFactService`

位置建议：

```text
memory-service/src/core/MemoryCueFactService.ts
```

职责：

- 从已有 `RecallItem` / `memory_metadata` / `source_memory` / `reflection_threads` / `user_profile_items` 里提取可复用事实。
- P0 可先 lazy compute，不必马上改 ingestion 表结构；先把 facts 放入 `metadata.cueFacts` 或新建轻表。
- 中期再接入后台强摘要/结构化记忆，让 chunks 写入时生成 retrieval context。

建议 fact schema：

```ts
export interface MemoryCueFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers?: Record<string, string>;
  sceneTags: string[];
  sourceRefs: Array<{
    type: 'message' | 'chunk' | 'source_memory' | 'jira' | 'meeting' | 'reflection_thread';
    id: string;
    title?: string;
    url?: string;
    timestamp?: number;
  }>;
  confidence: number;
  validFrom?: number;
  validUntil?: number;
}
```

Estimate P0 示例：

```json
{
  "subject": "MTR estimate",
  "predicate": "unit",
  "object": "人天",
  "qualifiers": { "alternative": "3h 也可", "field": "original estimate" },
  "sceneTags": ["jira_estimate", "q3_planning"],
  "confidence": 0.78
}
```

#### 3. 新增 `CueCompilerService`

位置建议：

```text
memory-service/src/core/CueCompilerService.ts
```

职责：

- 输入 `SceneFrame + ContextRecallMatch[] + MemoryCueFact[] + surface`。
- 输出 `ContextCue | null`。
- P0 deterministic + rule based；P1 再接 LLM structured output。

建议 cue schema：

```ts
export interface ContextCue {
  id: string;
  cueText: string;
  actionType:
    | 'remember'
    | 'ask'
    | 'draft_hint'
    | 'warning'
    | 'open_source';
  surfaceEligibility: Array<'memory_lens' | 'compose_assist' | 'ask' | 'meeting_pilot'>;
  sourceRefs: MemoryCueFact['sourceRefs'];
  evidenceMatchIds: string[];
  whyNow: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  compileStatus: 'compiled' | 'suppressed' | 'needs_more_evidence';
  suppressReason?: 'weak_scene_anchor' | 'weak_fact' | 'stale_source' | 'sensitive' | 'too_noisy';
}
```

硬规则：

- `cueText` 最多 1-2 句，优先可执行，不复述长历史。
- 没有明确 `SceneFrame.sceneType` 时不生成精准 cue，只保留普通相关记忆。
- 没有 `sourceRefs` 时不生成事实型 cue。
- Memory Lens 只展示 read-only cue，不做插入；`draft_hint` 应交给 Compose Assist。
- 高风险 cue 只显示来源和提醒，不直接生成可发送文本。
- 所有 LLM cue 必须走 Structured Outputs / Zod 校验；schema 不通过时降级为普通 `uiSummary`。

#### 4. 扩展现有类型和前端展示

需要同步修改的类型位置：

- `memory-service/src/types/index.ts`
- `src/services/MemoryServiceClient.ts`
- `src/contentScriptWebIntelligence.ts`
- `src/composer-guard/types.ts`
- `src/meeting-shell/protocol.ts`
- `src/meeting-shell/memoryPresentation.ts`

建议把 `ContextCue` 挂在 `ContextRecallMatch` 上：

```ts
export interface ContextRecallMatch {
  // existing fields...
  cue?: ContextCue;
}
```

Memory Lens 展示调整：

- `selectContextLensSummary()` 优先显示 `match.cue.cueText`，但仅当 `cue.compileStatus === 'compiled'` 且 `surfaceEligibility` 包含 `memory_lens`。
- `selectContextLensEvidence()` 继续显示来源/证据，不用 cue 替代证据。
- 卡片 footer 可增加极短状态：`来自 2 条 Glip/Jira 证据`，不新增操作。

Compose Assist 调整：

- `ComposerAssistEvidence` 可携带 `cue?: ContextCue`。
- 如果 `cue.actionType === 'draft_hint'`，再进入现有 `insertText` / review / direct insert 策略。
- 继续使用现有 `previewRequired`、`riskLevel`、`shouldReviewComposerAssistBeforeInsert()`，不让 cue 绕过安全边界。

Outcome Loop 调整：

- `memory_intervention_events` / 后续 outcome ledger 应记录 `cue.id`、`cue.actionType`、`compileStatus`、`evidenceMatchIds`。
- 同一条 memory 的 raw display 和 compiled cue 要分开统计。
- 现有 `AMBIENT_CALIBRATION_TRACE` 可作为 composer outcome 的第一批接入点。

### P0 实现切片建议

不要一上来做泛化 Cue Compiler。建议第一版只做一个可验收场景：

```text
Jira/Glip estimate 场景
  -> deterministic SceneFrame
  -> 从 top context-recall match 抽取 estimate cue fact
  -> 编译一句 read-only cue / draft_hint
  -> Outcome Loop 记录是否展开、插入、发送、thumb-down
```

具体 P0 范围：

1. `SceneFrameService` 支持 `jira_estimate` 和 `ringcentral_reply` 两类。
2. `MemoryCueFactService` 只抽 `estimate.unit`、`jira.field`、`close_policy`、`due_date_policy` 四类 fact。
3. `CueCompilerService` 只生成两类 cue：
   - `remember`：Memory Lens 只读提醒，例如 `上次 MTR estimate 讨论里口径是人天；如要填 Jira，请先确认 original estimate 字段。`
   - `draft_hint`：Compose Assist 写作提示，例如 `可以回复：我按人天口径先估，必要时再补 3h 拆分。`
4. 所有 cue 必须带 `sourceRefs`，否则 `compileStatus = needs_more_evidence`。
5. Outcome Loop 只消费现有行为，不新增用户操作。

建议测试：

- `memory-service/src/__tests__/api-context-recall.test.ts`
  - Jira estimate 场景返回 `match.cue.cueText`。
  - 普通 Jira 页面没有 field anchor 时不生成精准 cue。
  - source 不足时 `compileStatus = needs_more_evidence` 或不返回 cue。
- `memory-service/src/__tests__/api-composer-assist.test.ts`
  - `draft_hint` 不绕过 `previewRequired` / `riskLevel`。
  - evidence 中包含 `cue.sourceRefs`。
- `src/composer-guard/__tests__/ComposerGuardController.test.ts`
  - cue-backed suggestion 仍走现有 insert/send trace。
- `tools/eval-scene-memory-autopilot.ts`
  - 增加 `cue_compiler` 检查：p1 精准 cue 必须有 scene frame、source refs、whyNow。
- 新增小 eval：`estimate-cue-compiler`
  - case 1：正确生成“人天”cue。
  - case 2：只有主题相似但无 estimate 字段，不生成 cue。
  - case 3：来源冲突，降级为 `ask` 或 `needs_more_evidence`。

### 重新界定 Outcome Loop 和前置能力的关系

加入这层后，完整链路应该改成：

```text
ContextRecall / Composer Assist retrieval
  -> SceneFrameService
  -> MemoryCueFactService
  -> CueCompilerService
  -> Memory Lens / Compose Assist / Ask 展示
  -> Outcome Loop 记录 cue-level outcome
  -> 下次影响 cue ranking / timing / suppression
```

因此本 plan 后续实施时应拆成两个里程碑：

| 里程碑 | 目标 | 用户感知 |
| --- | --- | --- |
| M1：Cue Compiler prerequisite | 让系统能把一小类“相关记忆”压成可信的一句提示 | Memory Lens / Compose Assist 出现少量更精准的业务 cue |
| M2：Outcome Loop | 学习这些 cue 是否真的有用，调整下次出现方式 | 同类提示更少打扰、更稳定、更可解释 |

如果只做 M2，不做 M1，Outcome Loop 仍有价值，但只能优化“现有提示是否打扰”，不能承诺“estimate 口径”级别的精准提示。

## 2026-06-09 实现状态：Jira estimate cue 的窄闭环已完成

本轮已把上面的 M1 和一个保守 M2 切片落到代码：

- 新增 `SceneFrameService`、`MemoryCueFactService`、`CueCompilerService`，先 deterministic 支持 Jira estimate 场景。
- `/context-recall` 返回 `ContextCue(actionType='remember')`，Memory Lens 优先把 cueText 当只读提示摘要展示。
- `/composer/assist` 返回 `ContextCue(actionType='draft_hint')`，Compose Assist 可直接用它生成 Jira comment 草稿，但仍走现有 `riskLevel` / `previewRequired` / 插入不发送边界。
- SceneFrame 只基于当前原始 request 构建，不使用 RecallContextExpansion 加入的历史记忆词，避免“找到 estimate 记忆”反向污染普通 status 页面。
- Memory Lens 展开、Memory Lens thumb up/down、Compose Assist 插入/发送/thumb-down 都会携带 cue id 或 cue 摘要进入既有 feedback / ambient calibration trace。
- 新增 `MemoryOutcomeLoopService` 和 `memory_outcome_events` / `memory_outcome_policy_patches`，把展开、插入、发送、不相关等 outcome 归到 `cueKey`。
- 重复不相关会生成 `suppress` patch；Context Recall 下次会把同一句 cue 标为 `compileStatus='suppressed'` 并隐藏。
- 重复 `sent_after_insert` 会生成 `boost` patch；同类 Compose cue 下次会带 `outcomePolicy.action='boost'` 并提高置信度。
- 重复成功的 Jira estimate wording cue 会向 Personal Skill Foundry 写入 `Estimate wording helper` suggestion，但仍由用户决定是否启用为 active skill。
- 新增并扩展 `estimate-cue-compiler` eval suite，覆盖正例、Compose draft_hint、弱场景不误发、suppress、boost 和 Skill Foundry suggestion。

尚未做的范围：

- 没有泛化到所有 Jira 字段、会议、Ask、Day Pilot 或 OpenClaw；当前闭环只承诺 Jira estimate cue。
- 没有新增 Outcome Strip / Details Drawer；可见反馈仍复用 Memory Lens thumb-down drawer 和 Compose Assist 现有插入/发送路径。
- 没有把 Skill suggestion 自动提升成 active skill。
- 没有新增用户操作或新的 review queue。

## 为什么值得做

Personal AI 已经在多个场景提供记忆关联和 AI 建议：

- Memory Lens 在当前网页/聊天/会议旁边提示相关记忆。
- Ask 会把本地记忆、外部证据、AnswerMemory 和 confirm request 串起来。
- Day Pilot / Today Pilot 会把会议、行动、反思组织成当天任务。
- Compose Assist / Context Passport 会把记忆变成可发送或可交给外部 AI 的上下文。
- Reflection / Dream / proposed actions 会主动生成跟进、外部查证和 OpenClaw 委派。

这些能力共同缺少一个问题的答案：

> 系统怎么知道自己刚才那条提示到底有没有帮到用户？

如果没有成效回路，系统只能继续依赖静态 salience、相似度、LLM 自评和偶尔的用户反馈。真实使用中这会带来几个问题：

1. **用户忽略了，系统不知道为什么。** 可能是内容不相关，也可能是时机太早、太晚、太长、太敏感、已经知道、或当前没空。
2. **用户采纳了，系统也不知道它成了。** 用户复制了建议、改了两句、发到 Glip，之后对方回复解决了问题，但 Personal AI 没有把这条“成功介入”学回去。
3. **失败动作持续排队。** OpenClaw 缺能力、外部核实失败、同一 BE readiness 反复生成近似 confirm request，如果没有 outcome ledger，系统很难从失败模式里停止重复。
4. **隐式反馈散落在各表。** access_count、copy、insert、dismiss、reply、Jira open、confirm request answer、proposed_actions state 都存在，但没有一个统一对象说明“这次记忆介入的结果”。
5. **做不出可信的产品优化。** 不能只看“弹了多少提示”或“召回分数”，应该看“哪些提示减少了重复搜索、帮助用户发出更好的消息、减少确认债、推动外部动作完成”。

`Memory Outcome Loop` 补的是 Personal AI 的学习闭环。它让系统从“凭相似度提示”进化到“根据真实成效调整介入”。

## 本次输入信号

### Reminders 检查

本机 Reminders 可访问，当前可见列表为：

- `We`
- `Next actions`
- `Moives`
- `Shopping List`
- `家庭`
- `人名记忆`
- `宝宝需要办理`
- `吃吃看`
- `出门前检查`
- `装修待办`
- `Reading`
- `菜头`
- `Tasks`

没有发现名为 `Personal AI` 的列表，因此本次没有从 Reminder 中抽取全新功能 idea，也没有需要标记 done 或写备注的 Reminder item。

### `docs/progressing` 去重

已检查 `docs/progressing/to-verify.md`，当前为：

```text
暂无。
```

已重点避让以下相邻/搁置方向：

| 已有方向 | 主对象 | 本方案不重复的边界 |
| --- | --- | --- |
| `Working Memory Return Stack`（搁置） | 离开前意图断点和回程提示 | Outcome Loop 不推断“用户离开前想做什么”，只记录已经发生的介入和后续结果。 |
| `AI Context Passport` | 跨 AI 上下文包 | Outcome Loop 记录 passport 被复制/使用/回流后的结果，反向优化 passport 内容。 |
| `Operation Memory Flight Recorder` | 用户跨工具做事过程 episode | Outcome Loop 只记录 Personal AI 介入的成效，不完整回放所有操作链。 |
| `Memory Rehearsal Studio`（搁置） | 会前沟通演练 | Outcome Loop 可记录演练建议是否被采纳，但不模拟人物或会议。 |
| `Memory Egress Firewall`（搁置） | 记忆外发前的风险边界 | Outcome Loop 记录外发后是否有用/是否被撤回，不负责 DLP 判断。 |
| `Memory Intake Quality Gate`（搁置） | 记忆进入系统前的质量分流 | Outcome Loop 看的是出现在用户面前之后的成效，不做录入审稿台。 |
| `Ambient Memory Forgetting` | 后台衰减和归档 | Outcome Loop 给遗忘层提供真实成效信号，例如长期无用的 cue 降权。 |
| `Memory Relevance Trainer` | 用户遇到错误召回后的纠错 | Outcome Loop 不等用户显式纠错，先收集轻量行为和 delayed outcome。 |
| `Personal Skill Foundry` | 把重复成功流程变成 skill | Outcome Loop 是 Skill Foundry 的上游证据，证明某个建议/流程重复有效。 |
| `Agent Memory Control Tower`（搁置） | 多 agent 分工和合并 | Outcome Loop 不调度 agent，只记录建议/委派是否成功。 |

因此本方案的新增对象是：**memory intervention outcome**，也就是一次记忆提示、上下文包、行动建议、外部核实、会中提醒、写作建议在真实场景里的结果。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。

HTTP `http://10.32.56.212:3210/health` 当前可达但返回 `degraded`，数据库状态显示未连接。因此本次通过 SSH 只读查询真实活跃库：

```text
/Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db
```

没有写入远端数据。读到的关键统计：

| 表/指标 | 数量 |
| --- | ---: |
| `messages_raw` | 9,567 |
| `chunks` | 7,840 |
| `memory_metadata` | 11,346 |
| `entities` | 13,796 |
| `relationships` | 50,383 |
| `user_profile_items` | 33,924 |
| `confirm_requests` | 160 |
| `confirm_requests.pending` | 49 |
| `reflection_threads` | 706 |
| `reflection_threads.active` | 704 |
| `proposed_actions` | 784 |

主要来源：

- `messages_raw`: `glip` 8,743、`meeting` 317、`calendar` 298、`system` 161、`jira` 25、`web` 12。
- `chunks`: `web` 2,414、`glip` 1,934、`reflection_thread` 1,394、`daily_log` 746、`meeting` 351、`calendar` 310、`jira` 53。
- `memory_metadata`: `temporary` 3,575、`working` 2,879、`archived` 2,666、`forgotten` 2,226。

真实痛点样本：

1. `confirm_requests.pending` 里有多条 `BE ready / BE status` 近似 property change，问题本质相似，但被拆成多次用户确认负担。
2. `proposed_actions` 里有 58 条 `queued delegate_openclaw`、46 条 `failed delegate_openclaw`，不少围绕“继续外部核实 / BE ready / 事实跟进”。
3. `reflection_threads.active` 大量围绕 entity property 事实跟进，例如 Jira estimate、版本、assignee、status、quota 等，说明系统很主动，但也容易产生持续查证债。
4. 2026-06-08 的真实消息里，用户在 `CoP - AI Enablers` 讨论“问诊空间流程应该怎么样”“3 个人就够了，先模拟摸索一下”，说明用户在推动 AI 工作流实验，需要 Personal AI 学会哪些建议真正带来行动。
5. 同日用户还说“最近我也项目好多，mobile 可能关注不到那么细”，说明用户需要更少但更准的介入，而不是更多卡片。
6. 近期 calendar 有 `AI workflow clinic 模拟 - Esone's team`、`AI workflow clinic 模拟 - Sophia's engg dashboard`、`Q3 planning for video mobile`、`Bug - AI 先修一遍我再看` 等场景，说明用户正在把 AI 建议带入团队协作和项目管理。

这些信号共同指向：系统已经会“建议”和“跟进”，但还不够会“从建议的结果里学习”。

## 行业产品和研究参考

### ChatGPT Memory / Dreaming / Pulse：记忆正在变成后台主动策展，但需要反馈和来源

OpenAI 2026-06-04 发布的 [Dreaming: Better memory for a more helpful ChatGPT](https://openai.com/index/chatgpt-memory-dreaming/) 说明 ChatGPT 的 memory 架构正在从显式 saved memories 扩展到后台自动策展。OpenAI 写到 dreaming 会从聊天历史中合成更及时、更相关的 memory state，并且比只靠用户显式要求“记住”更自然。

[ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-in-chatgpt) 也强调 saved memories 可以自动管理、优先级调整、查看历史版本、删除和恢复。它说明主流 AI 产品已经把 memory 当成持续变化的状态，而不是静态笔记。

[ChatGPT Pulse](https://help-lb.openai.com/en/articles/12293630-chatgpt-pulse) 更进一步：它会基于 memories、chat history、card interactions、thumbs up/down、curate feedback 和 connected apps 主动生成每日建议。

对 Personal AI 的启发：

- 记忆产品会越来越主动，不只等用户搜索。
- 主动建议必须有反馈入口，否则个性化会漂。
- Personal AI 比 ChatGPT 更跨场景：Glip、Jira、会议、网页、外部 AI、OpenClaw。所以它需要跨 surface 的成效回路，而不是某个单独 AI app 内部的 card feedback。

### Microsoft Copilot Studio：反馈分析是 agent 产品的基础，但粒度还太粗

Microsoft Copilot Studio 的 [Collect thumbs up or down feedback and comments for your agents](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave1/microsoft-copilot-studio/collect-thumbs-up-or-down-feedback-comments-agents) 提供 agent response 的 thumbs up/down、comments 和 analytics。

这说明：

- AI agent 进入真实业务后，反馈和分析是标准能力。
- 但普通 thumbs up/down 只能告诉 maker “这条回复满意吗”，不能回答 Personal AI 更需要的几个问题：
  - 哪条 source memory 真正有用？
  - 这条建议之后用户有没有执行？
  - 它是否减少了重复搜索、减少了待确认债、提升了下次召回？
  - 它是否只是被用户礼貌点赞，但没有推进事情？

Outcome Loop 应该把反馈粒度从“回复满意度”推进到“记忆介入成效”。

### Granola：来源可追溯和编辑很重要，但它仍是单场会议闭环

[Granola AI-enhanced notes](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes) 会用 transcript、用户 raw notes、calendar event 生成增强笔记，并允许用户通过放大镜查看某条 enhanced note 来自 transcript 或 raw notes 的位置。用户还可以编辑或用反馈重新生成笔记。

对 Personal AI 的启发：

- 每条 AI 生成内容都应该能回到证据。
- 用户编辑行为本身是高质量反馈。
- Personal AI 的机会是把“编辑/采纳/忽略/后续结果”从单场会议扩展到所有记忆 surfaces。

### Anthropic context engineering：attention budget 是稀缺资源，成效信号应反过来决定下次给什么 context

Anthropic 在 [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 中强调 context 是有限资源，需要选择最小但高信号的 token；长程任务需要 compaction、note-taking、memory tools 和 sub-agent architectures。

这对 Outcome Loop 很关键：

- “高信号”不能只由模型自评，应该由用户真实行为和后续成效校准。
- 如果某类记忆在 Jira estimate 场景总被采用，它下次应该更早出现。
- 如果某类 reflection thread 总导致失败 OpenClaw 委派，它应该先降级或换成更明确的问法。

### 论文：持续个性化需要 post-action feedback，而不只是 pre-action memory

[Learning Personalized Agents from Human Feedback](https://arxiv.org/abs/2602.16173) 提出 PAHF，把个性化 agent 的闭环拆成三步：行动前澄清、从记忆中取偏好来 grounded action、行动后整合反馈并在偏好漂移时更新 memory。论文还强调 explicit memory 和 dual feedback channels 对快速适应很关键。

这直接支持 Outcome Loop 的核心判断：Personal AI 要在“建议之后”学习，而不是只在“建议之前”检索记忆。

[Predicting Developer Acceptance of AI-Generated Code Suggestions](https://arxiv.org/abs/2601.21379) 基于 66,329 次工业 developer-AI interactions 研究 acceptance/rejection 特征，结论是 targeted personalization 可以过滤会被拒绝的建议，减少打扰。

[When to Show a Suggestion? Integrating Human Feedback in AI-Assisted Programming](https://arxiv.org/abs/2306.04930) 则提出用 human feedback 判断何时显示或隐藏 AI code suggestions，并指出只把 acceptance 当 reward 会有意外陷阱。

对 Personal AI 的启发：

- 采纳/拒绝是关键，但不能唯一化。需要同时看后续结果、编辑幅度、时机、风险、重复打扰和任务完成。
- “少显示一些预计会被拒绝的建议”本身就是 UX 优化。

### 论文：记忆会过期、会被错误巩固，所以 outcome evidence 必须保留 raw episode

[STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?](https://arxiv.org/abs/2605.06527) 指出模型常能检索到更新证据，却仍接受用户问题里的过时前提；最好的被测模型整体准确率也只有 55.2%。这说明记忆系统需要显式状态裁决，而不是只靠检索。

[Useful Memories Become Faulty When Continuously Updated by LLMs](https://arxiv.org/abs/2605.12978) 发现 LLM 持续 consolidation 会让有用记忆变坏，实践上应把 raw episodes 作为一等证据，并明确 gate consolidation。

[Is Agent Memory a Database?](https://arxiv.org/abs/2605.26252) 把 long-term memory 定义为 governed evolving memory，强调 correctness 是状态轨迹的属性，而不是单条 record 的属性。

对 Outcome Loop 的启发：

- 成效账本不是为了把每次反馈立刻合并成一句 profile。
- 应该保留原始 intervention、用户行为、结果和证据 refs。
- Consolidation 只在重复成功、低风险、证据充分时发生。

### HCI：AI 建议的 review 流程会受认知偏差影响，不能把负担都甩给用户

Harvard Data Science Review 的 [Bias in the Loop](https://hdsr.mitpress.mit.edu/pub/nrcn4h7d/release/2?readingCollection=3974b7e6) 研究了 2,784 名参与者如何审核 AI 抽取建议。结论指出，人类审核 AI 建议会受自动化态度、纠错成本等因素影响，成功的人机协作不只取决于算法性能，也取决于 review 流程结构。

这对 Personal AI 很重要：

- Outcome Loop 不应该要求用户频繁写长反馈。
- 默认使用隐式行为和延迟结果，只在高价值、模糊或高风险时问一个小问题。
- UI 要让用户快速表达“有用 / 不准 / 太晚 / 太多 / 不该外发 / 已解决”，而不是强制解释。

## 产品定义

### 功能名

推荐：**Memory Outcome Loop / 记忆成效回路**

备选：

- Memory Impact Ledger / 记忆影响账本
- Memory Intervention Receipts / 记忆介入回执
- Suggestion Outcome Memory / 建议成效记忆
- Recall Impact Loop / 召回成效回路

推荐“记忆成效回路”，原因：

- “记忆”说明它服务 Personal AI 的私有记忆层。
- “成效”说明它关注真实结果，不是主观点赞。
- “回路”说明它会反向影响下次召回、提示、动作队列和 skill 沉淀。

### 一句话产品承诺

> 每次 Personal AI 提醒、建议、插入、委派或打包上下文后，系统都能知道它有没有帮你推进事情，并据此让下次提示更少、更准、更有用。

### 核心对象

#### 1. Memory Intervention

一次 Personal AI 对用户工作流的介入。

例子：

- Memory Lens 在 Jira 页面旁展示一条已有强相关 estimate 记忆，并记录它为什么显示。
- Compose Assist 基于召回结果建议在 Glip 回复里补一句“可以填 3h 这样的小时单位”。
- Meeting Pilot 会中提醒“Mobile 项目你最近关注不到细节，可以问 Nicole 是否有特别事项”。
- Ask 回答“BE 尚未 ready”并引用 evidence。
- Day Pilot 给出“Q3 planning 先看 estimate 是否填满”的 mission。
- Context Passport 生成给 Codex 的任务包。
- Reflection 生成一个 OpenClaw 外部核实 action。

字段草案：

```ts
type MemoryIntervention = {
  id: string;
  userId: string;
  surface:
    | 'memory_lens'
    | 'compose_assist'
    | 'meeting_pilot'
    | 'ask'
    | 'day_pilot'
    | 'context_passport'
    | 'reflection_action'
    | 'openclaw_delegate'
    | 'relationship_radar';
  sceneKey: string;
  taskIntent: string;
  interventionType:
    | 'cue'
    | 'context_pack'
    | 'draft_suggestion'
    | 'meeting_prompt'
    | 'action_proposal'
    | 'fact_followup'
    | 'safety_boundary'
    | 'skill_candidate';
  shownAt: number;
  sourceRefs: string[];
  evidenceRefs: string[];
  renderedSummary: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  salienceAtShow: number;
  rankingReason: string[];
  quietedAlternatives?: Array<{ sourceRef: string; reason: string }>;
};
```

#### 2. Outcome Signal

一次介入后的行为或结果。

```ts
type OutcomeSignal = {
  id: string;
  interventionId: string;
  signalType:
    | 'shown'
    | 'expanded'
    | 'copied'
    | 'inserted'
    | 'edited'
    | 'sent'
    | 'dismissed'
    | 'marked_relevant'
    | 'marked_irrelevant'
    | 'too_late'
    | 'too_much'
    | 'unsafe'
    | 'action_succeeded'
    | 'action_failed'
    | 'followup_resolved'
    | 'ask_repeated'
    | 'confirm_request_created'
    | 'confirm_request_answered'
    | 'source_opened'
    | 'skill_candidate_created';
  occurredAt: number;
  surfaceEventRef?: string;
  value?: number;
  note?: string;
  inferred: boolean;
  confidence: number;
};
```

#### 3. Impact Assessment

系统对一次 intervention 的成效判断。

```ts
type ImpactAssessment = {
  interventionId: string;
  usefulness:
    | 'helped'
    | 'probably_helped'
    | 'neutral'
    | 'probably_noise'
    | 'harmful'
    | 'unknown';
  reasonCodes: Array<
    | 'copied_then_sent'
    | 'edited_heavily'
    | 'dismissed_fast'
    | 'repeated_question_later'
    | 'action_failed_capability_missing'
    | 'resolved_followup'
    | 'source_opened'
    | 'confirm_debt_created'
    | 'same_meaning_duplicate'
    | 'late_after_user_acted'
    | 'not_safe_to_externalize'
    | 'low_information_source'
  >;
  impactScore: number;
  attentionCost: number;
  delayedOutcomeWindowHours: number;
  recommendedPolicyPatch?: {
    sourceRef?: string;
    sceneKey?: string;
    action: 'boost' | 'suppress' | 'merge' | 'ask_less' | 'require_better_evidence' | 'send_to_skill_foundry';
    expiresAt?: number;
  };
};
```

### 不做什么

- 不让用户逐条 review 所有提示。
- 不把每次忽略都当负反馈。
- 不把复制/点赞直接等同成功。
- 不自动发送消息或自动修改外部系统。
- 不把“用户行为监控”做成团队管理工具。
- 不为低风险提示频繁弹窗索要原因。
- 不把 raw outcome 立刻覆盖成长期 profile。

### 做什么

- 给每个 Personal AI 建议生成可追踪 intervention id。
- 采集低摩擦 outcome signals。
- 把隐式行为和 delayed outcome 串起来。
- 给下次召回/排序/静默策略提供 policy patch。
- 给用户看得到的 receipt：为什么这次少弹了、为什么这条被提升、为什么某个 OpenClaw action 不再重复排队。
- 给产品验证提供指标：helpful rate、dismiss fast rate、copy to send rate、action failure loop、confirm debt reduction。

## 用户体验设计

### 原则 1：嵌入真实场景，不新造大后台

Outcome Loop 的首屏体验不应是 dashboard。它应该出现在用户已经工作的地方：

- RingCentral 输入框旁。
- Jira issue 页面侧边。
- Meeting Pilot side panel。
- Ask answer footer。
- Context Passport preview。
- Day Pilot mission card。

用户看到的是一条轻量状态：

```text
这条记忆来自 2 个来源。已用于草稿，等待后续结果。
```

或：

```text
这类 BE ready 提示近期重复失败，已减少自动外部核实。
```

### 原则 2：复用现有反馈入口，不重复做 thumbs-down drawer

现有 Memory Lens 已经有 compact thumb-down，点击后会在卡片内打开轻量原因面板，并记录“只是主题相似 / 群组或项目不对 / 空页面误触发”等原因。Outcome Loop 不应该重新做一套反馈 drawer。

本 plan 真正新增的是：把这些已有反馈原因纳入同一个成效账本，并补上它们原来覆盖不到的 delayed outcome。

可复用/统一解释的反馈语义包括：

- `有用`
- `不相关`
- `太晚了`
- `太多了`
- `证据弱`
- `不该外发`
- `已解决`

其中：

- `有用` / `已解决`：可以强化该 scene + source + cue 类型。
- 现有 `不相关` 原因：继续走 recall relevance patch，同时写入 outcome signal。
- `太晚了` / `太多了`：主要调整 timing 和 frequency，不一定打击 source 本身。
- `证据弱` / `不该外发`：要求更强 authority source 或转给外发边界能力。

如果某个入口已经有反馈 UI，只接入事件，不新增按钮；只有没有反馈入口的 surface，才考虑加一条很轻的 outcome strip。

### 原则 3：默认自动推断，小问题才问

可以自动采集的信号：

- 卡片显示后 2 秒内关闭：可能是噪声，但不直接判负。
- 展开 evidence：说明用户有兴趣。
- 点击 source：说明来源有价值或需要核查。
- 复制/插入后发送：强正信号。
- 插入后大量删除：建议质量可能差。
- Ask 之后 24 小时内再次问同义问题：上次答案没有解决。
- OpenClaw action 多次失败：能力边界或证据不足。
- Confirm request created：系统将成本转移给用户，需要记录负担。
- Confirm request answered same_meaning/no_change：应减少同义重复。

需要问用户的情况：

- 高风险外发。
- 用户撤销发送或删除建议内容。
- 同一场景连续出现 3 次 fast dismiss。
- 系统想把结果写成稳定偏好、skill 或长期事实。

### 原则 4：receipt 不是炫技，是信任边界

每条 intervention 的详情里应展示：

- 出现原因：匹配到哪些 scene anchors。
- 使用来源：source refs 和 evidence refs。
- 静默原因：哪些相似记忆被 quieted，为什么。
- 成效状态：待观察、可能有用、已帮上忙、可能噪声、失败循环。
- 下次调整：本场景减少、同类 source 降权、同类建议合并、进入 Skill Foundry。

这和用户偏好的“可见 source/scope/fallback/writeback receipts”一致。

## 关键使用场景

### 场景 1：Glip 里讨论 estimate 单位

用户在 Glip 里回复同事：

```text
也可以填 3h 这样的小时单位
```

Personal AI 旁边出现一个 Compose Assist suggestion：

```text
上次维护 original estimate / due date 时，Rondo 问过人天和小时单位。
建议补一句：close 时没有硬要求，日常维护 original estimate 和 due date 即可。
```

用户点击 `插入一半`，编辑后发送。Outcome Loop 记录：

- intervention: `compose_assist.draft_suggestion`
- sourceRefs: Glip thread + Jira estimate note
- signals: expanded -> inserted -> edited 40% -> sent
- delayed outcome: 对方 10 分钟内回复 `OK` 或无继续追问
- assessment: `probably_helped`
- policy patch: 在 estimate/计划板场景提升“单位/口径”记忆，但保持短提示。

下次用户打开 Q3 planning 或 Jira estimate 页面时，前置的 scene recall / cue compiler 如果再次生成同类候选，Outcome Loop 可以把这类短口径提示排得更靠前；如果没有明确场景锚点或结构化记忆，它仍然应该保持普通关联记忆或静默。

### 场景 2：BE ready 反复追问和 OpenClaw 失败

用户多次问：

```text
那个 BE ready 了吗？
```

系统曾多次生成 property_change confirm request 和 `delegate_openclaw` 外部核实，但 OpenClaw 缺能力或证据不足。

Outcome Loop 识别：

- 同一 sceneKey 下近似 intervention 多次导致 `confirm_request_created`。
- 多条 action signal 是 `action_failed_capability_missing`。
- 用户没有真正得到新证据，问题仍重复出现。

系统下次不再继续自动生成相似 property change，而是给出更诚实的策略：

```text
已有结论仍是“未 ready，等待 RCV BE 新 design”。过去 8 次自动外部核实没有拿到新权威证据。
建议：要么打开 Jira/MTR-141852 源页核实，要么等新的 April/BE 线程消息出现再更新。
```

Outcome Loop 记录 policy patch：

- `require_better_evidence`
- `ask_less`
- `merge same meaning`
- `suppress delegate_openclaw until connector capability available`

这会直接减少确认债和失败 action。

### 场景 3：AI workflow clinic 前的团队准备

日历里出现：

```text
AI workflow clinic 模拟 - Esone's team
Workflow doctors: Fred, Zong
```

Personal AI 给出一个会前 cue：

```text
你昨天在 CoP - AI Enablers 说希望模拟“求医者进入问诊空间”的整体流程。
这场可以用 3 人模拟：求医者、workflow doctor、观察员。
```

用户点击 `生成 3 分钟流程`，复制到会前消息或 slide。会后系统看到该会议产生了 follow-up 或相关消息继续讨论，记录为 `probably_helped`。

下次类似 `AI workflow clinic` 时，系统更早提示“角色分工 + 观察指标”，而不是泛泛召回所有 AI Enablers 聊天。

### 场景 4：外部 AI context pack 的结果回流

用户从 Context Passport 复制一份任务包给 Codex 或 OpenClaw。Outcome Loop 记录：

- passport 被复制到目标 composer。
- 用户是否删掉了敏感证据。
- Codex 是否产出文件/PR/报告。
- 结果是否被用户保存成 source memory。
- 是否出现“AI 重复问旧背景”或“用了错误事实”。

如果结果成功，Outcome Loop 可把 passport structure 送给 Skill Foundry；如果失败，则把失败原因写回 passport template，例如“缺 Jira auth / 缺 source link / evidence 太旧”。

## 信息架构

### 嵌入式 UI

#### 1. Outcome Strip

出现在每条 Personal AI cue / suggestion 底部：

```text
来源 3 条 · 预计低打扰 · 成效待观察
[有用] [不相关] [太晚了] [详情]
```

状态会更新：

```text
已用于草稿 · 编辑 28% · 等待后续结果
```

```text
已帮上忙 · 对方接受 estimate 单位说明
```

```text
失败循环 · OpenClaw 缺外部核实能力，已暂停同类自动委派
```

#### 2. Outcome Details Drawer

点击详情打开：

- 为什么出现。
- 来源和证据。
- 行为时间线。
- Delayed outcome。
- 下次会怎么调整。
- `不要再在这个场景提示`。
- `把这个成功流程送去 Skill Foundry`。

#### 3. Memory Exploring 高级页

不是日常入口，只给排障和产品调试：

`memory-exploring.html#/outcomes`

展示：

- 本周 helpful interventions。
- 高噪声 scene。
- 失败 action loops。
- 造成 confirm debt 的建议类型。
- 对 retrieval policy 的补丁。
- 可撤销的自动调整。

### 关键视图

#### `成效流`

按时间展示最近 intervention：

- `有用`
- `待观察`
- `可能噪声`
- `失败循环`
- `已合并`

#### `场景调优`

按 sceneKey 聚合：

- Jira estimate planning
- BE readiness Ask
- AI workflow clinic
- Meeting Pilot action items
- External AI context passport

每个 scene 显示：

- 展示次数。
- 用户展开/复制/发送率。
- fast dismiss rate。
- delayed resolution rate。
- confirm debt created。
- recommended policy。

#### `来源成效`

按 source type/source ref 聚合：

- Glip thread。
- Jira source memory。
- meeting transcript。
- reflection thread。
- user profile item。
- external AI import。

这不是“来源质量评分”公开排名，而是帮助系统判断哪些来源在什么场景里有用。

## 技术方案

### 新表草案

```sql
CREATE TABLE memory_interventions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  task_intent TEXT,
  intervention_type TEXT NOT NULL,
  shown_at INTEGER NOT NULL,
  source_refs_json TEXT,
  evidence_refs_json TEXT,
  rendered_summary TEXT,
  risk_level TEXT DEFAULT 'low',
  confidence REAL DEFAULT 0.5,
  salience_at_show REAL DEFAULT 0,
  ranking_reason_json TEXT,
  quieted_alternatives_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_memory_interventions_user_scene
  ON memory_interventions(user_id, scene_key, shown_at DESC);

CREATE TABLE memory_outcome_signals (
  id TEXT PRIMARY KEY,
  intervention_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  surface_event_ref TEXT,
  value REAL,
  note TEXT,
  inferred INTEGER DEFAULT 0,
  confidence REAL DEFAULT 1,
  metadata_json TEXT,
  FOREIGN KEY(intervention_id) REFERENCES memory_interventions(id)
);

CREATE INDEX idx_memory_outcome_signals_intervention
  ON memory_outcome_signals(intervention_id, occurred_at);

CREATE TABLE memory_impact_assessments (
  intervention_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  usefulness TEXT NOT NULL,
  reason_codes_json TEXT,
  impact_score REAL DEFAULT 0,
  attention_cost REAL DEFAULT 0,
  delayed_outcome_window_hours INTEGER DEFAULT 24,
  recommended_policy_patch_json TEXT,
  assessed_at INTEGER NOT NULL,
  FOREIGN KEY(intervention_id) REFERENCES memory_interventions(id)
);

CREATE TABLE memory_outcome_policy_patches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  patch_scope TEXT NOT NULL,
  scene_key TEXT,
  source_ref TEXT,
  intervention_type TEXT,
  action TEXT NOT NULL,
  reason_codes_json TEXT,
  strength REAL DEFAULT 0.5,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
```

### 事件采集

第一阶段只接入已有低成本事件：

| Surface | 事件 |
| --- | --- |
| Memory Lens | shown、expanded、source_opened、dismissed、feedback |
| Compose Assist | suggestion_shown、inserted、edited、sent、deleted |
| Ask | answer_shown、source_opened、ask_repeated、confirm_request_created |
| Day Pilot | mission_shown、opened、copied、dismissed、completed |
| Meeting Pilot | cue_shown、pinned、copied_action_item、confirmed_action_item、ignored |
| Context Passport | previewed、source_removed、copied、injected、result_imported |
| Reflection / actions | action_created、queued、executed、failed、dead_letter、confirm_request_created |

### Impact scorer

P0 不需要复杂模型，先用可解释规则：

```ts
function assessImpact(signals: OutcomeSignal[]): ImpactAssessment {
  let score = 0;
  let attentionCost = 0;
  const reasons = [];

  if (has(signals, 'expanded')) score += 0.1;
  if (has(signals, 'source_opened')) score += 0.15;
  if (has(signals, 'copied')) score += 0.2;
  if (has(signals, 'inserted')) score += 0.25;
  if (has(signals, 'sent')) score += 0.3;
  if (has(signals, 'followup_resolved')) score += 0.4;
  if (has(signals, 'marked_relevant')) score += 0.5;

  if (has(signals, 'dismissed_fast')) {
    score -= 0.25;
    attentionCost += 0.2;
    reasons.push('dismissed_fast');
  }
  if (has(signals, 'marked_irrelevant')) score -= 0.6;
  if (has(signals, 'too_late')) reasons.push('late_after_user_acted');
  if (has(signals, 'action_failed')) score -= 0.35;
  if (has(signals, 'confirm_request_created')) attentionCost += 0.4;
  if (has(signals, 'ask_repeated')) score -= 0.25;

  return bucket(score, attentionCost, reasons);
}
```

P1 再做模型辅助：

- 对 edited draft 做 diff，判断保留了哪些建议。
- 对 delayed conversation 做 resolution 分类。
- 对 repeated Ask 做 same-meaning cluster。
- 对 action failure 做 root cause：缺权限、缺 connector、证据弱、目标不明确、外部服务失败。

### 反向影响策略

Outcome Loop 不直接改原始记忆，而是写 policy patch：

| Patch | 含义 |
| --- | --- |
| `boost` | 在类似 scene 提升某 source/ref/intervention type。 |
| `suppress` | 一段时间减少同类提示。 |
| `merge` | 同义事实/确认请求合并展示。 |
| `ask_less` | 降低主动追问/confirm request 频率。 |
| `require_better_evidence` | 没有新权威证据前不更新当前事实。 |
| `send_to_skill_foundry` | 重复成功流程进入 skill candidate。 |
| `route_to_relevance_trainer` | 明确不相关且可学习的召回错误进入校准。 |
| `route_to_lifecycle` | 长期无成效内容降权或归档。 |

### 与现有服务集成

#### Memory Service

新增：

- `MemoryOutcomeRepository`
- `MemoryInterventionService`
- `OutcomeSignalCollector`
- `ImpactAssessmentWorker`
- `OutcomePolicyService`

接入：

- `ContextRecallService`：记录 shown/quieted/expanded，读取 policy patch。
- `AnswerMemoryService`：记录 Ask answer 是否 repeated / resolved，合并同义确认债。
- `ActionExecutor`：记录 queued/succeeded/failed/dead_letter。
- `DayPilotService`：记录 mission 成效和 ignored mission。
- `ReflectionPlanner`：读取失败循环，减少无效外部核实。
- `Skill Foundry`：消费重复成功的 intervention pattern。
- `Ambient Memory Forgetting`：消费长期无成效信号。

#### Extension UI

新增通用组件：

- `OutcomeStrip`
- `OutcomeFeedbackMenu`
- `OutcomeDetailsDrawer`
- `OutcomeReceiptTimeline`

接入：

- Memory Lens card footer。
- Compose Assist suggestion footer。
- Meeting Pilot cue/action item。
- Ask answer footer。
- Day Pilot mission card。
- Context Passport preview。

### API 草案

```http
POST /api/v1/outcomes/interventions
GET  /api/v1/outcomes/interventions/:id
POST /api/v1/outcomes/interventions/:id/signals
POST /api/v1/outcomes/interventions/:id/feedback
GET  /api/v1/outcomes/summary?window=7d
GET  /api/v1/outcomes/scenes/:sceneKey
GET  /api/v1/outcomes/policy-patches
POST /api/v1/outcomes/policy-patches/:id/revoke
```

## MVP 范围

### P0：成效账本骨架

目标：证明可以跨 surface 记录 intervention 和 outcome signal。

范围：

- 新表和 repository。
- 接入 Memory Lens / Ask / proposed_actions 三个 surface。
- 支持 `shown`、`expanded`、`source_opened`、`dismissed`、`marked_relevant`、`marked_irrelevant`、`action_succeeded`、`action_failed`、`confirm_request_created`。
- 简单 rule-based impact assessment。
- Outcome Details Drawer demo。
- 不影响现有排序，只记录数据。

验收：

- 能在本地 E2E 里看到一条 Memory Lens cue 的完整 outcome timeline。
- ActionExecutor 失败能写入 outcome signal。
- Ask 重复问题能关联到上一条 answer intervention。

### P1：排序和静默策略接入

目标：让成效信号真正减少打扰。

范围：

- `OutcomePolicyService` 生成可撤销 policy patch。
- Context Recall / Ask / Day Pilot 读取 patch。
- 对同一 sceneKey fast dismiss 的 cue 降低频率。
- 对 action_failed_capability_missing 的 delegate action 暂停自动重试。
- 对 copied_then_sent 的 source 在同类场景 boost。

验收：

- 同一无效 cue 连续 dismiss 后，下一次在同类 scene 被 quieted，并在 receipt 里说明。
- BE ready 重复外部核实失败后，不再生成重复 OpenClaw delegation，而是提示需要权威源。

### P2：Delayed outcome 和 Skill Foundry

目标：把“真的帮上忙”的模式沉淀。

范围：

- 关联 sent message 后续 reply / reaction / no further clarification。
- 关联 meeting action item confirmed/completed。
- 关联 Context Passport result imported。
- 将重复成功的 intervention pattern 送到 Skill Foundry。
- 生成每周 Personal AI 成效摘要。

验收：

- 能识别 estimate 单位说明类建议被多次采用。
- 能生成一个 skill candidate，例如 `Estimate wording helper`。

2026-06-09 实现注记：当前已完成 Jira estimate cue 的最小 P1/P2 闭环。它只消费 cue-backed ambient trace 和 Memory Lens `/feedback`，只生成 cue-level suppress / boost patch，以及 `Estimate wording helper` suggestion；尚未实现跨会议、Ask、OpenClaw 或每周成效摘要。

### P3：跨 AI 结果回流

目标：外部 AI 使用 Personal AI context 后，结果可回流学习。

范围：

- Context Passport 记录目标平台、copy hash、source refs。
- 用户导入 Codex/OpenClaw/ChatGPT 结果后匹配到 passport。
- 记录“这个上下文包是否让 AI 少问背景 / 是否完成任务 / 是否用了错误事实”。

验收：

- 一个 Codex task brief 被复制后，结果文件/PR/报告可回链到 passport intervention。

## 成功指标

### 产品指标

- Memory Lens / Compose Assist `fast dismiss rate` 下降。
- `copy/insert -> sent` 比率上升。
- 同一 Ask 意图 24h 内重复提问率下降。
- `confirm_requests.pending` 中 same-meaning property change 比例下降。
- `delegate_openclaw failed` 重复失败率下降。
- 用户主动点 `不相关 / 证据弱 / 太晚` 后，同类错误 7 天内复发率下降。

### 质量指标

- 被 boost 的 source 在后续场景中的采纳率高于未 boost source。
- 被 suppress 的 cue 复显后负反馈率下降。
- Outcome assessment 与人工抽样判断一致率。
- 不把“复制但未发送”误判为强成功。
- 不把“用户没点”误判为失败。

### 用户体验指标

- 每天新增显式反馈请求不超过 3 次。
- Outcome Strip 不遮挡主工作流。
- 详情 drawer 可解释每次策略调整。
- 用户能撤销自动调优 patch。

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| 变成用户监控/行为打分 | 所有数据只用于用户自己的 Personal AI；不做团队排行；默认本地/私有。 |
| 误把忽略当负反馈 | fast dismiss 只作为弱信号，需要重复或显式反馈才 suppress。 |
| 误把复制当成功 | 复制只是中等信号；发送、后续回复、任务完成才是强信号。 |
| 增加用户负担 | 默认自动收集，显式反馈只在少数高价值场景出现。 |
| Outcome 归因困难 | 使用 sceneKey、sourceRefs、时间窗口和 conservative bucket；不做过度确定结论。 |
| 影响排序后引入新偏差 | policy patch 可撤销、有 TTL、可在 debug 中看到原因。 |
| 记录敏感草稿 | 保存 hash、diff ratio、source refs 和用户选择；高敏内容不保存全文。 |
| 反馈循环强化用户坏习惯 | 不只看采纳率，还看证据质量、风险、撤销、后续冲突。 |

## 验证计划

### 文件和静态验证

- `git diff --no-index --check /dev/null docs/progressing/memory-outcome-loop-plan.md`
- `git diff --no-index --check /dev/null docs/progressing/memory-outcome-loop-demo.html`
- `rg` 检查 plan 必备章节。
- 对 demo 内联 JS 做 `node --check` 或 `vm.Script` 解析。

### 体验验证

- 桌面宽度打开 demo，检查三个场景切换：
  - RingCentral estimate reply。
  - Jira BE ready fact follow-up。
  - AI workflow clinic。
- 验证点击 `有用`、`不相关`、`太晚了`、`查看成效详情` 后 UI 状态变化。
- 验证移动宽度 390px 无横向溢出。

### 未来实现验证

- Unit tests：
  - intervention create/list。
  - outcome signal append。
  - impact scorer reason code。
  - policy patch TTL / revoke。
- API tests：
  - Memory Lens cue shown -> feedback -> assessment。
  - proposed action failed -> outcome signal。
  - Ask repeated -> previous intervention negative delayed outcome。
- E2E：
  - extension page Memory Lens footer。
  - Ask answer footer。
  - Meeting Pilot action item feedback。
- Eval suite：
  - `memory-outcome-loop`
  - cases: copied then sent, fast dismiss false negative, OpenClaw repeated failure suppression, repeated Ask unresolved, successful estimate wording boost。

## 推荐实现顺序

1. **P0 只记录，不改排序。** 先证明账本能跨 surface 收集真实数据。
2. **从失败循环切入。** 优先处理 `delegate_openclaw failed` 和 same-meaning confirm debt，因为真实数据已经明显。
3. **再接入 Memory Lens / Ask 的轻量反馈。** 不要一开始铺满所有 UI。
4. **最后才做主动 boost。** 降低噪声比过早强化更安全。
5. **每个 policy patch 都可撤销和过期。** 防止一次误判长期污染召回。

## Demo 说明

Demo 文件：[`memory-outcome-loop-demo.html`](./memory-outcome-loop-demo.html)

它模拟的是集成在其他页面里的效果，而不是独立后台：

- 左侧是工作现场：RingCentral、Jira、AI workflow clinic 三个场景。
- 中间是当前输入/问题/会议准备。
- 右侧是 Personal AI 的 `Outcome Strip` 和 `成效详情`。
- 点击反馈按钮后，可以看到 outcome timeline、impact score、下次策略变化。

Demo 文案默认中文，保留部分真实记忆中的英文项目名、Jira key、OpenClaw、Codex 等原语言。

## 最终建议

建议把 **Memory Outcome Loop / 记忆成效回路** 作为一个值得进入实现评审的新能力。

它的亮点不是再多一个页面，而是给 Personal AI 建立“从真实使用结果学习”的底层回路：

- 让记忆提示不再只靠相似度，而是靠真实成效校准。
- 让 OpenClaw / Reflection / Ask 的失败循环能自动收敛。
- 让用户少点维护，多得到更准的提示。
- 让 Skill Foundry、遗忘层、Context Passport、Memory Lens 都能消费同一个 outcome evidence。

如果要做，建议先做 P0 + 一条失败循环切片：`Ask / BE ready / OpenClaw delegation / confirm request`。这条路径已经有真实数据、真实痛点和清晰成效指标，风险比新造大页面低。
