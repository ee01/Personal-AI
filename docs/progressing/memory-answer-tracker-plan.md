# 新能力：Answer Memory Tracker / 活答案记忆

> 生成日期：2026-05-29 CST
> 建议 Codex 会话标题：`新能力：活答案记忆`
> Demo：[`memory-answer-tracker-demo.html`](./memory-answer-tracker-demo.html)

## 结论

这次没有从 Reminders 选题：本机 Reminders 当前可见列表里没有 `Personal AI` 清单，因此没有可随机选择的新功能 idea，也没有需要标记 done 的 Reminder item。

建议设计一个新能力：**Answer Memory Tracker / 活答案记忆**。

一句话：

> Personal AI 不只记住资料和消息，也记住用户反复追问的“当前答案”：这个问题上次怎么答、依据是什么、哪里不确定、什么新证据会让答案改变、现在还值不值得重新查。

它要解决的真实问题不是“搜不到一条记忆”，而是：

- 用户经常围绕同一个工作流反复问短问题，例如“那个 BE ready 了吗？”、“AI VBG 的 BE 部分完成情况如何？”。
- 系统每次都重新召回、重新总结、重新发起外部查证，导致 pending confirm requests / proposed actions 重复堆积。
- 用户真正需要的是一个**可持续维护的答案状态**：当前结论、置信度、证据版本、待核实缺口和下一次怎么更新。

MVP 不做新的大型页面。它优先嵌入：

1. `/ask`：用户问到已追踪问题时，答案顶部出现“活答案卡”。
2. Context Recall / Memory Lens：当前线程命中该问题时，只显示轻量状态卡。
3. Today Pilot / Action Queue：只有当活答案过期或缺口影响今天事项时，才生成一张具体 follow-up。

## 为什么值得做

Personal AI 的目标是保存用户和 AI、网页、会议、消息、操作、偏好、skill 等全部记忆，并在真实场景里做关联提示。现在系统已经能保存很多原始信息，也有 Ask、Context Recall、Memory Lens、Today Pilot、Project Dashboard、Decision Center、Action Queue、Memory Relevance Trainer、Ask/Recall Memory Context Match 等方向。

但真实使用里还有一个空位：**用户关注的问题本身也应该成为记忆对象**。

现在 Personal AI 主要在记：

- 原始事件：消息、会议、网页、Jira、AI 对话。
- 派生对象：人物、项目、topic、source memory、mission、context pack。
- 用户偏好与 skill。

还没有稳定记：

- 用户最近一直在追问什么问题。
- 每个问题当前最可信答案是什么。
- 上次回答后是否出现新证据。
- 哪些缺口已经查过但无法完成。
- 同类外部查证和确认请求是否应合并。

这会导致一个很典型的体验落差：

> 用户问“那个 BE ready 了吗？”时，真正想要的是“你上次说还没 ready，现在有没有新证据改变这个答案？”
> 但系统往往像第一次听到这个问题一样重新检索。

## 本次输入信号

### Reminders 检查

Apple Reminders 当前可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。未发现 `Personal AI` 列表。

因此本方案来自项目目标、真实记忆查询、`docs/progressing` 去重和行业研究。

### 真实记忆信号

只读查询 `10.32.56.212` 上 `esone.qiu` 的 Memory Service：

- `/api/v1/stats` 可读：约 10083 条 messages、13768 个 entities、7367 个 chunks、50197 条 relationships。
- 当前 confirm requests：`pending=50`，其中有多条重复围绕 `BE ready` / `AI VBG BE` / 外部查证。
- `messages_raw` 来源分布：`glip 8773`、`web 446`、`meeting 373`、`system 246`、`calendar 210`、`jira 24`、`outreach 11`。
- `source_memory_capsules` 已有 447 条，绝大多数来自网页；说明捕获能力已经变强，下一步更需要把“捕获的信息如何回答持续问题”变稳。
- `today_meeting_preps` 已有 73 条 nightly 生成记录；说明系统已经会做每日/会前派生，但不应把每个长期问题都塞进 Day Pilot。

观察到的具体信号：

