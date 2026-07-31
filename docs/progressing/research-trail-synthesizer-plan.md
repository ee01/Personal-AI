# 新能力：Research Trail Synthesizer / 研究足迹合成器（搁置）

> Codex 会话标题建议：`新能力：研究足迹合成器（搁置）`
> 状态：搁置；不建议按“调研专用流程”形态实现，未改运行时代码
> Demo：[research-trail-synthesizer-demo.html](./research-trail-synthesizer-demo.html)（仅作为已搁置方向的视觉参考）

## 搁置原因

本方案把“调研”抽成了研究问题、来源采用/排除、结论、缺口和下一步等专用状态，并据此设计独立的流程链路。这个抽象过度贴合单一场景，不符合 Personal AI 应有的记忆运作方式。

Personal AI 的核心不应为聊天、调研、会议、Jira 或其他场景分别建立一套记忆流程。更合理的方向是像人脑一样，让不同类型的记忆共享同一套底层机制：根据用户当前看到的内容、正在执行的动作、近期目标和长期偏好，快速关联相关记忆，再由关联结果临时形成判断、提醒、对比、缺口或下一步。所谓“研究足迹”应该只是这种通用关联能力在调研现场自然呈现的一种结果，而不是独立数据模型、独立工作台或独立状态机。

因此本方案保留为搁置记录，不进入实现。后续若继续探索，应优先研究通用的实时记忆关联、关联强度与抑制机制、上下文触发、跨记忆推理和低打扰呈现，并验证同一底层机制能否同时服务聊天、浏览、会议、操作和跨 AI 对话，而不是继续完善本方案中的调研专用链路。

## 一句话结论

以下是已搁置的原始设想：**研究足迹合成器**。

它把用户一次真实研究过程中的网页、source-memory capsule、AI 对话、Jira/Google 文档线索、会议片段和用户自然操作，合成一条可继续的研究足迹：

- 这次研究到底在回答什么问题。
- 已看过哪些来源，哪些被采用、排除、过期或还没读完。
- 当前结论、候选方案、对比标准和剩余缺口是什么。
- 下次回到相关网页、AI 输入框、Jira 或 Ask 时，怎样继续，不需要重新翻历史。

它不是单条资料摘要器，也不是 AI Tool Compass，不推荐“该用哪个 AI”。它补的是用户做复杂信息研究时最容易丢的那一层：**从资料收集到可行动判断之间的个人 sensemaking 过程记忆**。

## 真实场景：用户会怎么体验

### 场景 1：研究 AI 工具和许可策略，第二天不用重来

1. 用户在 RingCentral 里看到“ChatGPT enterprise option suddenly disappeared”“Codex Enterprise trial”“Cursor 更贵、团队要投票 Codex 还是 Claude Code”等消息。
2. 用户打开几篇内部 wiki、OpenAI Deep Research、NotebookLM、Glean Deep Research、Claude/AI tool 资料，又在 ChatGPT 或 Codex 里问了一轮“我们团队现在该怎么评估 AI 工具”。
3. 现状下，这些资料会散落成 source memory、聊天记录和网页历史。过两天用户再想写一段给团队的建议，要重新搜、重新判断哪些是旧政策、哪些是当前可用。
4. 有研究足迹合成器后，Personal AI 在浏览器右侧低打扰显示：`已形成研究足迹：AI 工具可用性与团队选型`。
5. 用户点开看到：
   - 研究问题：`团队在 ChatGPT 不稳定、Codex trial、Cursor 成本变化下，如何选择 AI 工具？`
   - 已采用来源：内部群消息、AI Tools policy 摘要、OpenAI Deep Research、NotebookLM/Glean 竞品资料。
   - 当前结论：`Codex 适合代码/仓库任务；ChatGPT 可用性需守望；Cursor 成本/许可需要单独确认。`
   - 证据缺口：`缺少最新 license reclaim policy；缺少团队真实使用反馈。`
   - 下一步 prompt：一段可复制给 Codex/ChatGPT 的研究补充问题，带来源和边界。
6. 用户第二天打开 Codex 或相关 wiki 时，只看到一条小 chip：`上次研究停在：缺 license policy 与团队反馈`。不需要进入新 dashboard，也不会自动把私有资料发给外部 AI。

