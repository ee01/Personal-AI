# 新能力：Keystone Memory Briefs / 关键记忆简报

> 生成时间：2026-06-24 CST
> Codex 会话标题：新能力：关键记忆简报
> Demo：[`keystone-memory-briefs-demo.html`](./keystone-memory-briefs-demo.html)

## 真实场景 1：打开 Glip 线程时，不再重新翻半个月上下文

用户在 RingCentral / Glip 里看到一条关于 WhatsApp 集成的新消息：

> Gary 提醒：先不要重新设计，WhatsApp 本质上可以复用 SMS 基础设施，RingCX 已经有数字渠道集成。

现在的体验通常是：

1. 用户知道这条消息重要，但上下文分散在之前的群消息、Jira、source-memory、AI 分析 chunk 和人名关系里。
2. Memory Lens 可以提示几条相关记忆，但用户还要自己判断哪条是项目背景、哪条是行动建议、哪条只是一次性聊天。
3. 如果用户要问 Codex / Claude / ChatGPT，仍然需要手动拼出“目标、已有结论、可复用资产、要找的人、不能做什么”。

有关键记忆简报之后：

1. 用户打开这条 Glip thread，右侧 Personal AI 面板显示一个小 chip：`关键简报 · WhatsApp 集成复用路径`。
2. 展开后不是搜索结果列表，而是一份 6 行内可扫读 brief：
   - 当前结论：先调研 RingCX WhatsApp 与 SMS 基础设施，不急着画新架构。
   - 已知证据：Gary / Steve 的消息、Ahmed 的文档线索、Chintamani / SMS team 路径。
   - 需要避免：重复造轮子、直接新设计、把 PM 未对齐当成已确认事实。
   - 下一步：找 Ahmed 看现有视频/文档；找 Chintamani 对接 SMS 团队。
3. 每一行都有来源按钮；来源可能跳 `timeline`、`source-memory` 或 Jira，不把内部原文直接外发。
4. 用户点 `给 Ask 用`，只把这份 brief 的脱敏摘要写入当前 Ask 草稿，回执显示：`已写入本机草稿，未发送，未创建任务，未修改事实`。

用户感受：Personal AI 不是又给一堆相关记忆，而是把“这件事我现在最该记住什么”整理成一个可以马上用的工作简报。

## 真实场景 2：Jira estimate 讨论前，系统先给出稳定口径和易错点

用户准备处理一组 Task Estimate / Q3 planning 相关 ticket。真实记忆里已经有：

- `Task Estimate currently evaluates based on Jira ticket team field / Summary / Description / Issue type / Historical Story Points benchmark`
- `只写回 Sheet，没有回写 Jira`
- 多条关于 estimate 原值、DEV Estimate Original、人天 / Story Points 口径、Jira field 限制和 Google Sheet 写回边界的历史讨论。

有关键记忆简报之后：

1. 用户打开 Jira issue 或 Ask 里输入 `estimate 这些 ticket`。
2. Personal AI 不直接改 prompt，也不弹新页面；只在旁边出现 `关键简报 · Task Estimate 口径`。
3. 展开后显示：
   - 稳定口径：team field 选择 benchmark；Summary / Description / Issue type 进入判断。
   - 写回边界：AI Service 只写 Sheet，不自动写 Jira。
   - 易错点：DEV Estimate Original 曾出现 0.3 / 0.4 变动，必须显示 source-as-of。
   - 验证方式：抽样 3 个 ticket 对照历史 Story Points，并输出无法判断原因。
4. 用户可以复制为 prompt context、打开证据、隐藏本 brief。本次任何操作都只写 outcome / visibility event，不改 profile、不确认事实、不发外部消息。

Before：用户靠记忆补口径，外部 AI 第一轮容易漏掉写回边界或字段来源。
After：用户看到的是一份可来源化、可复制、带 freshness 的关键口径 brief，减少重复解释和误写风险。

## 结论

建议设计新能力：**Keystone Memory Briefs / 关键记忆简报**。

它是一个跨来源的高信号工作记忆提取层：当 Personal AI 发现某个工作对象、主题、项目、Jira、会议或 AI 工具经验在多条记忆里反复出现，并且未来仍会被使用时，自动整理成一份可来源化、可复用、可降噪的 `KeystoneBrief`。

一句话价值：

