# Memory Rehearsal Studio：会前推演室（搁置）

> 生成日期：2026-05-09 CST<br>
> Codex 会话标题建议：新能力：会前推演室<br>
> 交付物：功能计划 + 可预览 Demo<br>
> Demo：[memory-rehearsal-studio-demo.html](./memory-rehearsal-studio-demo.html)

## 结论

建议设计一个新的 Personal AI 能力：**Memory Rehearsal Studio / 会前推演室**。

它不是会议纪要、不是人际 CRM、也不是把聊天记录再总结一遍。它的核心是在用户进入一次重要沟通之前，基于 Personal AI 已有的消息、会议、Jira、网页、AI 对话、决策、关系和用户偏好，生成一个**有证据边界的沟通沙盘**：

- 先告诉用户这次沟通的目标、风险、未闭环事项和关键人上下文。
- 再让用户用 2-5 分钟和一个或多个模拟角色演练。
- 演练时角色只使用有证据的立场、关注点和可能问题，不伪装成真实的人。
- 结束后给用户一份可执行的沟通策略、建议问法、风险提醒和可确认写回的记忆更新。

一句话价值：

> Personal AI 不只在会议前提醒你“上次发生了什么”，还让你在真正开口前，先安全地演练一次“这次怎么说才更可能推进事情”。

## 为什么要做

Personal AI 的目标是保存用户与 AI、网页、消息、会议、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话等场景提供记忆关联提示。现有方向已经覆盖了几类关键能力：

- `Context Assist`：把相关记忆整理成会前准备和输入框旁提示。
- `Relationship Memory Radar`：按人组织最近上下文、open loops、沟通偏好和证据。
- `Decision Time Machine`：回答“当时为什么这么决定”。
- `Operation Memory Flight Recorder`：记录“上次怎么把事做成”。
- `Personal Skill Foundry`：把反复有效的做法沉淀成 skill。

但真实使用里还有一个高价值空白：

> 用户知道上下文之后，仍然要决定“我该怎么开口、怎么推进、对方可能会问什么、我怎么不说错”。

这件事对当前用户尤其重要。用户是 Scrum Master，真实记忆里高频出现：

- RingCentral / Glip 消息和会议。
- Jira 数据统计、项目跟进、Rooms / Nova / Coa 等协作。
- AI 工具选型、Codex / Claude Code / Cursor / Factory.ai 成本与试用讨论。
- 对外部能力缺失、OpenClaw 委派失败、自动化规则等行动闭环的反思。
- 和 Sophia、Fred、Gary、John 等人围绕项目、AI 工具和数据协作的连续沟通。

这些场景的问题通常不是“记不得”，而是：

- 会议前 3 分钟才想起：我上次和这个人说到哪了？
- 对方可能提出的 objection 是什么？
- 哪些事实有证据，哪些只是我推测？
- 这次我应该先问问题、先给结论，还是先对齐口径？
- 如果我要让 Codex/Claude 帮我起草消息，应该给它什么边界？

会前推演室把 Personal AI 的长期记忆转成一个低风险的练习场，让用户在真实沟通前先“排雷”。

## 本次输入信号

### Reminders 检查

本机 Reminders 通过 AppleScript 可以枚举列表名，但没有发现名为 `Personal AI` 的列表。当前可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。

因此本次没有从 Reminder 随机抽取全新 idea，也没有需要标记 done 的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次 `http://10.32.56.212:3210/health` 可连接但返回 `degraded`，数据库状态显示未连接；随后通过 SSH 只读查询远端 `memory-service/data/users/esone.qiu/memory.db`，没有写入远端数据。

读到的关键统计：

- `messages_raw`: 9027 条。
- `chunks`: 4238 条。
- `entities`: 13517 个。
- `relationships`: 47443 条。
- `reflection_threads`: 587 条。
- `proposed_actions`: 367 条。
- `personal_skills`: 8 条。

主要来源：

- `glip`: 8630 条。
- `meeting`: 239 条。
- `system`: 151 条。

人物与场景信号：

- 用户身份：Esone Qiu，Scrum Master，时区 Asia/Shanghai。
- 最近记忆包含 Claude Code vs Codex 投票、Cursor license reclaim、OpenAI deal、AI tool 成本策略、Jira 数据统计、Rooms / Coa 协作、Nova E2E、Meeting Pilot、RingCentral Video。
- `proposed_actions` 中多次出现 OpenClaw / Glip / RingCentral presence 能力缺失，说明用户的真实工作已经从“查询记忆”走向“让 AI 帮我行动”，但行动前需要更好的确认、沟通和准备。
- `calendar_events` 当前为 0，意味着会前准备不能只依赖日历；需要能从 RingCentral/Glip、会议标题、当前网页、用户手动输入目标中快速生成演练场景。

### 已有方案避让