- 多条 pending confirm requests 都在试图确认 `BE` 状态，从“waiting for new design, not ready”变化成多个近似表达。
- 多条 proposed actions 都是“外部查证: 那个 BE ready 了吗？”或“AI VBG 的 BE 部分完成情况如何？”，说明系统在重复追踪同一个信息需求。
- 近期工作记忆集中在 Nova / AI VBG / WhatsApp product discussion / Channel Adapter / Jira AI writeback / Story Points estimation / Q planning / Meeting Pilot 等场景。
- 用户日常偏好是让 AI 先跑一遍、再由用户复核；因此系统应该减少重复劳动，但不能把不确定答案伪装成确定事实。

## 和现有 progressing / features 的边界

| 已有方向 | 解决什么 | 本方案边界 |
| --- | --- | --- |
| Ask/Recall Memory Context Match | 短问题先锁定当前话题，例如“那个 BE”指哪件事 | 活答案记忆接在话题锁定之后，管理“这个问题的当前答案和版本” |
| Memory Relevance Trainer | 用户反馈某条召回不相关后，训练排序/过滤 | 活答案记忆管理重复问题，不直接调 recall 权重 |
| Decision Time Machine | 回放历史决策为什么形成 | 活答案是当前可用答案，不是决策史；只在用户问“为什么当时这么定”时让位给 Decision Evidence Chain |
| Project Dashboard | 本地项目任务、ETA、风险、证据覆盖 | 活答案不要求用户手动建项目，也不维护完整项目计划 |
| Today Pilot | 今天 3-7 个具体 mission | 活答案默认不占用今日列表，只有过期/缺口影响今天时才生成 mission |
| Memory Freshness Radar | 资料或网页变化影响旧记忆 | 活答案只追踪被用户反复问过的问题；来源变化可作为它的更新信号 |
| Memory Reality Check（搁置） | 校验 AI 输出/草稿中的 claims | 活答案不是通用事实审核器，只管用户持续关注的问题 |
| Memory Trust Console（搁置） | 全局记忆治理控制台 | 活答案不是治理台，不做全库质量审查 |
| Artifact Memory Lineage（搁置） | 成果物来源链 | 活答案可以引用成果物，但不维护成果物血缘 |
| Action Queue / proposed_actions | 待执行动作 | 活答案会合并重复查证动作，减少 Action Queue 噪音 |

## 行业和研究参考

### 产品趋势