### 场景 2：技术/Jira 方案调研，自动形成对比表而不是一堆网页

1. 用户为了一个 Jira / release / task-estimate 问题，打开 Jira、Google Doc、MR diff、AI 对话和几篇产品/论文资料。
2. 用户复制了某些页面内容，停留时间较长，部分资料已经被 Memory Capture 自动或手动存为 source memory。
3. 研究足迹合成器发现这些来源都围绕同一个问题：`Task Estimate 是否应该读取图片语义、MR diff、历史 story points 和 Jira team 字段？`
4. 工作台自动生成一张对比表：
   - 输入来源：Jira REST、MCP、浏览器 fallback、图片语义、MR diff。
   - 价值：估算准确度、可解释性、执行成本。
   - 风险：权限、速度、幻觉、fallback 说明。
   - 当前决策：`默认 Jira API/MCP，浏览器只作 fallback；图片/MR diff 作为高级证据。`
5. 当用户再次在 Web AI 输入框里写“帮我完善 task-estimate 方案”时，Compose Assist 不只给三条记忆，而是引用这条研究足迹：`这是一个已有研究任务，是否插入当前结论 + 缺口 + 下一步验证？`

## 为什么现在值得做

### 用户需求

Personal AI 已经能保存消息记忆、浏览资料、AI 对话、操作和 skill，但“复杂研究过程”仍然容易断：

- 用户看过很多资料，但忘了哪些已经判断过。
- AI 对话能给答案，但下次打开另一个 AI 或 Jira 时，研究状态没有跟着走。
- Source Memory Distiller 能蒸馏单条资料，但不知道这些资料合起来是为了解决哪个问题。
- Storyline Builder 能把资料讲给别人，但不是用户做研究时的工作态。
- Operation Flight Recorder 能记录“怎么做成一件事”，但研究型工作更关心问题、候选、证据、缺口和当前判断，而不是每一步操作回放。

研究足迹合成器满足的是一个很实际的需求：**我上次研究到哪里了？我已经信什么、不信什么、还缺什么？现在打开这个页面/AI/Jira 时应该继续哪一步？**

### 本轮本地和线上信号

- 本机 Reminders 的 `Personal AI` 列表存在，但未完成条目为 0；本轮 idea 不是来自 Reminder，因此没有标记 done。
- `10.32.56.212:3210` 的 `/health` 当前为 degraded，`database.connected=false`；但 `/api/v1/stats` 可读，`X-User-Id: esone.qiu` 返回：
  - `messages.total=11272`
  - `chunks.total=10110`
  - `relationships.total=54683`
  - `confirmRequests.pending=30`
  - `memory.temporary=2602`
  - `memory.archived=8299`
- actions API 前 100 条里，`delegate_openclaw=98`，`artifact_gap=53`，说明“外部核实/证据缺口”仍很重；但昨天已有 `Action Readiness Contracts / 执行就绪契约`，本方案不再重复 action preflight。
- reflection threads 里有高优先级 `ChatGPT · availability`、`codex · recommendation_status`、`Codex · update_status`、`Claude · access_type_requested`、`AI-Native Challenge · recommended_reasoning_effort` 等事实跟进，说明 AI 工具、许可、可用性和使用策略是高频研究对象。
- recall 样本包含真实片段：
  - `Chatgpt is unavailable here, while Codex is the recommended tool there`
  - `AI Tools: Codex, Cursor, and Cost Management`
  - `Task Estimate currently evaluates based on: Jira ticket team field ... Summary ... Description ... Historical Story Points benchmark`
  - `大概意思就是读jira 信息，包括图片语义，以及有 link MR 的 gitlab 代码 diff`

这些信号共同指向：用户不是缺少“保存网页”的能力，而是缺少把研究过程持续合成、复用和回到现场的能力。

> 限制：本轮尝试 SSH 只读 DB 抽样时被远端拒绝为 `Too many authentication failures`，因此没有继续读取 live SQLite。上述判断基于可用 HTTP API、recall 样本和 repo 去重。

## 亮点