本方案刻意避开已有 progressing 方案的主对象：

| 已有方案 | 主对象 | 会前推演室的边界 |
|---|---|---|
| Relationship Memory Radar | 人际上下文卡 | 消费关系卡，但目标是演练和反馈 |
| Context Assist | 会前/写作提示 | 消费 cue cards，但提供互动模拟 |
| Decision Time Machine | 决策证据链 | 可引用决策链，但不管理决策 episode |
| Operation Memory Flight Recorder | 操作过程记录 | 可把演练结果写成操作/沟通 episode，但不是捕获器 |
| Personal Skill Foundry | 可复用流程 skill | 可沉淀“沟通策略 skill”，但不是技能库 |
| Memory Trust Console | 记忆质量和隐私治理 | 依赖其 trust score，不替代治理台 |

会前推演室的独立价值是：**把“知道”变成“练过”**。

## 行业观察

### 1. AI 语音和实时对话已经足够支撑低延迟演练

OpenAI 在 2026-05-07 发布新的实时语音模型：[Advancing voice intelligence with new models in the API](https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/)。官方说明包括：

- `GPT-Realtime-2`：用于实时语音交互，能在对话中推理、处理更复杂请求、使用工具并承接上下文。
- `GPT-Realtime-Translate`：实时语音翻译。
- `GPT-Realtime-Whisper`：低延迟流式转写。