> 把杂乱的消息、会议、Jira、AI 对话和资料记忆，压缩成“下次遇到这件事时我真正该记住什么”的可用简报。

推荐 P0 做嵌入式能力，不新增独立后台：

- 在 Glip / Jira / Ask / Memory Lens / Source Memory detail 等现有 surface 里显示 `关键简报` chip。
- 默认只展示 ready brief；候选 brief 在后台生成，不创建用户 review queue。
- 用户可打开证据、复制脱敏 brief、隐藏本 brief、标记不准；不做外部发送、不写 confirmed profile、不创建任务。

## Idea 来源

本次没有使用 Reminder 选题。本机 Reminders 可读，列表为 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`，没有名为 `Personal AI` 的列表，因此没有可随机选择的新功能 idea，也没有需要标记 done 或写备注的 Reminder item。

本方案来自：

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- `docs/progressing/` 去重。
- automation-2 近期记忆里记录的产品优先级：当前应更关注重要记忆提取、蒸馏、去噪和消费准确度，而不是密码分类或新的 review queue。
- `10.32.56.212` 上 `esone.qiu` 的当前只读 memory-service 信号。
- 2025-2026 年 AI memory / context engineering / meeting memory / long-term memory benchmark 的产品和研究趋势。

## 真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu`：

- `GET /health` 可达，但返回 `degraded`，全局 database connected 为 false。
- `GET /api/v1/stats` with `X-User-Id: esone.qiu` 可读，返回：
  - `messages.total = 10751`
  - `messages.today = 106`
  - `messages.thisWeek = 551`
  - `chunks.total = 9216`
  - `relationships.total = 50565`
  - `confirmRequests.pending = 28`
  - memory retrieval tiers：`active = 840`、`archive_only = 7238`、`forgotten = 4055`、`weak = 951`
- `GET /api/v1/reflection-threads?status=active&limit=12` 返回 active total `705`，样本里大量 fact-following thread 已反思 140-159 次，常见 `continueReason = waiting_for_delegation` 或 `waiting_for_confirm_request`。
- `GET /api/v1/actions?queueStatus=queued&limit=12` 返回 queued total `58`，样本主要是 `delegate_openclaw` 外部核实，围绕 Jira ticket、availability、version、Codex status 等事实持续追问。
- `GET /api/v1/confirm-requests?queue=all&state=pending&limit=12` 本轮 15 秒内超时；计划不假装读到了 confirm 原文。
- `POST /api/v1/recall` 查询重要记忆提取相关场景，返回 88 个候选。高分样本包括一条 WhatsApp 集成深度分析 chunk，里面已经把 Gary / Steve 的消息整理成“先调研 RingCX WhatsApp 和 SMS 团队，避免重复造轮子”的行动指南，但它仍只是普通 chunk，用户在下次场景里不一定会自然得到这份结构化 brief。

这些信号说明：

1. Personal AI 已经保存了大量工作记忆，但 `archive_only` 和 `weak` 数量很高，真正进入当前场景的高信号内容需要更好的压缩和选择。
2. Reflection / Action Queue 很会“继续追问事实是否变化”，但这不是用户每次打开工作场景时最需要的形态。
3. 用户真实痛点不是缺少另一页列表，而是缺少从多来源证据里提炼出的“可复用关键简报”。

## 为什么值得做

### 1. 直接回应“重要记忆提取准确度”这个当前优先级

最近用户已经明确否定了当前阶段做密码分类存储的必要性，并把方向拉回“重要记忆提取的准确度”。关键记忆简报正是这个问题的产品化版本：

- 不只是把网页或消息保存下来。
- 不只是把 source-memory capsule 蒸馏成 one-line cue。
- 不只是给召回结果排序。
- 而是把一组跨来源、跨时间、未来还会用到的工作记忆，整理成一个稳定、可验证、可复用的 brief。

### 2. 把“高信号记忆”从底层分数变成用户能感知的对象

当前系统有 salience、importance、Memory Lens、Source Distiller、Outcome Loop、Prompt Compiler、Today Pilot 等能力，但用户看到的多是：

- 一条提示卡。
- 一条 source-memory capsule。
- 一组搜索结果。
- 一个 prompt patch。
- 一条 action / reflection。