- [ChatGPT Memory sources](https://help.openai.com/en/articles/6825453-dall-e-3-beta)：OpenAI 在 2026-05-05 发布 memory sources，让用户看到哪些 past chats、saved memories、files、connected app 信息影响了个性化回答，并可标记不相关。这说明“答案必须能追溯到记忆来源”已经成为主流产品要求。
- [Claude Managed Agents memory](https://claude.com/blog/claude-managed-agents-memory)：Anthropic 2026-04-23 发布 managed agents memory，强调跨 session 学习、文件式 memory、API 管理、审计日志和 rollback。这对 Personal AI 的启发是：答案状态也需要版本、来源和回滚，而不是只写一条 summary。
- [NotebookLM](https://notebooklm.google/)：Google 的 source-grounded AI notebook 强调围绕用户提供的 sources 成为“personalized AI expert”。它擅长“给定资料里的问答”，但 Personal AI 的差异是跨消息、会议、Jira、网页、AI 对话持续维护答案。
- [Granola API / MCP direction](https://techcrunch.com/2026/03/25/granola-raises-125m-hits-1-5b-valuation-as-it-expands-from-meeting-notetaker-to-enterprise-ai-app/)：Granola 从会议笔记扩展到企业 AI context layer 和 API，说明会议记录本身会商品化，真正价值在于把记录接入后续工作流。
- [Claude context engineering cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)：Anthropic 把 memory、compaction、tool clearing 放在 context engineering 下讨论，并指出长上下文会带来 context rot。活答案记忆的思路是把常问问题压成“可继续推理的状态”，避免每次塞入大量旧上下文。

### 论文和专家方向

- [Human-Agent Co-Construction of Episodic Memories](https://journals.sagepub.com/doi/10.3233/FAIA250640)：强调人和 agent 对同一事件的记忆可能 overlap、complement 或 conflict，需要互动式共同构建。活答案卡正好把“系统证据”和“用户补充/纠正”并列为 answer version。
- [Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670)：把 agent memory 形式化为 write-manage-read loop，并把 contradiction handling、latency budget、privacy governance 列为工程现实。活答案就是在 write/manage/read 之间补一个用户问题级的状态对象。
- [EvoMemBench](https://arxiv.org/abs/2605.18421)：2026-05 的 benchmark 结论指出，没有一种 memory 形式在所有设置都稳定有效；memory 在当前 context 不足、任务更难时帮助最大。活答案不试图替代全部 recall，只为重复问题提供结构化状态。
- [Memento, Microsoft Research](https://www.microsoft.com/en-us/research/articles/memento-teaching-llms-to-manage-their-own-context/)：Memento 将长推理过程压缩成后续推理可继续使用的紧凑状态。活答案借鉴这个思想，把长时间、多来源、反复追问压成“当前答案 + 缺口 + 改变条件”。
- [An Automatic Method to Estimate Correctness of RAG](https://aclanthology.org/2025.coling-industry.52/)：RAG 场景不只要输出，还要对生成过程和不确定性有信心评估。活答案卡应该展示 confidence、evidence coverage、missing verification，而不是只给自然语言结论。
- [Meta-Information in Conversational Search](https://ouci.dntb.gov.ua/en/works/4z1XaX17/)：信息需求、偏好、结果质量等 meta-information 是会话搜索的一部分。活答案把“用户为什么问这个、上次是否满意、是否仍需追踪”作为一等信息。

## 产品定义

### 功能名

**Answer Memory Tracker / 活答案记忆**

中文也可以叫：

- 活答案记忆
- 持续答案卡
- 问题记忆
- 追问状态卡

推荐使用 **活答案记忆**，因为它表达的是“答案会随着证据变化而活着”，不是普通 FAQ。

### 目标用户

第一目标用户就是当前 Personal AI 用户：

- 高频使用 RingCentral / Jira / Google Docs / AI 工具 / 会议。
- 经常用短问句恢复上下文。
- 需要让 AI 先跑一遍，但仍希望自己最后复核。
- 不想每天维护一个新后台。

### 核心对象

```ts
interface AnswerMemoryThread {
  id: string;
  userId: string;
  canonicalQuestion: string;
  aliases: string[];
  topicFrameId?: string;
  currentAnswer: AnswerMemoryVersion;
  status:
    | 'active'
    | 'needs_verification'
    | 'stale'
    | 'resolved'
    | 'muted';
  confidence: number;
  evidenceCoverage: 'strong' | 'partial' | 'weak' | 'missing';
  lastAskedAt: number;
  lastVerifiedAt?: number;
  validUntil?: number;
  changeConditions: string[];
  unknowns: string[];
  nextBestAction?: AnswerNextAction;
  sourceHash: string;
  createdAt: number;
  updatedAt: number;
}

interface AnswerMemoryVersion {
  id: string;
  threadId: string;
  answerMd: string;
  answerType:
    | 'status'
    | 'owner_eta'
    | 'decision_status'
    | 'fact_check'
    | 'how_to'
    | 'open_question';
  stance: 'yes' | 'no' | 'partial' | 'unknown' | 'mixed';
  evidenceRefs: AnswerEvidenceRef[];
  contradictingRefs: AnswerEvidenceRef[];
  missingEvidence: string[];
  generatedFrom: {
    query: string;
    surface: 'ask' | 'context_recall' | 'memory_lens' | 'today_pilot' | 'manual';
    contextMatch?: unknown;
    recallRunId?: string;
  };
  answerHash: string;
  createdAt: number;
}
```

### 用户可见形态

#### 1. Ask 顶部活答案卡

当用户问：

> 那个 BE ready 了吗？

系统先通过 Ask/Recall Memory Context Match 锁定话题，再检查是否已有 answer memory thread。

如果命中，答案顶部显示：

- `你最近问过这个问题 9 次`
- 当前活答案：`还没有看到 ready 的可靠证据；最新证据仍指向等待 RCV BE 新 design`
- 上次更新时间：`2026-05-28 17:34`
- 置信度：`0.72 / 部分证据`
- 缺口：`缺少 David/April 或 Jira 状态的明确确认`
- 改变条件：`出现 Jira status=Ready、owner 明确回复 ready、BE design doc 更新`
- 操作：`继续查证`、`补充证据`、`别再追踪`、`查看版本`

这张卡不是替代完整回答，而是让用户先知道“系统已经把这件事作为持续问题处理”。

#### 2. RingCentral / Jira / Memory Lens 轻量状态卡

在用户打开相关 thread 或 Jira 时，Memory Lens 不弹出大卡片，只在侧边或底部显示一条：

> AI VBG BE：当前未 ready，等待新 design。证据 4 条，缺明确 ETA。

点击后展开证据和版本。

#### 3. Today Pilot 只接收需要行动的活答案

活答案不应该变成每日噪音。只有满足以下条件才进入 Today Pilot：

- 有今天相关会议/消息/thread。
- answer status 是 `needs_verification` 或 `stale`。
- 缺口有明确 owner 或查证路径。
- 该答案影响今天回复、会议或 Jira 更新。

卡片标题应是具体动作：

> 核实 AI VBG BE 是否已 ready，再回复 David

而不是：

> AI VBG BE 状态

#### 4. Action Queue 合并重复查证

如果同一活答案已经有一个 pending verification action，新触发的“继续外部查证”不再创建新 action，而是：

- 追加到 `answer_memory_thread.openVerificationId`
- 更新 `lastRequestedAt`
- 累计 `requestedBySurfaces`
- 在 Action Queue 显示“被 7 次追问合并”

这样直接减少当前看到的 pending action 重复堆积。

## 关键体验原则

### 1. 默认不要求用户整理

用户照常问问题。系统在后台判断：

- 是否是重复问题。
- 是否应该创建活答案。
- 是否已有旧答案可复用。
- 是否需要更新。

用户只在以下情况下参与：

- 系统答案明显错了。
- 用户有新证据要补。
- 系统准备把缺口变成外部查证 action。
- 用户想停止追踪。

### 2. 折叠态也要有用

折叠态必须直接说：

- 当前结论。
- 置信度/新鲜度。
- 最大缺口。

不要只显示“已找到活答案”。

### 3. 不把未知说成确定

常见答案可能是：

- `未 ready`
- `部分 ready`
- `没有新证据改变上次结论`
- `缺权威证据，不能判断`
- `有冲突：会议里说 A，Jira 里显示 B`

`unknown` 是可接受答案，不能因为用户反复问就编一个确定结论。

### 4. 记录“什么会改变答案”

活答案最有价值的不是 summary，而是 change conditions：

- 哪个 Jira 字段变了。
- 哪个 owner 回复了。
- 哪个设计文档更新了。
- 哪个 meeting prep 里出现新决策。

这样后续 Freshness Radar、Source Memory、Jira sync、Meeting Pilot 都能主动判断是否需要刷新答案。

### 5. 不做问题管理后台

P0 不做单独 `Answer Memory` 页面。最多在 Ask 的诊断 drawer 或 Memory Exploring 中提供“查看版本”入口。

原因：用户已经明确不喜欢为校准/治理每天打开新平台。这个能力应该是嵌入式、低打扰、自动收敛的。

## MVP 流程

### P0：Ask-time 活答案卡

触发入口：

1. `/api/v1/ask`
2. `/api/v1/context-recall`

流程：

1. 对 query 做 `MemoryContextMatchService`。
2. 生成 `answerIntent`：
   - status question
   - owner / ETA question
   - decision status
   - fact follow-up
   - how-to reuse
3. 用 `canonicalQuestion + topicFrame + intent` 查找 existing thread。
4. 如果命中：
   - 检查是否有新 evidence hash。
   - 如果无新证据，返回 currentAnswer + freshness note。
   - 如果有新证据，生成新 version diff。
5. 如果未命中但 query 重复或 high-value：
   - 先正常回答。
   - 当用户追问、复制、反馈 useful、或同类问题第二次出现时创建 thread。
6. Ask UI 渲染 `answerMemoryCard`。

P0 不需要后台主动抓取所有问题。只在用户真正问过的问题上建立状态。

### P1：重复 action / confirm request 合并

新增：

- `answer_memory_verification_requests`
- `openVerificationId`
- proposed_actions dedupe key: `answer_thread:<id>:verification`
- confirm_requests dedupe key: `answer_thread:<id>:property_update`

行为：

- 同一 thread 的查证只保留一个 open request。
- 新证据只追加到 thread，不新建平行 action。
- Action Queue 展示“合并了 N 次追问 / N 个来源”。

### P2：Source / Jira / Meeting 更新触发刷新

当以下事件发生时，后台只更新相关活答案：

- source memory capsule 新增或更新。
- Jira comment / field source 被捕获。
- meeting summary 里出现相关 topic + decision/status。
- RingCentral thread 出现 owner 回复。
- Memory Freshness Radar 标记相关 source changed。

刷新不是立即打扰用户，而是：

- 更新 `status=active` 或 `stale`。
- 如果影响今天，交给 Today Pilot。
- 如果冲突严重，生成一条 Decision Center / confirm request。

### P3：跨 AI / Context Passport 消费

当用户要把上下文带到 Codex / ChatGPT / Claude / 豆包时，Context Passport 可以包含：

- 当前活答案。
- 不确定性。
- 不要让目标 AI 重做的部分。
- 需要目标 AI 帮忙查/写/分析的缺口。

这比把几十条原始消息贴给外部 AI 更清晰。

## 数据模型建议

### 新表

```sql
create table answer_memory_threads (
  id text primary key,
  user_id text not null,
  canonical_question text not null,
  aliases_json text not null default '[]',
  topic_frame_id text,
  intent text not null,
  status text not null default 'active',
  confidence real not null default 0,
  evidence_coverage text not null default 'weak',
  current_version_id text,
  open_verification_id text,
  last_asked_at integer not null,
  last_verified_at integer,
  valid_until integer,
  unknowns_json text not null default '[]',
  change_conditions_json text not null default '[]',
  next_best_action_json text not null default '{}',
  source_hash text not null,
  created_at integer not null,
  updated_at integer not null
);

create index idx_answer_memory_threads_user_updated
  on answer_memory_threads(user_id, updated_at desc);

create index idx_answer_memory_threads_topic_intent
  on answer_memory_threads(user_id, topic_frame_id, intent);

create table answer_memory_versions (
  id text primary key,
  thread_id text not null,
  answer_md text not null,
  stance text not null,
  confidence real not null default 0,
  evidence_refs_json text not null default '[]',
  contradicting_refs_json text not null default '[]',
  missing_evidence_json text not null default '[]',
  generated_from_json text not null default '{}',
  answer_hash text not null,
  created_at integer not null,
  foreign key(thread_id) references answer_memory_threads(id)
);

create table answer_memory_events (
  id text primary key,
  thread_id text not null,
  event_type text not null,
  payload_json text not null default '{}',
  surface text,
  created_at integer not null,
  foreign key(thread_id) references answer_memory_threads(id)
);
```

### 与现有表的关系

- `conversation_context_frames`：负责识别当前话题。
- `memory_feedback_events` / `ambient_calibration_traces`：记录用户是否接受这个 answer card。
- `confirm_requests`：只用于需要用户确认的属性变化，不再为同一问题创建重复候选。
- `proposed_actions`：只用于真正需要外部查证的下一步。
- `day_missions`：只引用需要今天处理的 thread。

## API 建议

### Ask 返回扩展

```ts
interface AskResponse {
  answer: string;
  contextMatch?: MemoryContextMatchResult;
  answerMemory?: {
    threadId: string;
    state: 'hit' | 'created' | 'updated' | 'not_tracked';
    card: AnswerMemoryCard;
  };
}
```

### 新接口

```http
GET /api/v1/answer-memory/:threadId
POST /api/v1/answer-memory/:threadId/feedback
POST /api/v1/answer-memory/:threadId/refresh
POST /api/v1/answer-memory/:threadId/mute
POST /api/v1/answer-memory/:threadId/evidence
```

### 反馈动作

- `still_true`
- `outdated`
- `wrong_topic`
- `add_evidence`
- `stop_tracking`
- `verify_now`

## UI 设计

### Ask 活答案卡结构

1. 顶部状态条：
   - `活答案`
   - `上次问过 9 次`
   - `部分证据`
   - `5 小时前更新`
2. 当前答案：
   - 一句话结论。
   - 关键缺口。
3. 证据条：
   - 3 条最关键证据。
   - 每条显示 source type、时间、原文摘录、为什么支持/冲突。
4. 改变条件：
   - 明确列出“什么会让答案改变”。
5. 操作：
   - `继续查证`
   - `补充证据`
   - `不再追踪`
   - `查看版本`

### RingCentral / Jira 集成态

用轻量卡，不要大弹窗：

- 当前线程右下角或 Lens popover 中一行状态。
- 点击才展开。
- 如果当前输入框聚焦，Compose Assist 可以读取该活答案，但插入建议仍由 Compose Assist 负责。

### Today Pilot 集成态

只有在答案过期并影响今天时出现：

- 标题是动作。
- 展开显示活答案当前状态和缺口。
- 按钮跳转 Ask / Action Queue / source。

## 真实使用场景

### 场景 1：用户反复问 AI VBG BE 状态

1. 用户在 Ask 输入：“那个 BE ready 了吗？”
2. Personal AI 先锁定到 `AI VBG / RCV BE design`。
3. 系统发现已有活答案 thread。
4. 顶部显示：
   - 当前结论：`未看到 ready 证据，最近证据仍是等待 RCV BE 新 design。`
   - 缺口：`缺少 owner 明确 ETA / Jira 状态确认。`
   - 上次问过：`9 次。`
5. 如果用户点 `继续查证`，系统只更新同一个 verification action，不再新建第 10 条外部查证。
6. 第二天如果 Jira comment 或会议里出现 “BE is ready”，活答案生成新 version，并在 Ask/Today Pilot 提醒“答案已改变”。

用户体验亮点：

- 不需要重新解释 BE 是哪件事。
- 不需要看一堆重复 pending request。
- 知道当前答案为什么不是确定结论。

### 场景 2：会议前看某个长期 open question

1. 用户打开 `Review JVD + Webinar 近期计划` 会议准备。
2. Today Pilot 发现相关活答案：`WhatsApp / Channel Adapter requirements 是否已定稿？`
3. 活答案显示：
   - 当前结论：`PoC 方向已有，但 Q2 scope 仍需 David finalize。`
   - 关键证据：RingCentral 消息中 Esone 请求 David consolidate requirements。
   - 建议会中问题：`David 是否已整理 requirements，并能否本周 share to team？`
4. Meeting Pilot Handoff 把这个问题作为 cue card 带入会议。

用户体验亮点：

- 会前看到的是“还没闭环的问题”，不是泛泛会议摘要。
- 会议里可以直接追问，不需要翻历史消息。

## 竞品对比

| 产品 / 方向 | 类似点 | Personal AI 差异 |
| --- | --- | --- |
| ChatGPT Memory Sources | 显示影响回答的 memory/source | 活答案追踪一个持续问题的答案版本、缺口和改变条件 |
| Claude Managed Agents Memory | 记住跨 session 学到的东西，有 audit / rollback | Personal AI 面向个人工作流和真实证据，不只面向 agent 执行经验 |
| NotebookLM | 围绕用户 sources 回答问题 | 活答案跨会议、消息、Jira、网页和 AI 对话，不局限一个 notebook |
| Granola | 把会议记录接入 AI workflows | 活答案把会议记录转成长期问题状态，而不是只问 transcript |
| Moss / Supermemory | 跨工具统一记忆 | 活答案更窄：专注用户重复追问和当前答案有效性 |
| Project Dashboard | 项目状态/风险/计划 | 活答案不要求项目建模完整，适合“我只是想知道这个问题现在答案是什么” |

## 成功指标

### 产品指标

- 重复 Ask 问题命中率：同一 topic+intent 的问题能命中旧 thread。
- 重复 proposed_actions 降低：同一问题不会产生多条 open external verification。
- 用户二次追问成本：用户不再需要补充“我说的是哪个 BE”。
- `unknown` 可接受率：用户能接受“还缺证据”的答案，而不是觉得系统没用。
- 版本更新有用率：有新证据时，用户能看懂答案为什么改变。

### 质量指标

- answer grounding：每个活答案至少有 evidence refs。
- staleness detection：来源变化后不会继续展示旧结论为 current。
- contradiction handling：冲突证据显示出来，不被 summary 吞掉。
- topic precision：wrong topic feedback 后不再把同一短问句锁到错误 thread。

## 验证 / Eval 计划

新增体验 eval suite：`answer-memory-tracker`

Case 类型：

1. 重复状态问题：
   - query1: `那个 BE ready 了吗？`
   - query2: `AI VBG 的 BE 部分完成情况如何？`
   - 期望：同一 answer thread，不重复 action。
2. 新证据改变答案：
   - old evidence: waiting for new design
   - new evidence: owner says BE ready
   - 期望：新 version，显示 diff 和 changed reason。
3. 缺权威证据：
   - evidence 只有聊天猜测，没有 Jira/owner
   - 期望：stance unknown/partial，不生成确定 ready。
4. 错误话题反馈：
   - 用户点 wrong topic
   - 期望：下次同 query 提示候选或换 topic。
5. Today Pilot 降噪：
   - 活答案 active 且无今日影响
   - 期望：不进 mission。
   - stale 且今日会议相关
   - 期望：生成具体 follow-up mission。

推荐验证：

- `npm --prefix memory-service test -- --run answerMemoryTracker.test.ts api-ask.test.ts`
- `npm --prefix memory-service run build`
- `npm start` 首次 webpack compile
- 新增 `tools/verify-answer-memory-tracker-e2e.mjs`
- `npm run eval:validate`
- `npm run eval:run -- --suite answer-memory-tracker --no-repair`

## 风险和约束

### 风险 1：问题卡爆炸

不能每个 Ask 都创建 thread。

控制策略：

- 只有重复出现、用户反馈 useful、或被 Today Pilot / Action Queue 引用的问题才创建。
- 低价值 FYI / 一次性查询不创建。
- thread 默认有 `valid_until` 或自然衰减。

### 风险 2：错误答案被强化

如果一开始 answer version 错了，后续可能持续影响用户。

控制策略：

- 折叠态必须显示 confidence / evidence coverage。
- wrong/outdated feedback 立即降权或 stale。
- 冲突证据不能被隐藏。
- 无权威证据时 stance 必须是 `unknown` 或 `partial`。

### 风险 3：过度打扰

长期问题很多，不能天天提醒。

控制策略：

- 不默认进入 Today Pilot。
- 只有 meeting/date/source change/owner reply 触发。
- 用户可 `stop_tracking`。

### 风险 4：和 Project Dashboard 重叠

项目仪表盘已经做项目状态。

边界：

- 活答案是 query-driven，不要求项目完整建模。
- 如果用户把活答案提升为项目任务，可以把 `nextBestAction` 链到 Project Dashboard。

## 实施建议

### 第一阶段：Plan to Prototype

不动现有 runtime，先补：

- 本方案文档。
- 静态 demo。
- 1-2 个基于真实但脱敏的 eval case 草案。

### 第二阶段：P0 后端

新增：

- `AnswerMemoryService`
- `AnswerMemoryRepository`
- `answer_memory_*` migration
- Ask response extension
- context-recall response extension

优先复用：

- `MemoryContextMatchService`
- `RecallEngine`
- `memory_feedback_events`
- `proposed_actions` dedupe

### 第三阶段：P0 前端

新增：

- Ask answer memory card component。
- Memory Lens compact card。
- Ask detail drawer 中的 version/evidence panel。

不做：

- 独立页面。
- 大型管理后台。
- 自动外发。

### 第四阶段：P1 去重和 Today Pilot

- proposed_actions 合并。
- confirm_requests 合并。
- Today Pilot 只消费 stale/needs_verification thread。

### 第五阶段：体验 eval

这个功能的价值依赖判断质量，不能只靠单元测试。应新增 eval，并用真实脱敏问题覆盖：

- BE readiness。
- Jira AI writeback 是否完成。
- 某个 meeting follow-up 是否已闭环。
- 某个 AI tool quota / policy 是否还有新变化。

## 最小可用版本

最小可用版本只需要做到：

1. 同一短问题第二次出现时，Ask 顶部能显示上次答案。
2. 卡片列出证据、缺口和上次更新时间。
3. 用户可以点 `过期了` / `不是这个问题`。
4. 同一问题不会产生重复 external verification action。

如果只做到这四点，已经能明显改善当前真实数据里的重复查证和短问句恢复体验。

## 本轮不实现的内容

本轮只生成 plan 和 demo，不实现 runtime，不改 API，不改数据库，不运行编译。