1. **从 source 到 trail**：不再把网页、AI 回答和 Jira 片段当孤立卡片，而是聚合成一个研究任务的“问题、证据、判断、缺口、下一步”。
2. **现场继续，而不是回后台整理**：用户打开相关网页、Web AI 输入框、Jira 或 Ask 时，只出现一个继续提示，不要求每天维护研究台。
3. **保留分歧和未决**：不强行总结成一个结论。研究足迹应该明确显示 `adopted / rejected / uncertain / stale / missing authority`。
4. **天然适合私人记忆**：NotebookLM/Glean 面向 source repository 或企业搜索，Personal AI 可以把用户的消息、会议、AI 对话、浏览、操作和偏好合起来。
5. **可反哺现有能力**：Research Trail 可以被 Ask、Compose Assist、AI Context Passport、Storyline Builder、Skill Foundry、Evidence Watch 引用，但不替代它们。

## 与已有能力和 progressing 计划的边界

| 已有能力 / 计划 | 已覆盖 | 本方案新增 |
|---|---|---|
| Memory Capture / Source Memory Distiller | 单条网页、选区、Jira comment 的保存、蒸馏、触发线索 | 把多条 source memory 归入同一个研究问题，并持续维护结论/缺口/对比表 |
| Memory Lens | 当前页面相关记忆提示 | Research Trail 只在页面属于某条研究任务时展示“继续研究”入口，不泛化成更多卡片 |
| Compose Assist / Prompt Context Compiler | 输入框前补上下文、补 prompt slot | Research Trail 提供“当前研究状态”作为高层 evidence，而不是每次重新从碎片召回 |
| AI Context Passport | 把任务上下文交给外部 AI | Research Trail 可导出 Passport，但核心是研究过程本身，不是一次 handoff |
| AI Conversation Memory Loom（搁置） | 跨 AI 对话聚合、共识/分歧 | 本方案不假设频繁跨 AI 聊同一问题；它以研究任务为中心，AI 对话只是来源之一 |
| AI Tool Compass（搁置） | 推荐当前任务用哪个 AI 工具 | 本方案不做工具推荐，只记录用户研究工具/资料时形成的判断 |
| Operation Memory Flight Recorder | 操作 episode、步骤回放、可提炼 skill | Research Trail 更偏问题研究和证据综合，不记录完整操作步骤 |
| Storyline Builder | 面向人类受众的叙事、汇报、培训 | Research Trail 是工作态，可被 Storyline 引用，但不负责对外表达 |
| Decision Time Machine | 决策发生后的证据回放 | Research Trail 覆盖决策前和决策中，允许“尚未决定” |
| Evidence Watch Contracts | 可变化事实的后台守望 | Research Trail 可把缺口转成 watch，但不负责周期查证和 action 调度 |
| Memory Change Ledger / Freshness Radar | 事实变化和来源变化 | Research Trail 消费变化信号，给当前研究显示 stale/changed receipt |
| Memory Trust Console / Reality Check（搁置） | 全局可信治理或输出核验 | Research Trail 只对本研究里的来源和结论显示局部证据边界 |

## 业内产品和研究参考

### OpenAI Deep Research