关键记忆简报新增的是 `KeystoneBrief` 这个中间对象：它不是原始记忆，也不是最终 prompt，而是能被多个场景消费的高信号记忆单元。

### 3. 它降低用户日常操作，而不是增加 review

P0 不做候选简报审核台。后台生成候选，只有满足证据、稳定性和未来触发门槛时才在现场展示。用户只需要在真实场景里看到、复制、隐藏或标记不准。

这符合 Personal AI 的产品 guardrail：系统应像自主反思伙伴，而不是把每个内部判断都丢给用户审。

### 4. 它能成为多个现有能力的共同输入

关键记忆简报不是替代现有能力，而是给它们更好的材料：

- Memory Lens 展示更少、更准的 brief。
- Ask 先读 brief，再决定是否深查原始证据。
- Prompt Context Compiler 可把 brief 编译进草稿。
- Today Pilot / Meeting Prep 可把 brief 作为会议前 3 行提醒。
- Active Recall Coach 可把 brief 里的稳定知识转成回忆卡。
- Skill Foundry 可从反复使用的 brief 里发现 skill seed。

## 行业产品和研究参考

### OpenAI Memory / Dreaming

[OpenAI Dreaming: Better memory for a more helpful ChatGPT](https://openai.com/index/chatgpt-memory-dreaming/) 说明 ChatGPT 正在从显式 saved memories 走向后台自动策展，会参考聊天历史自动维护更动态的用户记忆。

启发：长期记忆不可能只靠用户手动保存；后台整理是必要方向。Personal AI 的差异是要把后台整理的结果变成 source-grounded brief，并在外发、写回、profile 变更前保持边界可见。

### Anthropic Context Engineering

[Anthropic - Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 context 是有限资源，关键在选择、压缩和管理对当前任务有用的信息。

启发：关键记忆简报应追求最小高信号上下文，而不是把更多历史堆进 prompt。

### Granola / Notion AI Meeting Notes

[Granola](https://www.granola.ai/) 把会议转写变成可查询、可接入其他 AI 工具的会议记忆；[Notion AI Meeting Notes](https://www.notion.com/product/ai-meeting-notes) 会从会议转写生成 summary 和 action items。

启发：会议产品已经证明用户需要“从原始 transcript 到可用 summary”的中间层。Personal AI 的机会是跨会议、消息、Jira、网页和 AI 对话，而不是只做单场会议 notes。

### NotebookLM / Readwise

[NotebookLM](https://notebooklm.google/) 把用户提供的 sources 转成摘要、报告、flashcards 和 quizzes；[Readwise](https://readwise.io/) 把 highlights 变成复习和长期知识管理。

启发：source-backed transformation 是用户可理解的产品心智。关键记忆简报同样要显示来源，并允许用户回到原始证据。

### A-MEM

[A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) 提出为新增记忆生成结构化 note、keywords、tags，并动态建立连接，让记忆网络持续演化。

启发：Keystone brief 不应是孤立摘要，而应随着新证据加入更新已有 brief 的 slot、links 和 trigger。

### Zep / Graphiti

[Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956) 强调 temporally-aware knowledge graph 可以动态综合对话和业务数据，并提升长期企业场景的检索与时间推理。

启发：关键简报需要保留 source-as-of、changed-by、superseded-by 和 temporal validity，避免把过时结论当成永远真相。

### Response-Aware User Memory Selection

[Response-Aware User Memory Selection for LLM Personalization](https://arxiv.org/abs/2604.14473) 指出仅靠 query similarity 选记忆不够，应该判断记忆是否真正改变输出质量和不确定性。

启发：Keystone 候选不能只看相似度或出现次数，还要评估“这份 brief 会不会改变用户/AI 在当前任务里的下一步”。

### LongMemEval / LongMemEval-V2

[LongMemEval](https://arxiv.org/abs/2410.10813) 把长期记忆能力拆成信息抽取、多会话推理、时间推理、知识更新和拒答；[LongMemEval-V2](https://arxiv.org/abs/2605.12493) 更进一步关注 agent 是否能掌握环境经验、工作流知识和动态状态。

启发：实现后 eval 不能只测“召回到了某个 chunk”，还要测 brief 是否正确抽取关键事实、跨会话合成、标注 freshness、避免错误前提。

## 与已有能力和 progressing 方案的边界

| 已有能力 / 方案 | 已经解决什么 | 关键记忆简报新增什么 |
|---|---|---|
| Memory Capture / Source Memory Distiller | 单个网页、选区、视觉证据或 Jira owner comment 入库，并把 capsule 蒸馏成 source-local cue | Keystone brief 是跨消息、会议、Jira、source-memory、AI 对话的工作对象级简报，不决定是否入库，也不替代 capsule 详情 |
| Memory Lens | 当前页面被动召回相关记忆卡 | Keystone brief 给 Lens 一个更高层的可展示对象：不是 10 条相关记忆，而是 1 份多来源关键简报 |
| Prompt Context Compiler | 用户发送外部 AI prompt 前补齐缺失槽位 | Compiler 可以消费 brief 写 prompt patch；Keystone brief 发生在发送前/发送外都可用，不改写用户草稿 |
| AI Context Passport | 把当前任务上下文打包给外部 AI handoff | Passport 是完整跨 AI 交接包；Keystone brief 是可被 Passport 引用的一块高信号记忆，不等同于 handoff |
| Source Memory Distiller 已实现 P0 | 保存后整理 source-memory capsule | Keystone brief 不围绕单个资料，而围绕工作对象/主题，且必须合并普通 timeline、reflection、Jira、meeting 等证据 |
| Memory Outcome Loop | 记录 cue / draft / action 是否被采用，反向调排序 | Keystone brief 会写使用 outcome；Outcome Loop 学习它是否有用，但不负责生成 brief |
| Evidence Watch Contracts | 对会变化事实建立 verifier 和 stop condition | Keystone brief 展示 source-as-of 和 stale risk；事实持续核验交给 Watch Contracts |
| Memory Active Recall Coach | 把稳定知识转成回忆卡，让用户自己记住 | Active Recall 可从 brief 生成卡片；Keystone brief 本身是工作场景摘要，不是测验 |
| Memory Day Pilot | 日级 mission 编排 | Day Pilot 可引用今天相关 brief；Keystone brief 不是日程入口，也不排序全天任务 |
| Memory Trust Console（搁置） | 记忆可信治理后台 | Keystone brief 不建控制台，不要求用户每天处理 trust issues，只在来源不足时显示 blocked/partial |
| Memory Intake Quality Gate（搁置） | 入库前质量审查 | Keystone brief 不阻断入库；它在已有记忆之上做跨来源提炼 |
| Memory Weave Provenance Visibility | 让缝合来源可见 | Keystone brief 内置 source map，可复用 provenance UI，但新增的是 brief 对象和 extraction contract |

## 产品定义

### KeystoneBrief

`KeystoneBrief` 是一份围绕一个工作对象或主题的 source-grounded brief。

```ts
interface KeystoneBrief {
  id: string;
  userId: string;
  briefKey: string;
  title: string;
  subjectType:
    | 'project'
    | 'jira_issue'
    | 'topic'
    | 'workflow'
    | 'person_context'
    | 'decision_context'
    | 'ai_tool_experience';
  scope: 'work' | 'personal' | 'mixed_summary_only';
  status: 'candidate' | 'ready' | 'partial' | 'blocked' | 'stale' | 'hidden';
  summary: string;
  sourceAsOf: number;
  freshness: {
    state: 'fresh' | 'watching' | 'stale_risk' | 'blocked_source';
    reason: string;
    expiresAt?: number;
    watchContractId?: string;
  };
  slots: {
    whyItMatters: string;
    currentState: string;
    stableFacts: KeystoneFact[];
    decisions: KeystoneDecision[];
    constraints: KeystoneConstraint[];
    traps: KeystoneTrap[];
    peopleAndSources: KeystoneSourceRole[];
    nextUseCases: string[];
    openQuestions: string[];
  };
  sourceMap: KeystoneSourceRef[];
  sceneAnchors: {
    projects: string[];
    jiraKeys: string[];
    people: string[];
    topics: string[];
    surfaces: string[];
  };
  displayPolicy: {
    defaultMode: 'silent' | 'chip' | 'card';
    maxLines: number;
    canCopyToDraft: boolean;
    externalSummaryOnly: boolean;
    hiddenSourceCount: number;
  };
  writeReceipt: {
    writesProfile: false;
    sendsExternal: false;
    createsTask: false;
    updatesFacts: false;
    writesOutcomeEvent: true;
  };
}
```

### KeystoneFact

```ts
interface KeystoneFact {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  authority: 'user_owned' | 'direct_message' | 'source_memory' | 'jira' | 'meeting' | 'reflection' | 'derived';
  sourceRefs: string[];
  validAsOf: number;
  staleRisk: 'low' | 'medium' | 'high';
  projection: 'local_only' | 'summary_ok' | 'blocked_external';
}
```

### 关键 slot

| Slot | 用户看到什么 | 生成要求 |
|---|---|---|
| `whyItMatters` | 为什么现在值得想起 | 必须来自当前场景 anchor 或近期 repeated use，不允许泛泛说“很重要” |
| `currentState` | 当前最短状态 | 必须有 source-as-of |
| `stableFacts` | 稳定事实 / 口径 | 至少 2 个独立 evidence 或高权威来源 |
| `decisions` | 已经做过的判断 | 必须标注谁/何时/在哪个来源 |
| `constraints` | 写回、外发、流程、字段限制 | 默认优先展示，因为它们最能减少 AI 误操作 |
| `traps` | 易错点、不要做什么 | 来自 outcome、用户纠正、failed action、反复追问 |
| `peopleAndSources` | 应该找谁 / 哪个源最权威 | 不展示私人直接联系方式 |
| `nextUseCases` | 什么时候用这份 brief | 例如 Jira estimate、AI prompt、meeting prep |
| `openQuestions` | 还不确定什么 | 不自动创建 action；只给用户判断 |

## 生成机制

### 1. Candidate Miner：发现值得做 brief 的对象

输入：

- `messages_raw` / `chunks`
- source-memory ready distillation
- reflection thread summaries
- action queue results / failures
- outcome events
- calendar / meeting prep
- Jira and project entities
- Memory Lens feedback / relevance patches

候选信号：

- 同一 project / topic / Jira / workflow 在最近 7-30 天反复出现。
- 用户或系统多次需要相同上下文，例如 `estimate 口径`、`只写 Sheet 不写 Jira`、`RingCX WhatsApp / SMS 复用路径`。
- 召回结果里同一内容经常高分出现，但用户仍需要人工拼接。
- 反思线程对同一个对象反复追问，但已经有一组稳定背景可写成 brief。
- source-memory / message / meeting 中出现行动指南、边界、决策、易错点。

排除：

- 单次短消息、纯寒暄、低信息量通知。
- 只有一个弱来源且无法验证的推测。
- 已被用户隐藏或标记不准且无新证据的对象。
- 需要高责任确认才能写入 profile 的内容。

### 2. Brief Composer：按 slot 生成简报

流程：

1. 聚合候选对象的 evidence window。
2. 按来源可信度和时间排序：用户自己输入 / Jira / source-memory / direct message / meeting / reflection / derived。
3. 用 deterministic rules 先抽取明显约束、Jira key、数字、写回边界、人名和来源。
4. 用 LLM 只做 slot 填充和压缩，输出 JSON schema。
5. 对每个 slot 做 source coverage check：没有 sourceRef 的 slot 不能进入 ready brief。
6. 对可能变化的事实标 `staleRisk`，必要时挂 Evidence Watch Contract，而不是直接说已确认。
7. 生成 display summary 和 external-safe summary。

### 3. Brief Evolution：新证据到来时 patch，而不是重写全部

当新消息、source-memory、meeting 或 Jira 更新命中同一 `briefKey`：

- 如果只是补证据，追加 sourceMap 并提升 confidence。
- 如果冲突，brief 进入 `partial`，当前 UI 显示 `有新证据冲突，先用旧结论 + 冲突提示`。
- 如果权威来源改变，旧 fact 标 `superseded`，不直接删除。
- 如果用户连续隐藏或标记不准，降低 display priority，并把错误归因写入 Outcome Loop。

## UX 设计

### 入口 1：Glip / Jira / Memory Lens 里的 brief chip

默认嵌入在现有右侧 Personal AI panel 或 Memory Lens 展开卡里：

- `关键简报 · WhatsApp 集成复用路径`
- `6 条证据 · 来源截至 2026-06-17 · 本机摘要`
- `打开` / `隐藏本条` / `证据`

不做全屏页面，不把用户带离当前工作。

### 入口 2：Ask / Quick Ask 的 brief suggestion

当用户在 Ask 里问：

> 帮我回顾 WhatsApp 集成这件事该怎么推进？

Ask 顶部可以先显示：

> 已命中关键简报：WhatsApp 集成复用路径。回答将优先使用 brief，并在需要时展开原始证据。

用户可关闭本轮 brief。关闭只影响本轮，不删除 brief。

### 入口 3：Prompt Context Compiler 的输入材料

Prompt Compiler 不需要从所有记忆重新拼 context，可以请求：

```http
GET /api/v1/keystone-briefs/match?scene=jira_estimate&draft=...
```

返回 1-3 个 brief 的 external-safe summary。Compiler 再决定是否插入 prompt patch。

### 入口 4：Source Memory detail 的“加入关键简报”

如果用户在 source-memory 详情页看到一份重要资料，可以点：

> 加入关键简报

这不是直接写 ready brief，而是给 Candidate Miner 增加一条 `user_seed`。后台仍需合并其他证据后才 ready。

## 边界设计

### 写入边界

关键记忆简报 P0 的用户动作只写：

- `keystone_brief_events`
- visibility preference
- outcome / feedback signal

不写：

- confirmed profile
- external message
- Jira / Sheet / Google Docs
- action queue
- confirm request
- personal skill

如果未来要把 brief 升格成 profile fact、skill、rehearsal 或 external action，必须走对应能力自己的 gate。

### 隐私和外发边界

- 默认 `local_only`。
- `给 Ask 用` 只写本机 Ask draft，不发送。
- `复制摘要` 使用 `externalSummaryOnly`，隐藏内部链接、受限群原文、token、meeting link、私聊片段和敏感 URL query。
- UI 必须显示 `hiddenSourceCount`，例如 `2 条来源只用于本机，不进入外部摘要`。

### 来源和权威边界

- 每个 slot 至少一个 sourceRef。
- `derived` 事实必须显示为系统推断，不能和 Jira / user-owned 事实混在一起。
- 反思线程只能提供问题和中间推理，不作为强权威事实；强事实仍需直接消息、source-memory、Jira、用户输入或会议证据。
- 如果来源 blocked，显示 `来源受限，未确认`，不能显示成 `已确认无变化`。

### Freshness 边界

- 每份 brief 都有 `sourceAsOf`。
- 可变化事实必须有 `staleRisk`。
- 超过有效期后降级为 `stale`，Memory Lens 只显示 `有旧简报，需刷新`，不直接当成当前事实。

### Recovery 边界

- 用户 `隐藏本条` 后可以在 Memory Exploring 高级设置恢复，但 P0 不需要做大页面；先通过本地 hidden preference + debug route。
- 用户 `不准` 后 brief 进入 `needs_repair`，仍保留 sourceMap 供排障，不自动删除证据。
- 新证据修复后可重新 ready，但必须记录 repair reason。

## API 草案

```http
GET /api/v1/keystone-briefs/match
POST /api/v1/keystone-briefs/mine
GET /api/v1/keystone-briefs/:id
POST /api/v1/keystone-briefs/:id/events
POST /api/v1/keystone-briefs/:id/hide
POST /api/v1/keystone-briefs/:id/repair-preview
```

`match` 示例响应：

```json
{
  "items": [
    {
      "id": "kb_whatsapp_sms_reuse",
      "title": "WhatsApp 集成复用路径",
      "status": "ready",
      "summary": "先调研 RingCX WhatsApp 与 SMS 基础设施，避免直接新设计。",
      "sourceAsOf": 1781704652,
      "freshness": {
        "state": "fresh",
        "reason": "最近 7 天有相关消息，未检测到冲突"
      },
      "displayPolicy": {
        "defaultMode": "chip",
        "maxLines": 6,
        "canCopyToDraft": true,
        "externalSummaryOnly": true,
        "hiddenSourceCount": 2
      },
      "writeReceipt": {
        "writesProfile": false,
        "sendsExternal": false,
        "createsTask": false,
        "updatesFacts": false,
        "writesOutcomeEvent": true
      }
    }
  ],
  "scopeReceipt": {
    "requestedScope": "work",
    "effectiveScope": "work",
    "returned": 1,
    "note": "本次只匹配工作记忆，个人记忆未进入候选。"
  }
}
```

## 数据表草案

| 表 | 用途 |
|---|---|
| `keystone_briefs` | brief 主对象、状态、title、summary、scope、sourceAsOf、freshness、display policy |
| `keystone_brief_slots` | slot 级内容和 confidence / stale risk / projection |
| `keystone_brief_sources` | sourceRef、authority、timestamp、hidden/external policy、evidence span |
| `keystone_brief_links` | brief 与 project/topic/jira/person/source-memory/reflection/action/outcome 的连接 |
| `keystone_brief_events` | shown/opened/copied/hidden/not_accurate/used_in_ask/used_by_compiler |
| `keystone_brief_candidate_runs` | miner/composer 输入摘要、schema version、blocked reason、eval tags |

## 集成点

### Memory Service

- 新增 `KeystoneBriefService`
- 消费 `ContextRecallService.extractSceneAnchors`
- 消费 `SourceMemoryCaptureService` ready distillation
- 消费 `ReflectionThreadService` latest summaries，但只作为 weak/derived source
- 消费 `MemoryOutcomeLoopService` outcome events
- 可选接入 `EvidenceWatchContractService` 做 freshness gate

### Extension / Desktop App

- Memory Lens expanded card 增加 brief chip。
- Glip / Jira content scripts 在 scene anchor 明确时请求 `/keystone-briefs/match`。
- Ask / Quick Ask 请求 answer 前先请求 match，展示使用回执。
- Prompt Context Compiler 可把 brief 当作候选 context source。

### Memory Exploring

P0 不新增日常入口。只需要 debug / evidence deep link：

- `memory-exploring.html#/keystone-brief/:id`

如果后续 brief 成为核心资产，再考虑在 Memory Exploring 增加高级列表，但不作为 P0。

## 分阶段计划

### P0：只做两个高价值场景的 ready brief

目标：证明跨来源高信号 brief 比普通召回列表更有用。

范围：

- 场景 A：WhatsApp / SMS 复用路径。
- 场景 B：Task Estimate / Jira estimate 口径。
- 后端只支持 deterministic miner + LLM slot composer + source coverage check。
- 前端只做 Memory Lens / Glip / Jira 模拟入口和 Ask draft copy receipt。

实现：

1. 新增表和 `KeystoneBriefService`。
2. 新增 `match` 和 `events` API。
3. 使用真实 memory-service 数据构造 P0 fixture。
4. Memory Lens / Glip / Jira content script 展示 chip。
5. Ask draft 写入只发生在本机草稿，不发送。

### P1：Brief Evolution 和 partial / stale 状态

- 新证据 patch 旧 brief。
- 冲突时进入 `partial`。
- stale risk 接入 Evidence Watch Contracts。
- 用户 `不准` 后进入 repair-preview。

### P2：Prompt Compiler / Today / Meeting Prep 消费

- Prompt Compiler 使用 brief 做 slot patch 输入。
- Today Pilot / Meeting Prep 展示 1-2 个当天相关 brief。
- Active Recall Coach 可以从 stable slot 生成卡片。

### P3：自动发现更多工作对象

- 扩展到 AI tool experience、release process、project planning、people context。
- 允许用户在 source-memory detail 显式 seed。
- 引入 response-aware utility scoring，减少只靠相似度的误选。

## 风险和反制

| 风险 | 表现 | 反制 |
|---|---|---|
| 变成又一个摘要页 | 用户要维护 brief 列表 | P0 不做独立入口，只在真实场景 chip 展示 |
| 过度自信 | brief 把推断写成事实 | 每个 slot 必须带 authority、sourceRef、confidence、sourceAsOf |
| 复制外发泄漏 | 内部链接或受限原文进入外部 AI | external-safe summary 默认隐藏原文和内部链接，显示 hiddenSourceCount |
| 和 Source Distiller 重复 | 单个 source-memory 也生成摘要 | Distiller 只负责 capsule；Keystone 需要跨来源 evidence 和工作对象 key |
| 和 Context Passport 重复 | 都能给 AI 上下文 | Passport 是 handoff 包；Keystone 是可被 handoff 引用的高信号 brief |
| 低质量候选太多 | 到处显示 chip | ready 门槛：多来源证据、未来使用信号、slot coverage、outcome/usefulness gate |
| 新证据冲突 | 用户看见旧结论 | freshness + partial 状态，旧 fact 标 superseded，不覆盖原证据 |

## Evals 决策

需要新增 evals。原因：这个能力的核心价值依赖高信号记忆提取、跨来源合成、slot 判断、来源归因、freshness 和外发边界，不是普通单元测试能证明的。

实现时应新增 suite：`keystone-memory-briefs`。

建议 case：

1. `whatsapp-sms-reuse-brief`
   - 使用真实 `10.32.56.212` recall 样本脱敏 fixture。
   - 期望 brief 抽出 `先调研 RingCX WhatsApp / SMS 基础设施`、`找 Ahmed / Chintamani`、`避免重复造轮子`。
   - 不应把 “PM 已完成对齐” 写成事实。
2. `task-estimate-boundary-brief`
   - 使用 Task Estimate / Sheet writeback / DEV Estimate Original 的真实场景 fixture。
   - 期望 brief 抽出字段口径、写回边界、source-as-of 和无法判断原因。
   - 不应声称自动写 Jira。
3. `weak-single-message-negative`
   - 只有一条短消息或弱推测。
   - 期望状态为 `candidate` 或 `blocked`，不展示 ready brief。
4. `stale-conflict-partial`
   - 新证据与旧 estimate / version 冲突。
   - 期望 brief 进入 `partial`，旧 fact 标 `superseded`，UI 显示需刷新。
5. `external-summary-redaction`
   - 证据里有内部链接、受限群消息或敏感 URL。
   - 期望 external summary 隐藏原文和链接，并显示 hiddenSourceCount。

验证要求：

```bash
npm run eval:validate
npm run eval:run -- --suite keystone-memory-briefs --no-repair
```

如果 report 中关键 slot 提取、source coverage、negative case、stale/partial、external redaction 任一失败，应继续改进直到全部通过。测试场景优先使用 `10.32.56.212` 上 `esone.qiu` 的真实 memory-service 数据；如果远端接口 degraded 或超时，可用本轮已采样的脱敏 fixture，但必须在 report 里注明来源和采样时间。

## 正式文档维护要求

如果后续实现本功能，最后必须把关键点和关键逻辑精简维护进正式功能文档：

- 后端核心逻辑优先并入 [`docs/features/memory_system.md`](../features/memory_system.md)，说明 `KeystoneBriefService`、source coverage、freshness 和写入边界。
- Memory Lens / Ask / Prompt Compiler 消费逻辑分别补到 [`docs/features/memory_lens.md`](../features/memory_lens.md)、[`docs/features/ask.md`](../features/ask.md) 和相关 Compose / Prompt 文档。
- 如果 desktop-app 有独立 Quick Ask / local draft 集成，应同步维护 `/Users/Esone/git/personal-ai/desktop-app/docs/features/` 下对应 feature doc；没有对应文档时再考虑新增 `desktop-app/docs/features/keystone_memory_briefs.md`。
- 如果实现后 brief 成为独立 route 或可见用户资产，应在 [`docs/features/index.md`](../features/index.md) 增加一行。
- 若能力完成并迁入正式文档，删除对应 `docs/progressing/keystone-memory-briefs-plan.md` 和 demo，避免 progressing 与正式文档重复。

## Demo 说明

Demo 文件：[`keystone-memory-briefs-demo.html`](./keystone-memory-briefs-demo.html)

它模拟的是集成在 Glip / Jira 工作页面右侧的 Personal AI 面板，不是独立产品页。重点展示：

- 当前工作页面中出现 `关键简报` chip。
- 展开后显示概览、证据、使用场景。
- 复制 / 写入 Ask 草稿只产生本机草稿回执，不发送、不写外部系统。
- 来源、freshness、hidden source、local-only 边界在首屏可见。

## 决策建议

推荐实现 P0。

它的亮点不是“又做一个更漂亮的摘要”，而是把 Personal AI 的长期记忆能力推进到下一层：

- 从保存很多记忆，变成提炼关键工作 brief。
- 从相似召回，变成跨来源、可来源化、可复用的高信号上下文。
- 从让用户自己翻找，变成在真实场景里直接给出“这件事你现在该记住什么”。

这比继续加 review queue 更符合用户当前优先级，也能自然反哺 Ask、Memory Lens、Prompt Compiler、Today Pilot 和 Skill Foundry。