[OpenAI Realtime API 文档](https://platform.openai.com/docs/guides/realtime) 也说明 Realtime API 支持低延迟、多模态、speech-to-speech 和浏览器端 voice agent。

启发：

- 会前推演室 MVP 可以先做 text-first。
- 第二阶段可以升级为 voice rehearsal，让用户像真实会议一样说话。
- 实时转写与翻译能支持中英混合会议、跨语言会议、口语表达反馈。

### 2. 沟通训练产品已经证明“AI roleplay + feedback”有需求

[Yoodli](https://support.yoodli.ai/en/articles/9550461-yoodli-overview) 把自己定位为 AI speech coach，支持 pitch / presentation / interview / roleplay / video call feedback，并提供桌面 app 在视频会议中只录用户自己的声音做私密反馈。

[Hyperbound](https://www.hyperbound.ai/) 主打 AI sales roleplay，强调可以从真实 calls 中构建 roleplays，让销售人员练习即将发生的对话，并用 scorecards 反馈。

[Second Nature](https://secondnature.ai/) 主打 AI role play sales training，支持把 website、recorded call、sales deck、playbook、knowledge article 等内容加载成定制练习。

启发：

- 市场已经验证“练习一次再上场”比只看资料更有价值。
- 但这些产品多数面向销售培训、公开演讲或团队 enablement。
- Personal AI 的机会在于：不是训练通用话术，而是用**用户自己的私有记忆**生成即将发生的那场具体沟通。

### 3. 会议记录产品正在变成 AI 工作流数据源，但还不等于沟通练习

Granola、Copilot、Zoom AI Companion、Fathom、Fireflies 等产品证明“会议转写、摘要、action items”已经是成熟赛道。它们擅长会后整理，也开始把会议资料提供给其他 AI workflow。

会前推演室不和它们抢“记录会议”。它的差异是：

- 发生在会前或发送消息前。
- 关注用户接下来该怎么说，而不是会议已经说了什么。
- 用 Personal AI 的长期记忆和关系上下文生成“可能被问到的问题”和“风险边界”。

### 4. 论文支持用 LLM 做角色模拟，但必须保留边界

[Role Play with Large Language Models](https://www.nature.com/articles/s41586-023-06647-8) 讨论了 LLM 在对话中扮演角色的机制和边界。对产品的启发是：可以用 role-play 提升互动性，但不能把模型输出当作真实人的真实想法。

[Generative Agent Simulations of 1,000 People](https://arxiv.org/abs/2411.10109) 和 Stanford HAI 对该工作的报道：[AI Agents Simulate 1,052 Individuals' Personalities with Impressive Accuracy](https://hai.stanford.edu/news/ai-agents-simulate-1052-individuals-personalities-with-impressive-accuracy)，展示了用访谈数据构建 generative agents 来模拟个体行为的可能性。报道也强调这是一种 computational entity，不是本人。

[Role-Playing Agents Driven by Large Language Models: Current Status, Challenges, and Future Trends](https://arxiv.org/abs/2601.10122) 把 role-playing agents 的挑战归纳到人格演化、多智能体叙事、多模态沉浸交互等方向。

启发：

- 会前推演室可以做“证据约束的 stakeholder simulator”。
- 必须明确 UI 文案：这是“基于历史证据的可能关注点模拟”，不是某个人的真实想法。
- 每个角色的立场、偏好、objection 都需要挂证据和置信度。
- 对未知内容应该输出“可能会问 / 需要确认”，不能编造成事实。

## 产品定位

### 功能名

**Memory Rehearsal Studio / 会前推演室**

备选中文名：

- 沟通沙盘
- 会前演练室
- 会议推演台
- Stakeholder Rehearsal

推荐中文用“会前推演室”，因为：

- “会前”对应真实入口：RingCentral Video Home、Meeting Pilot、日历、聊天发送前。
- “推演”比“模拟真人”更安全，强调策略和场景，不暗示人格克隆。
- “室”可以承载独立页面和沉浸式交互。

### 一句话产品承诺

> 在重要会议、私聊或跨 AI 求助前，Personal AI 基于你的真实记忆生成一场短练习，帮你提前发现风险、整理问法、准备回应。

### 目标用户

第一目标用户就是 Personal AI 当前真实使用者：

- Scrum Master / 项目协调者。
- 每天在 RingCentral、会议、Jira、AI coding tools、Google Sheets、Codex、Claude、ChatGPT、豆包之间切换。
- 需要推动项目、对齐口径、处理多方依赖、协调 AI 工具使用和成本策略。
- 不缺信息，缺“开口前的安全练习场”和“下一句怎么说”的具体建议。

### 不做什么

- 不伪装成真实人物，不宣称能预测别人真实想法。
- 不替用户自动发送消息或自动承诺。
- 不把敏感聊天原文默认注入外部模型。
- 不做团队监控或员工画像评分。
- 不做销售培训平台。
- 不要求用户花很长时间完成课程式训练。

### 做什么

- 从真实记忆生成具体场景。
- 让用户选择 90 秒快练、5 分钟深练或消息 dry-run。
- 模拟可能的问题、反对意见、困惑和关注点。
- 给出证据边界、沟通策略、措辞反馈和 next steps。
- 把用户确认后的新事实、承诺、偏好或待办写回 Personal AI。

## 核心体验

### 入口 1：会前准备卡片里的“推演 3 分钟”

在 RingCentral Video Home / Meeting Pilot 会前准备卡里，新增一个动作：

`推演 3 分钟`

点击后进入 Rehearsal Studio，系统已经带入：

- 会议标题、时间、参会人。
- 用户补充的 meeting goal。
- Relationship Radar 的人际上下文。
- Decision Time Machine 的相关历史结论。
- Context Assist 的 cue cards。
- 最近 open loops 和风险。

用户无需重新输入背景，只需要选模式：

- `快速排雷`：系统连续问 3 个最可能卡住会议的问题。
- `反方挑战`：模拟最难说服的一方。
- `共识推进`：模拟如何让多方收敛到下一步。
- `消息预演`：把要发的消息先交给模拟对象反应。

### 入口 2：输入框旁的“先试发”

在 RingCentral message、Jira comment、ChatGPT/Claude/Codex prompt 输入框旁，Composer Guard 已经能提示上下文。会前推演室可以加一个更主动的动作：

`先试发`

用户写好草稿后不发送，点击后系统模拟：

- 对方可能误解什么。
- 哪句话没有证据。
- 哪个承诺太模糊。
- 哪个问题可以更具体。
- 是否应该补上历史背景。

这比普通润色更有价值，因为 feedback 来自 Personal AI 的关系记忆和历史证据。

### 入口 3：人物详情页里的“练一次”

在 `memory-exploring.html#/entity/Person/:personId` 的 Relationship Radar 详情页中，新增：

`练一次跟 TA 沟通`

适合用户主动准备 1:1、handover、困难对话、项目推进。

### 入口 4：Ask 结果里的“把这个做成演练”

当用户在 `/ask` 问：

- “我待会怎么跟 Sophia 说 Rooms/Coa？”
- “Gary 要 Codex/Claude 投票，我怎么回复更好？”
- “我该怎么问 Fred 关于 Cursor license policy？”

如果回答命中沟通意图，结果里显示：

`生成 3 分钟推演`

## 页面信息架构

会前推演室是一个工作台，不是 landing page。

### 左栏：场景和角色

- 场景标题。
- 当前目标。
- 参会人 / 对话对象。
- 模式选择。
- 证据覆盖率。
- 角色卡片：
  - 角色名。
  - 关联项目。
  - 可能关注点。
  - open loops。
  - 证据置信度。
  - 禁用项：不可假设的内容。

### 中栏：演练对话

- 当前模拟角色发问。
- 用户输入或语音回答。
- 快捷动作：
  - `我不确定`
  - `给我证据`
  - `换个问法`
  - `提高难度`
  - `结束并总结`
- 每轮后轻量提示：
  - 未回答的问题。
  - 可能需要补证据的断言。
  - 建议下一句。

### 右栏：教练和证据

- Live Coach：
  - 清晰度。
  - 风险。
  - 是否引用了过期/未确认事实。
  - 是否遗漏 open loop。
  - 是否过度承诺。
- Evidence：
  - 相关消息、会议、决策、Jira、网页。
  - 每条证据的来源、时间、置信度。
- After Action：
  - 推荐开场。
  - 建议问的问题。
  - 避免说的话。
  - 需要会后跟进的 action items。

## 关键用户流程

### 流程 A：会前 3 分钟快速推演

1. 用户打开 RingCentral Video Home。
2. Personal AI 会前准备卡识别到会议和相关人。
3. 用户输入目标：“今天想确认 Rooms 和 Coa 协作 owner。”
4. 点击 `推演 3 分钟`。
5. 系统生成场景：
   - 目标：确认 owner、依赖、下一步。
   - 角色：Sophia、Coa representative、user as facilitator。
   - 证据：最近消息、会议摘要、未闭环事项。
6. 系统模拟 Sophia 提问：“现在 Coa 这块到底谁在接？我们先确认 owner 还是先推进 Rooms？”
7. 用户回答。
8. Coach 提醒：
   - “你给了方向，但没有确认 owner。”
   - “建议下一句直接问：这块现在是否由 X owner？如果不是，今天需要谁来定？”
9. 结束后生成：
   - 30 秒开场。
   - 3 个必问问题。
   - 2 个风险边界。
   - 1 条会后 action item 模板。

### 流程 B：困难消息先试发

1. 用户在 RingCentral 写消息：“能不能今天前给我最终结论？”
2. Composer Guard 识别到这与某个 open loop 有关。
3. 用户点 `先试发`。
4. 系统模拟对方反应：
   - “最终结论指哪一个 decision？”
   - “今天前是否现实？”
   - “你需要对方给 yes/no 还是给 blocking reason？”
5. Coach 建议改写：
   - “为了关掉 Rooms/Coa 的 open loop，今天 17:00 前能否确认 owner？如果还不能，请告诉我 blocker 和最早可确认时间。”
6. 用户采纳后再手动发送。

### 流程 C：跨 AI 求助前演练 prompt

1. 用户要让 Codex/Claude 帮忙写会议跟进。
2. Personal AI 根据当前上下文生成 context package。
3. 用户先用会前推演室问模拟角色：“这段 follow-up 有没有容易误解的地方？”
4. 系统指出：
   - “不要说 Sophia 已经 owner Rooms；证据只显示她建议先 clarify Coa collaboration。”
   - “可以让 Codex 生成更中性的 follow-up。”
5. 用户复制安全版 context package 给外部 AI。

## 交互原则

### 1. 证据优先，不做人格克隆

角色卡不写“TA 会怎么想”，而写：

- `历史证据显示 TA 关注过...`
- `可能会问...`
- `需要确认...`
- `不要假设...`

角色发问时也要显示证据来源或 `inferred` 标签。

### 2. 练习短、反馈准

用户不是来上课的。默认只给：

- 90 秒快练。
- 3 分钟标准。
- 5 分钟深练。

反馈只保留最重要 3 条，不做长篇报告。

### 3. 不替用户做决定

系统可以提出沟通策略，但不自动发送、不自动承诺、不自动代表对方下结论。

### 4. 每次演练结束都要能落地

输出必须是用户马上能用的：

- 开场句。
- 必问问题。
- 风险边界。
- follow-up 文案。
- action items。
- 是否写回记忆的确认卡。

### 5. 低置信度要显眼

如果缺少足够证据，演练仍可进行，但 UI 必须标注：

- `证据不足`
- `这是通用沟通推演`
- `不要把模拟回答当作真实对方立场`

## 核心对象

### RehearsalSession

```ts
interface RehearsalSession {
  id: string;
  title: string;
  sourceSurface:
    | 'meeting_prep'
    | 'composer_guard'
    | 'person_detail'
    | 'ask'
    | 'manual';
  mode:
    | 'quick_risk_check'
    | 'stakeholder_objection'
    | 'consensus_push'
    | 'message_dry_run'
    | 'free_practice';
  status: 'draft' | 'running' | 'completed' | 'archived';
  userGoal: string;
  scope: 'work' | 'personal' | 'both';
  startedAt?: number;
  endedAt?: number;
  sourceRefs: EvidenceRef[];
  participantRefs: PersonRef[];
  projectRefs: EntityRef[];
  riskLevel: 'low' | 'medium' | 'high';
  evidenceCoverage: number;
  createdAt: number;
  updatedAt: number;
}
```

### RehearsalRole

```ts
interface RehearsalRole {
  id: string;
  sessionId: string;
  displayName: string;
  roleType:
    | 'specific_person'
    | 'stakeholder_archetype'
    | 'reviewer'
    | 'skeptic'
    | 'facilitator';
  personId?: string;
  stanceSummary: string;
  likelyQuestions: string[];
  knownFacts: EvidenceBackedFact[];
  inferredConcerns: InferredConcern[];
  forbiddenAssumptions: string[];
  toneHints: string[];
  confidence: number;
}
```

### RehearsalTurn

```ts
interface RehearsalTurn {
  id: string;
  sessionId: string;
  roleId?: string;
  speaker: 'user' | 'simulated_role' | 'coach';
  content: string;
  audioRef?: string;
  transcriptConfidence?: number;
  evidenceRefs?: EvidenceRef[];
  coachSignals?: CoachSignal[];
  createdAt: number;
}
```

### CoachSignal

```ts
interface CoachSignal {
  kind:
    | 'missing_answer'
    | 'unsupported_claim'
    | 'stale_fact'
    | 'over_commitment'
    | 'unclear_next_step'
    | 'good_question'
    | 'tone_risk'
    | 'privacy_risk';
  severity: 'info' | 'low' | 'medium' | 'high';
  message: string;
  suggestedRepair?: string;
  evidenceRefs?: EvidenceRef[];
}
```

### RehearsalOutcome

```ts
interface RehearsalOutcome {
  sessionId: string;
  openingSuggestion: string;
  mustAskQuestions: string[];
  likelyObjections: string[];
  avoidSaying: string[];
  followUpDraft?: string;
  actionItems: Array<{
    title: string;
    ownerHint?: string;
    dueHint?: string;
    confidence: number;
  }>;
  writebackCandidates: RehearsalWritebackCandidate[];
}
```

## 技术架构

### 新增服务层

```text
Context sources
  ├─ Relationship Radar projection
  ├─ Context Assist cue cards
  ├─ Decision Evidence Chain
  ├─ Meeting Pilot records
  ├─ messages_raw / chunks / entities / relationships
  ├─ user_profile_items
  └─ Memory Trust issues
        │
        ▼
RehearsalContextBuilder
        │
        ▼
ScenarioCompiler
        │
        ├─ RoleProfileCompiler
        ├─ EvidenceBudgeter
        ├─ ForbiddenAssumptionGuard
        └─ ObjectivePlanner
        │
        ▼
RehearsalRuntime
        │
        ├─ Text turn runtime
        ├─ Voice adapter (phase 2)
        ├─ Coach evaluator
        ├─ Tool calls: recall / evidence lookup / trust check
        └─ Outcome generator
        │
        ▼
Review & writeback
  ├─ action item candidates
  ├─ profile update candidates
  ├─ relationship note candidates
  ├─ meeting prep handoff
  └─ external AI context package
```

### RehearsalContextBuilder

职责：

- 根据来源 surface 和 userGoal 拉取相关上下文。
- 对 evidence 做 token budget。
- 把事实、推断、过期、敏感、低置信度内容分层。
- 生成 `ScenarioSeed`。

输入：

```ts
interface PrepareRehearsalRequest {
  sourceSurface: RehearsalSession['sourceSurface'];
  userGoal: string;
  event?: CalendarOrMeetingRuntimeRef;
  draftText?: string;
  personIds?: string[];
  projectIds?: string[];
  sourceRefs?: EvidenceRef[];
  durationTargetSec?: 90 | 180 | 300;
}
```

输出：

```ts
interface ScenarioSeed {
  title: string;
  objective: string;
  participants: PersonContextCard[];
  openLoops: OpenLoop[];
  decisions: DecisionSummary[];
  evidencePack: EvidencePack;
  trustWarnings: TrustWarning[];
  suggestedModes: RehearsalSession['mode'][];
}
```

### ScenarioCompiler

职责：

- 把 `ScenarioSeed` 编译成可运行演练。
- 生成角色卡、首轮问题、难度曲线。
- 限制模拟角色只能引用可用证据和明确标注的推断。

关键 guardrail：

```text
You are not simulating the real person.
You are simulating a rehearsal role constrained by evidence.
If a stance is not supported, ask a clarifying question instead of inventing a belief.
Never reveal private raw messages unless they are included in the approved evidence pack.
```

### RehearsalRuntime

MVP 使用文本 runtime：

- 用户输入文本回答。
- 模拟角色生成下一问。
- Coach 生成轻量信号。
- 支持 `结束并总结`。

Phase 2 接入语音：

- 浏览器端 WebRTC 连接实时模型。
- `GPT-Realtime-Whisper` 或等价 streaming STT 做 live transcript。
- `GPT-Realtime-Translate` 可用于跨语言会议练习。
- 支持 interruption、工具调用、证据查询。
- 默认 `own voice only`：只采集用户演练音频，不接入真实会议通话。

### CoachEvaluator

评分不是为了打击用户，而是为了行动建议。默认维度：

| 维度 | 说明 |
|---|---|
| Goal coverage | 是否推进了用户目标 |
| Evidence safety | 是否把无证据推断当事实 |
| Question quality | 是否问出了可推进的具体问题 |
| Next-step clarity | 是否明确 owner / due / outcome |
| Tone fit | 是否符合关系上下文和用户偏好 |
| Risk control | 是否避免过度承诺或敏感泄露 |

### WritebackManager

演练结束后只生成候选，不自动写入：

- `action_item_candidate`：会后要问/要确认。
- `relationship_note_candidate`：例如“与 Sophia 沟通 Rooms/Coa 时，owner 确认是核心 open loop”。
- `profile_preference_candidate`：用户确认的沟通偏好。
- `decision_followup_candidate`：需要复查的历史前提。
- `skill_candidate`：如果同类演练重复出现，可交给 Skill Foundry 形成“项目沟通推进 skill”。

用户逐条确认后再写入 Memory Service。

## API 设计

### `POST /api/v1/rehearsals/prepare`

生成可预览场景，不启动演练。

```json
{
  "sourceSurface": "meeting_prep",
  "userGoal": "确认 Rooms 和 Coa 协作 owner",
  "event": {
    "title": "Rooms / Coa sync",
    "attendees": ["sophia.lin", "esone.qiu"]
  },
  "durationTargetSec": 180,
  "scope": "work"
}
```

返回：

```json
{
  "sessionDraft": {},
  "roles": [],
  "evidence": [],
  "trustWarnings": [],
  "suggestedModes": ["quick_risk_check", "stakeholder_objection"]
}
```

### `POST /api/v1/rehearsals`

创建 session。

### `POST /api/v1/rehearsals/:id/start`

启动演练并返回首轮模拟问题。

### `POST /api/v1/rehearsals/:id/turn`

提交用户回答，返回模拟角色下一轮、coach signals 和可用 evidence。

### `POST /api/v1/rehearsals/:id/end`

结束并生成 outcome。

### `POST /api/v1/rehearsals/:id/writeback`

用户确认后写入候选更新。

### `GET /api/v1/rehearsals`

列出演练历史。

### `GET /api/v1/rehearsals/:id`

查看单次演练详情。

## 数据库设计

### `rehearsal_sessions`

```sql
CREATE TABLE rehearsal_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_surface TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  user_goal TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'work',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  participant_refs_json TEXT NOT NULL DEFAULT '[]',
  project_refs_json TEXT NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  evidence_coverage REAL NOT NULL DEFAULT 0,
  outcome_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  ended_at INTEGER
);
```

### `rehearsal_roles`

```sql
CREATE TABLE rehearsal_roles (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_type TEXT NOT NULL,
  person_id TEXT,
  stance_summary TEXT NOT NULL,
  likely_questions_json TEXT NOT NULL DEFAULT '[]',
  known_facts_json TEXT NOT NULL DEFAULT '[]',
  inferred_concerns_json TEXT NOT NULL DEFAULT '[]',
  forbidden_assumptions_json TEXT NOT NULL DEFAULT '[]',
  tone_hints_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES rehearsal_sessions(id)
);
```

### `rehearsal_turns`

```sql
CREATE TABLE rehearsal_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role_id TEXT,
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_ref TEXT,
  transcript_confidence REAL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  coach_signals_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES rehearsal_sessions(id)
);
```

### `rehearsal_writeback_candidates`

```sql
CREATE TABLE rehearsal_writeback_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  candidate_type TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  state TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  decided_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES rehearsal_sessions(id)
);
```

## 前端落点

### 路由

推荐不是新建孤岛页面，而是挂到 `memory-exploring` 体系：

- `memory-exploring.html#/rehearsal`
- `memory-exploring.html#/rehearsal/:id`

入口分散在现有场景：

- RingCentral Video Home 会前准备卡。
- Meeting Pilot handoff。
- `PersonDetailPage.vue`。
- Composer Guard popover。
- `/ask` 决策/沟通类答案。

### 组件建议

```text
src/rehearsal/
  RehearsalStudio.vue
  RehearsalScenarioPanel.vue
  RehearsalRoleCard.vue
  RehearsalConversation.vue
  RehearsalCoachPanel.vue
  RehearsalEvidencePanel.vue
  RehearsalOutcomeDrawer.vue
  rehearsalApi.ts
```

### UI 设计重点

- 三栏 workbench。
- 顶部只显示当前目标、模式、倒计时和结束按钮。
- 模拟对话是主视觉，不要把证据卡压过对话。
- 右栏 coach 默认只显示 3 条最重要反馈。
- 证据详情按需展开。
- 低置信度和 forbidden assumptions 用明显标签。
- 演练结束后，不直接写回，先进入 review drawer。

## 隐私与安全

### 角色模拟风险

风险：用户可能误以为系统真的知道某个人的想法。

设计：

- UI 固定展示“基于历史证据的演练角色，不代表本人真实想法”。
- 角色发言旁标注 `evidence-backed` / `inferred` / `generic rehearsal`。
- 不显示“personality score”。
- 不生成敏感人格判断，例如“这个人容易生气”。

### 敏感内容外流风险

风险：演练可能调用外部模型。

设计：

- 默认 evidence pack 脱敏。
- 对外部模型只发送摘要和证据 refs，不发送完整内部消息，除非用户展开确认。
- Memory Trust Console 可拦截高敏感 evidence。
- 本地/内网模型可作为企业敏感场景 fallback。

### 真实会议监听风险

风险：把 live coach 直接接入真实会议可能涉及同意和合规。

设计：

- MVP 不进入真实会议音频，只做会前练习。
- Phase 2 语音演练只采集用户主动练习的音频。
- Phase 3 live meeting coach 如果要做，先支持 `own voice only` 模式，类似 Yoodli 桌面 app 的私密反馈方向。
- 任何真实会议转写必须延续 Meeting Pilot 的同意与提示策略。

### 记忆污染风险

风险：模拟输出被误写入长期记忆。

设计：

- `rehearsal_turns` 默认不进入通用 recall。
- 只有 user-confirmed 的 outcome / action item / relationship note 才写入长期记忆。
- 模拟角色的话永远标记为 `simulated`，不能作为真实 evidence。

## MVP 范围

### MVP 要做

1. Text-first Rehearsal Studio 页面。
2. 从手动输入目标 + person/project refs 生成场景。
3. 支持 3 种模式：
   - `快速排雷`
   - `反方挑战`
   - `消息先试发`
4. 从 Memory Service 读取：
   - messages/chunks recall。
   - person/entity context。
   - reflection/open-loop/action candidates。
5. 生成角色卡：
   - known facts。
   - likely questions。
   - forbidden assumptions。
6. 进行最多 6 轮文字演练。
7. 生成 outcome：
   - 开场句。
   - 必问问题。
   - 避免说的话。
   - action item 候选。
8. 用户确认后写回 action / relationship note。
9. Demo 接入到 `docs/progressing/memory-rehearsal-studio-demo.html`。

### MVP 不做

- 不做实时语音。
- 不接入真实会议音频。
- 不做多人同时在线演练。
- 不自动发送消息。
- 不训练个人模型。
- 不做完整人物页重构。

## 分阶段路线

### Phase 0：方案和静态 demo

- 完成本方案。
- 完成三栏 workbench demo。
- 明确和 Relationship Radar / Context Assist 的边界。

### Phase 1：Text-first 可用 MVP

- 后端新增 rehearsal routes 和 session 表。
- 前端新增 Rehearsal Studio 页面。
- 支持从 `/ask`、Person detail、手动入口启动。
- 支持文字演练和 outcome review。
- 写回只支持 action candidates。

### Phase 2：会议和输入框场景集成

- RingCentral Video Home 会前准备卡新增 `推演 3 分钟`。
- Composer Guard 新增 `先试发`。
- Meeting Pilot 可读取最近一次 rehearsal outcome 作为会中提示。
- 关系上下文卡可直接生成 rehearsal seed。

### Phase 3：Voice rehearsal

- 接入 Realtime voice adapter。
- 支持语音回答、实时转写、打断、自然口语反馈。
- 支持中英混合演练和实时翻译模式。
- 保存音频默认关闭，只保存 transcript 和用户确认的 outcome。

### Phase 4：Live coach 试验

- 仅在明确授权下，对用户自己的麦克风做本地/流式转写。
- 不录其他参会人，除非 Meeting Pilot 已经获得会议级授权。
- 会中只显示极少数提示：
  - “这个 open loop 还没问。”
  - “刚才出现 owner，但没有 due date。”
  - “这是未确认旧事实，别直接当结论。”

### Phase 5：沟通 skill 沉淀

- 如果用户反复使用同类演练，例如“Jira 数据口径确认”“跨团队 owner 对齐”“AI 工具成本策略沟通”，生成 Skill Foundry 建议。
- 技能内容包括：
  - 触发条件。
  - 会前检查清单。
  - 常见 objection。
  - 推荐问法。
  - follow-up 模板。

## 竞品对比

| 产品/方向 | 能力 | Personal AI 差异 |
|---|---|---|
| Yoodli | 演讲、面试、roleplay、视频会议反馈 | Personal AI 不是通用 speech coach，而是用用户自己的记忆生成具体沟通场景 |
| Hyperbound | 从真实销售 call 生成 buyer roleplay 和 scorecard | Personal AI 面向个人工作协作，不限销售；数据来自用户私有消息、会议、AI 对话、Jira |
| Second Nature | 加载 playbook / deck / recorded call 生成销售训练 | Personal AI 加载的是个人长期记忆图谱和关系上下文，不是课程材料 |
| Granola / Fathom / Fireflies | 会后记录、摘要、action items | Personal AI 发生在会前，帮助用户练习和准备 |
| Microsoft Copilot / Zoom AI Companion | 会议总结、上下文问答、协作辅助 | Personal AI 强调用户拥有的跨工具记忆和证据边界 |
| 普通 AI 改写工具 | 润色文本 | 会前推演室会模拟 objection、检查历史证据、避免错误承诺 |

## 成功指标

### 用户价值指标

- 用户是否在重要会议前愿意点击 `推演 3 分钟`。
- 用户是否采纳 outcome 中的开场句、必问问题或 follow-up。
- 用户是否减少会后“忘了问 owner/due/date”的情况。
- 用户是否把演练结果写回 action item。
- 用户是否在同类场景重复使用。

### 质量指标

- 演练角色发言中 evidence-backed 内容比例。
- unsupported claim 被 coach 识别的准确率。
- forbidden assumption 违规率。
- outcome 被用户删除/修改比例。
- 模拟内容被误写入长期记忆的次数必须为 0。

### 体验指标

- 从入口到首轮问题 < 5 秒。
- 90 秒快练能在 3 轮内产出有用建议。
- 右栏 coach 每轮最多 3 条提示。
- 移动/窄屏不遮挡对话输入。

## 验证计划

### 单元测试

- `RehearsalContextBuilder`：
  - 正常 evidence。
  - 缺少 evidence。
  - 含 sensitive evidence。
  - 含 stale/conflicting fact。
- `ScenarioCompiler`：
  - forbidden assumptions 不进入角色事实。
  - low confidence 内容被标注 inferred。
- `CoachEvaluator`：
  - unsupported claim。
  - over-commitment。
  - missing owner/due。

### 后端 API 测试

- `POST /rehearsals/prepare` 创建 draft。
- `POST /rehearsals/:id/start` 返回首轮。
- `POST /rehearsals/:id/turn` 追加 turn。
- `POST /rehearsals/:id/end` 生成 outcome。
- `POST /rehearsals/:id/writeback` 只写用户确认的候选。

### 前端 E2E

- 从 manual route 创建演练。
- 切换模式。
- 输入回答。
- 查看 coach。
- 结束并生成 outcome。
- 勾选 action item 写回。

### 真实数据验证

使用 `10.32.56.212` 的 `esone.qiu` 数据做只读验证：

- Sophia / Jira data 场景。
- Gary / Claude Code vs Codex vote 场景。
- Fred / Cursor license policy 场景。
- OpenClaw capability missing 场景。

真实环境只读验证通过后，再考虑写回候选，且必须使用 `X-User-Id: esone.qiu` 和用户确认。

## Demo 说明

配套 demo：[memory-rehearsal-studio-demo.html](./memory-rehearsal-studio-demo.html)

Demo 展示一个工作台：

- 左侧：场景、模式、角色和证据覆盖。
- 中间：演练对话和用户回答。
- 右侧：实时教练、证据、结束后的行动建议。

Demo 数据是合成的，但形状来自真实记忆信号：

- Rooms / Coa 协作 owner。
- Sophia 的 Jira 数据协作上下文。
- Gary 的 Codex / Claude Code 投票场景。
- Fred 的 AI tool cost policy 场景。

## 推荐优先级

我建议把会前推演室排在 Relationship Radar 和 Context Assist 之后、Voice rehearsal 之前：

1. Relationship Radar 先把 person-centric memory projection 做稳。
2. Context Assist 先把会前 cue cards 和 composer guard 做稳。
3. 会前推演室用这些结构化上下文做 text-first 演练。
4. 等用户确认“练一次”确实有价值，再投入实时语音。

原因：

- 没有高质量关系卡，演练会变成通用聊天机器人。
- 没有 Context Assist 的场景入口，用户很难想起主动打开推演室。
- Text-first 已经能验证核心价值，不必一开始承担语音和合规复杂度。

## 最小实现建议

如果只做一个能验证价值的版本，范围可以压缩到：

- 在 `memory-exploring.html#/rehearsal` 做一个页面。
- 用户手动输入目标和选择 1-3 个人。
- 后端用 `/recall` + `entities` + `reflection_threads` 生成 role cards。
- 用普通 text model 做 3 轮演练。
- 结束后生成 3 个问题、1 段开场、1 条 action item。
- action item 需要用户确认后才写入 `proposed_actions`。

这个 MVP 不依赖日历、不依赖语音、不依赖真实会议授权，但能立刻回答一个问题：

> Personal AI 的记忆是否足够帮用户在真实沟通前准备得更好？

如果答案是 yes，再进入 RingCentral 会前卡和语音演练。