[OpenAI Deep Research](https://openai.com/index/introducing-deep-research/) 强调 agentic multi-step research，能搜索、分析和综合大量网页/文件/PDF，并输出带引用的报告。2026-02-10 的更新还提到可接入 MCP/app、限制可信站点、实时跟踪进度和中途 refine。

对 Personal AI 的启发：研究不是一次搜索，而是多步计划、浏览、证据选择、综合和可验证输出。不同点是 OpenAI 主要在 ChatGPT 内完成一次 report；Personal AI 应保存用户跨多天、跨工具的研究状态。

### Google NotebookLM

[NotebookLM Sources](https://support.google.com/notebooklm/answer/16215270?co=GENIE.Platform%3DDesktop&hl=en) 支持从 Web 或 Drive 选择 sources，Google Drive source 可同步更新；Deep Research 结果可选择导入为 notebook sources。[NotebookLM Discover Sources](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-discover-sources/) 则把“描述主题 -> 找到并总结相关来源 -> 一键加入 notebook”产品化。

对 Personal AI 的启发：source selection 和 source review 要显式；不能把所有浏览历史都当研究证据。不同点是 NotebookLM 是 notebook-scoped，Personal AI 是用户生活和工作记忆 scoped。

### Glean Deep Research

[Glean Deep Research docs](https://docs.glean.com/user-guide/assistant/deep-research) 把 deep research 定义为综合企业系统和 Web 的 citation-rich report；[Glean blog](https://www.glean.com/blog/deep-research-septdrop-2025) 强调 internal + external sources、complete citations 和 business decision support。

对 Personal AI 的启发：内部系统 + 外部 Web 的结合，正是用户真实研究场景。但 Glean 面向企业知识库；Personal AI 还应纳入个人偏好、AI 对话、会议和操作记忆。

### Sensemaking / Intentmaking 研究

[Sensemaking AI](https://link.springer.com/article/10.1140/epjds/s13688-026-00634-5) 提出 AI 应支持人类在动态网络中的 meaning-making，而不只是优化单一指标；它强调保留解释弹性、显式化价值假设、在需要时回到人类判断。

[Intentmaking and Sensemaking](https://arxiv.org/html/2605.05921v1) 把与 AI-guided discovery 的交互描述为用户在观察 AI 行为、调整问题设定、修正 mental model 的迭代过程。

对 Personal AI 的启发：研究足迹不应只输出“最终答案”，而应保存用户如何形成问题、如何调整判断、哪些证据改变了结论。

### 经典信息觅食 / sensemaking loop

Pirolli & Card 的 sensemaking 模型把分析活动分成 information foraging loop 和 sensemaking loop：先搜集/过滤/抽取信息，再形成 schema、假设和可沟通产物。研究足迹合成器正好把这两个 loop 显式落到 Personal AI 的数据结构里。

## 产品形态

### 1. 浏览器低打扰 chip

触发条件：

- 当前页面 URL / title / selected text 与已有 research trail 的 `topicKey`、实体、source host 或 open question 命中。
- 最近 24 小时内用户保存/复制/停留过多个同主题 source memory。
- 用户在 Web AI 输入框里写了与某条 trail 的 research question 相近的问题。

显示：

- `研究足迹：AI 工具可用性与团队选型`
- `当前停在：缺 license policy 与团队反馈`
- 操作：`打开足迹`、`插入当前结论`、`本页加入足迹`、`不再提示本页`

边界：

- chip 默认只读，不自动保存当前页面。
- `本页加入足迹` 只把当前页面作为 candidate source；如果页面未被 source memory 保存，先走 Memory Capture 的保存/复核链路。
- `插入当前结论` 只插入到输入框，不自动发送。

### 2. Research Trail 工作台

建议作为 `memory-exploring.html#/research-trails/:id` 或 source-memory 详情页旁的 tab。

页面结构：

- 顶部：研究问题、状态、最近更新、来源数量、当前结论强度。
- 左栏：sources，按 adopted / rejected / unread / stale / blocked 分组。
- 中栏：当前 synthesis，包括：
  - 当前结论
  - 候选方案
  - 对比标准
  - 分歧和反证
  - open questions
- 右栏：下一步动作：
  - 复制给 AI 的 follow-up prompt
  - 转成 AI Context Passport
  - 转成 Storyline outline
  - 创建 Evidence Watch
  - 标记当前判断为 decision snapshot

### 3. Ask / Compose Assist 集成

Ask：

- 当用户问“上次研究 Codex Sites / Task Estimate / AI tools 进展到哪了？”时，Ask 优先返回 research trail summary，而不是从所有 chunks 重新拼。

Compose Assist：

- 在 Web AI 输入框中，当前 draft 命中 trail 时，输出 `research_patch`：
  - 当前研究问题
  - 已知结论
  - 证据来源
  - 未决问题
  - 不可外发/需脱敏内容

### 4. 研究状态 receipt

用户必须能看到：

- `本页只是候选来源，尚未写入资料记忆`
- `本研究引用 8 个来源，其中 2 个是旧快照`
- `3 条来源来自内部消息，不会自动外发给 ChatGPT`
- `当前结论是 partial，不是 confirmed profile`
- `没有读取日常浏览器以外的标签页`

## 数据契约草案

```ts
type ResearchTrailStatus =
  | 'active'
  | 'paused'
  | 'decision_snapshot'
  | 'stale'
  | 'archived';

type ResearchTrail = {
  id: string;
  userId: string;
  title: string;
  researchQuestion: string;
  topicKey: string;
  status: ResearchTrailStatus;
  scope: 'work' | 'personal' | 'mixed';
  createdAt: number;
  updatedAt: number;
  lastUserTouchedAt: number;
  sourceCount: number;
  adoptedSourceCount: number;
  rejectedSourceCount: number;
  openQuestionCount: number;
  currentConclusionStrength: 'none' | 'weak' | 'partial' | 'strong';
  egressPolicy: 'local_only' | 'redacted_export_allowed' | 'export_allowed';
  receipts: TrailReceipt[];
};

type ResearchSourceRef = {
  id: string;
  trailId: string;
  sourceKind:
    | 'source_memory_capsule'
    | 'web_snapshot'
    | 'ai_conversation'
    | 'message_chunk'
    | 'jira_issue'
    | 'google_doc'
    | 'meeting'
    | 'manual_note';
  sourceRefId: string;
  title: string;
  urlHost?: string;
  role: 'adopted' | 'rejected' | 'unread' | 'background' | 'counterevidence';
  reason: string;
  freshness: 'live' | 'snapshot' | 'possibly_stale' | 'blocked';
  visibility: 'local_only' | 'private' | 'shareable_redacted' | 'shareable';
  addedBy: 'user' | 'auto_cluster' | 'compose_assist' | 'ask' | 'source_memory';
  addedAt: number;
};

type ResearchSynthesis = {
  trailId: string;
  version: number;
  summary: string;
  currentConclusion: string;
  confidence: 'low' | 'medium' | 'high';
  criteria: Array<{
    name: string;
    whyItMatters: string;
    currentWinner?: string;
  }>;
  alternatives: Array<{
    label: string;
    pros: string[];
    cons: string[];
    evidenceRefs: string[];
  }>;
  openQuestions: Array<{
    question: string;
    blockerType: 'missing_source' | 'stale_source' | 'authority_needed' | 'user_judgment';
    suggestedNextStep: string;
  }>;
  generatedAt: number;
  model?: string;
};

type TrailReceipt = {
  type:
    | 'read_only'
    | 'candidate_source'
    | 'source_saved'
    | 'source_hidden'
    | 'partial_synthesis'
    | 'stale_source'
    | 'egress_blocked'
    | 'export_redacted';
  title: string;
  detail: string;
  createdAt: number;
};
```

## 实现形态

### 后端服务

- `ResearchTrailRepository`
  - 表：`research_trails`
  - 表：`research_trail_sources`
  - 表：`research_trail_syntheses`
  - 表：`research_trail_events`
- `ResearchTrailClusterService`
  - 从 source-memory capsule、web activity signal、AI conversation artifact、message chunks、Jira/source refs 中发现候选 cluster。
  - 使用实体 overlap、URL host、title/query similarity、时间窗口、用户操作强度和 source memory note。
- `ResearchTrailSynthesizer`
  - 把来源蒸馏成研究问题、当前结论、对比标准、open questions。
  - 只引用 source refs，不把大段内部文本塞进生成结果。
- `ResearchTrailPresentationService`
  - 给 Memory Lens / Compose Assist / Ask 生成局部展示 contract。
  - 负责 scope、freshness、egress 和 source visibility receipt。

### API 草案

```http
GET /api/v1/research-trails?status=active
GET /api/v1/research-trails/:id
POST /api/v1/research-trails/candidates/score
POST /api/v1/research-trails
POST /api/v1/research-trails/:id/sources
POST /api/v1/research-trails/:id/synthesize
POST /api/v1/research-trails/:id/archive
POST /api/v1/research-trails/:id/export-context
POST /api/v1/research-trails/:id/feedback
```

### 前端集成点

- `src/contentScriptWebIntelligence.ts`
  - 复用当前页面上下文、停留/复制/滚动信号，只新增 research candidate scoring，不直接写 trail。
- `src/modals/components/SourceMemoryDetailPage.vue`
  - 增加“属于哪些研究足迹”区块。
- `memory-exploring` 路由
  - 新增 `/research-trails` 列表与 `/research-trails/:id` 详情。
- `src/composer-guard`
  - 命中 research trail 时生成 `research_patch` 类型建议。
- `memory-service/src/core/ContextRecallService.ts`
  - 支持 `sourceTypes:['research_trail']`，但默认只在 Ask/Compose 场景启用，避免 Memory Lens 被高层 summary 淹没。

## 关键算法

### 候选 trail 发现

P0 不做全量浏览历史。只从高信号事件开始：

- 用户手动保存 source memory。
- 整页 source memory 自动保存成功。
- 用户复制大量正文或停留深读。
- Web AI 输入框里出现研究型问题。
- Ask 问题需要多源证据。
- 同一主题短时间内出现 3 个以上 source refs。

候选聚类规则：

- `entityOverlap >= 2` 或同一 Jira/project/topic 命中。
- 标题/正文 embedding 相似。
- URL host 属于同一研究对象或同一工具族。
- 时间窗口默认 72 小时，可被用户手动延长。
- 若来源 visibility 不兼容，允许同一 trail 内存在 private source，但 export 时必须 redacted。

### Synthesis 更新

触发：

- 新 adopted source 加入。
- 用户把 source 标为 rejected/counterevidence。
- 重要来源 stale / inaccessible。
- 用户主动点击 `刷新合成`。
- Ask/Compose 需要 trail summary 且旧 synthesis 超过 TTL。

输出必须包含：

- current conclusion，不超过 5 条。
- criteria table，能解释为什么这些维度重要。
- open questions，必须能转成下一步行动。
- source coverage receipt：哪些来源参与、哪些未读/被排除。

### 不做的事

- 不自动打开网页补资料。
- 不自动把结论写入 user profile。
- 不自动发送到外部 AI。
- 不把浏览历史全量保存为 research trail。
- 不要求用户维护一个每日研究 inbox。

## 隐私、安全和边界

- 私有消息、会议、Jira 内部资料默认 `local_only`，导出给外部 AI 时必须走 redaction/export contract。
- 未保存的网页只作为 candidate，不进入 recall，也不出现在 Ask 答案。
- source memory 如果已 dismissed，trail 只能保留审计引用，不能把它作为当前证据。
- 对 untrusted webpage 的内容做 injection defense；网页文字不能指挥 Personal AI 修改 trail 或外发数据。
- 同一 trail 混合 work/personal 来源时，状态显示 `mixed scope`，默认禁止外发。
- synthesis 是 `partial research artifact`，不是 confirmed truth；只有用户显式保存为 decision snapshot 或 profile fact 后才进入更强事实层。

## Evals 需求

这个功能依赖召回质量、聚类质量、LLM synthesis 和用户体验判断，真正实现时必须创建 eval suite，并在实现完成后跑 report。

建议新增：

- `evals/cases/research-trail-synthesizer/`
- `evals/workflows/research-trail-synthesizer/experience.md`
- `evals/registry.yaml` 注册 suite

必须覆盖的真实场景：

1. **AI 工具可用性和团队选型**
   - 输入：ChatGPT unavailable、Codex recommended、Cursor cost、Claude access request、内部 policy 片段。
   - 期望：聚成一个 research trail，而不是 5 个孤立事实 watch。
   - 失败条件：推荐具体工具但没有证据；把旧 ChatGPT outage 当作当前事实；外发内部消息原文。
2. **Task Estimate / Jira evidence 研究**
   - 输入：Jira field、图片语义、MR diff、historical SP benchmark、browser fallback policy。
   - 期望：输出 criteria table 和 open questions；明确 Jira API/MCP 优先，浏览器 fallback 需说明原因。
   - 失败条件：把 operation steps 误当研究结论；生成不可验证的估算规则。
3. **source-memory 多来源聚合**
   - 输入：多个网页/source-memory capsule，其中 1 个 dismissed、1 个 possibly stale。
   - 期望：dismissed 不参与当前结论；stale 来源显示 receipt。
4. **无关来源抗污染**
   - 输入：同一天浏览的假期通知、会议 shell、无关产品页面。
   - 期望：不并入 research trail。
5. **外发保护**
   - 输入：Research Trail 导出给 ChatGPT。
   - 期望：内部消息和 Jira raw details 被 redacted，只保留可分享结论/问题。

运行要求：

```bash
npm run eval:validate
npm run eval:run -- --suite research-trail-synthesizer --no-repair
```

如果 report 没有通过，继续改进聚类、source visibility 和 synthesis prompt，直到所有测试通过。需要真实场景时，从 `10.32.56.212` 的 `esone.qiu` memory-service 数据中抽样构造 fixture；如果 HTTP degraded 或 SSH 不可用，report 必须说明证据来源和缺口。

## Rollout 分期

### P0：手动/半自动 research trail

- 在 source-memory 详情页支持 `加入研究足迹`。
- Web AI /网页中出现候选 chip：`本页可能属于研究足迹`。
- Research Trail 详情页显示 sources、summary、open questions、receipt。
- 不做自动后台大规模聚类。

### P1：场景内继续提示

- Memory Lens / Web Intelligence 在相关页面显示 `继续研究` chip。
- Compose Assist 支持 `research_patch`。
- Ask 优先返回 research trail summary。
- 支持 source stale / dismissed / inaccessible receipt。

### P2：自动合成和决策快照

- 高信号来源自动形成 candidate trail，用户一次确认后进入 active。
- 支持 decision snapshot：把当前研究结论保存成一个可回放状态。
- 可把 open question 转成 Evidence Watch Contract。

### P3：跨工具研究流

- Desktop App explorer 把 ChatGPT/豆包/Codex session summary 作为 source ref。
- AI Context Passport 可引用 research trail。
- Storyline Builder 可把 research trail 转成对外汇报/培训 outline。

## 风险和缓解

| 风险 | 缓解 |
|---|---|
| 变成又一个 dashboard | 入口只在 source detail、浏览 chip、Ask/Compose 中出现；列表页只是复核，不要求日常维护 |
| 自动聚类误合并 | P0 只做手动/半自动；自动聚类必须显示候选来源和排除理由 |
| LLM 合成编造结论 | synthesis 必须逐条绑定 source refs；无证据只能写 open question |
| 隐私外发风险 | 默认 local-only；导出走 redaction/export contract；mixed scope 禁止一键外发 |
| 与 Source Memory Distiller 重叠 | Distiller 继续处理单 source；Research Trail 只处理多 source、多天、多场景研究任务 |
| 与 Operation Flight Recorder 重叠 | 不记录完整操作步骤，不生成可执行 workflow；只保留研究问题和证据判断 |
| 用户负担过重 | 所有建议可忽略；默认不创建 review queue；反馈来自自然操作：采用/排除/复制/导出 |

## 完成后的 docs/features 维护

如果后续实现，应在最后把关键逻辑精简维护进正式功能文档：

- `docs/features/memory_capture.md`：补 source memory 如何加入 research trail。
- `docs/features/memory_system.md`：补 `research_trail` source type、召回和 Ask/Compose 集成。
- `docs/features/compose_assist.md`：补 `research_patch` 类型和不自动发送边界。
- 如果 Research Trail 有独立路由和 API，新增 `docs/features/research_trails.md`，并在 `docs/features/index.md` 新增小功能点。

完成后，如果 `docs/progressing/research-trail-synthesizer-plan.md` 的内容已迁入正式文档，应删除或标记为已迁移，避免 progressing 和 features 双真源。

## 开放问题

1. P0 是否允许系统自动创建 candidate trail，还是只能由用户在 source-memory 详情页手动创建？
2. research trail 的默认时间窗口是 72 小时、7 天，还是按 topic 持续到用户归档？
3. `currentConclusionStrength=strong` 是否需要用户显式确认，还是 source coverage 足够时可自动给 strong？
4. 是否需要把 research trail 暴露给 MCP clients，还是先只服务 Ask / Compose / Memory Exploring？
5. source 被 dismiss 后，trail 是否保留历史引用，还是从当前 synthesis 完全移除？

## 建议

建议推进到下一步设计评审。

它解决的是 Personal AI 愿景里很核心但目前缺位的一层：用户不只是要“记住看过什么”，还要让系统记住“我研究一个问题时如何形成判断”。这个能力可以从现有 Memory Capture / Source Memory Distiller / Ask / Compose Assist 很窄地切入，不需要一开始做全局 agent 或跨 AI 聚合，也避开了已搁置的 AI Tool Compass 和 Memory Trust Console。
