# Memory Rehearsal Studio：记忆情景演练室

*创建: 2026-05-04 CST*

配套 demo：[`memory-rehearsal-studio-demo.html`](./memory-rehearsal-studio-demo.html)

## 结论

建议设计一个新能力：**Memory Rehearsal Studio（记忆情景演练室）**。

它不是再做一个会议纪要工具，也不是把记忆打包给另一个 AI，而是在用户进入会议、1:1、项目同步、冲突沟通、AI 工具评审、Jira 对齐之前，基于 Personal AI 已保存的消息、会议、网页、AI 对话、项目事实、决策记忆和用户偏好，生成一个**可证据追溯、可交互演练、会在真实会议后校准的“会前/聊前未来沙盘”**。

一句话价值：

> 用户不再冷启动进入重要沟通；Personal AI 会先用真实记忆帮用户预演对方可能关心什么、会追问什么、哪些前提已经变了，以及用户该怎么回答。

这个能力特别适合 Personal AI 的长期目标：它把“留存所有记忆”进一步变成“在关键场景前帮用户恢复状态、降低认知负担、提高沟通质量”。对当前用户来说，高频场景不是只有搜索历史，而是每天在会议、群聊、Jira、AI coding 工具选型和项目协调中快速切换。情景演练室正好服务这个真实工作流。

## 本次输入信号

### Reminder 检查

本次尝试检查本机 Reminders 的 `Personal AI` 列表：

- AppleScript 查询 Reminders 时卡住，未返回列表。
- Reminders 本地 SQLite 目录位于 `~/Library/Group Containers/group.com.apple.reminders`，但当前进程被 macOS 隐私权限拒绝访问。
- 本机没有可用的 `reminders`/`icalBuddy` CLI，Spotlight 也没有检索到 `Personal AI` reminder 内容。

因此本次无法可靠读取 Reminders 中是否存在全新 idea。按任务要求，进入“结合项目目标、用户场景、记忆与行业信息主动构思”的分支。

### 远端记忆查询

本次按要求连接 `10.32.56.212` 查询 `esone.qiu` 的记忆：

- `10.32.56.212:3210` TCP 可连接。
- `GET /`、`GET /health`、`GET /api/v1/health`、`GET /api/v1/stats`、`POST /api/v1/recall`、`POST /api/v1/ask` 均在 5-20 秒内无响应超时。
- `10.32.56.212:22` TCP 可连接，但当前非交互 SSH 无法认证，不能只读查询远端文件。

所以本次没有拿到新的远端记忆内容。为避免编造，下面只使用本地项目文档、前次 automation 已落盘的记忆信号和本次公开资料调研。前次 progressing 文档中已记录的用户画像信号包括：Esone Qiu 是 Scrum Master，时区 Asia/Shanghai，高频关注 AI coding 工具选型、Codex/Claude Code/Cursor/Factory.ai 试用、Jira 数据分析、会议沉淀、RingClaw / Meeting Pilot / Nova / Rooms 等项目推进，以及“信息散在消息、会议、网页、AI 工具、Jira 中，回到某个事项时难以快速恢复上下文”的痛点。

### 自动化历史避让

`docs/progressing` 已有三个近期新能力方案：

- `cross-ai-memory-capsule-plan.md`：跨 AI 记忆胶囊交接台。
- `decision-time-machine-plan.md`：个人决策记忆回放台。
- `personal-skill-foundry-plan.md`：个人技能炼金台。

本次刻意避开这三条主线。Memory Rehearsal Studio 可以调用它们，但核心对象不同：

- 不是跨 AI 交接包，而是**进入真实沟通前的演练空间**。
- 不是回放过去决策，而是**模拟未来对话分支**。
- 不是沉淀可复用技能，而是**把记忆转化为即将发生的会议/聊天准备**。

## 为什么要做

Personal AI 已经在朝“记住消息、网页、会议、AI 对话、偏好、skill、操作轨迹”的方向建设。但真实用户每天最常遇到的不是“我想搜索一段历史”，而是：

1. **进入会议前要快速恢复上下文**
   - 这个项目上次谁承诺了什么？
   - 哪些前提最近变了？
   - 哪些人会关心成本、时间、风险或 owner？

2. **重要沟通很难临场组织语言**
   - Scrum Master / 项目协调者经常要在工具选型、进度风险、责任调整、跨团队 handover 中做简洁回应。
   - AI 可以给摘要，但摘要不能让用户提前体验对方追问、反对、沉默或跑题。

3. **会议工具大多只在会中/会后有用**
   - 纪要、action items、transcript Q&A 有价值，但用户真正能影响结果的时间点往往是会前 5-15 分钟。

4. **平台 AI 不知道用户的跨平台真实记忆**
   - Microsoft Copilot 能基于 M365 权限做 meeting prep。
   - Granola 能把会议历史接给 Claude/ChatGPT。
   - LinkedIn/Salesforce 能做通用 role play 或销售训练。
   - 但它们通常不知道用户在 RingCentral、Jira、Codex、Claude Code、网页研究、个人偏好、历史会议之间形成的完整私有上下文。

5. **用户需要的是“带证据的准备”，不是 AI 自信预测**
   - 如果 AI 说“Gary 可能会问成本”，用户必须能看到这个判断来自哪些消息、会议、网页或历史决策。
   - 如果证据不足，系统应该明确显示“低信心”，而不是编造人物性格。

Memory Rehearsal Studio 要解决的是：

> 在用户进入重要沟通前，Personal AI 先把相关记忆组织成一个可演练的未来场景，让用户提前试一轮，带着证据和答案进入真实会议。

## 行业观察

### 会议助手正在从“记录”走向“会前准备”

Microsoft 365 Copilot 已经提供 `Prepare for your meeting`，会在 Outlook/Teams 等入口基于相关内容、任务、文档和资源生成 meeting insights，并强调只使用用户有权限访问的内容。参考：[Prepare for your meeting with Copilot](https://support.microsoft.com/en-us/topic/prepare-for-your-meeting-with-copilot-f23326fc-7721-45f1-875e-23e77aaf3d89)。

启发：

- 会前准备是办公 AI 的主战场之一。
- 但 Copilot 主要受限于 Microsoft 365 内容域；Personal AI 的优势是跨聊天、网页、Jira、AI coding、会议、本机操作的个人统一记忆。

### 会议记录产品正在变成 AI 上下文源

Granola 的 MCP 让 Claude、ChatGPT 和其他 AI 工具连接会议笔记，支持搜索会议、查 action items、读取 transcript、提取决策等。参考：[Granola MCP](https://docs.granola.ai/help-center/sharing/integrations/mcp)。

启发：

- 会议历史正从“人读的笔记”变成“AI 可查询的上下文层”。
- Personal AI 不应只提供会议搜索，而应把会议历史进一步用于会前推演、会中提示和会后校准。

### AI role play 已被验证为高价值体验，但大多缺少真实个人记忆

LinkedIn Learning 的 AI-powered role play 支持用户用文字或语音练习工作场景，系统会动态回应并给反馈；官方 FAQ 同时说明当前不能引用过去 role play 结果，个性化主要基于用户姓名。参考：[LinkedIn Learning Role Play FAQ](https://www.linkedin.com/help/learning/answer/a7118820)。

Salesforce Einstein Coach / Agentforce Sales Coach 让销售人员在真实客户互动前练习 pitch 或 role-play，并获得个性化反馈。参考：[Salesforce Einstein Coach](https://help.salesforce.com/s/articleView?id=sf.enablement_einstein_coach_parent.htm&language=en_US&type=5)。

Hyperbound 这类销售训练产品也在强调“用真实 calls 和 buyer 场景构造 AI roleplay”。参考：[Hyperbound Practice](https://www.hyperbound.ai/product/hyperbound-practice)。

启发：

- “练习真实对话”已经被市场验证。
- 但这些产品要么是通用软技能训练，要么是销售垂直场景。Personal AI 的差异点是：它可以使用用户自己的会议、聊天、网页和项目记忆，为具体的人、具体的项目、具体的下一场会议生成演练。

### 论文支持“记忆 + 反思 + 计划”的行为模拟

Generative Agents 提出用自然语言长期记忆、反思和动态检索来生成可信行为，并明确提到这类代理可用于 interpersonal communication rehearsal。参考：[Generative Agents](https://arxiv.org/abs/2304.03442)。

2024 年的个人行为模拟研究使用长访谈和问卷构建 person-specific generative agents，说明 rich self-report data 能提升对个体态度和行为的模拟能力。参考：[LLM Agents Grounded in Self-Reports](https://arxiv.org/abs/2411.10109)。

Rehearsal 系统研究了用 LLM 模拟冲突对话，让用户探索 counterfactual paths 并接受反馈。参考：[Rehearsal: Simulating Conflict to Teach Conflict Resolution](https://arxiv.org/abs/2309.12309)。

Memory management 研究提醒：LLM agent 会出现 experience-following property，相似输入容易复用相似历史输出；这既有用，也可能导致错误传播和过期经验误用。参考：[How Memory Management Impacts LLM Agents](https://arxiv.org/abs/2505.16067)。

2026 agent memory survey 把 memory 抽象为 write-manage-read loop，并把 contradiction handling、latency budget、privacy governance 视为工程现实。参考：[Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670)。

对本功能的启发：

- 可以用“人物记忆 + 历史行为 + 当前项目事实”构造演练代理。
- 必须显示证据和置信度，避免把模拟当预言。
- 会后要校准预测，防止错误人物模型不断被强化。
- 需要把 privacy 和 profiling 风险作为核心产品设计，而不是后补安全文档。

## 产品定位

### 功能名

**Memory Rehearsal Studio / 记忆情景演练室**

### 一句话产品承诺

> 在重要会议和对话发生前，Personal AI 用你的真实记忆搭一个未来沙盘，让你先练一遍。

### 目标用户

第一目标用户就是当前 Personal AI 的真实使用者：

- Scrum Master / 项目协调者 / 技术负责人。
- 每天在 RingCentral 消息、Jira、会议、网页资料、Codex/Claude/ChatGPT/Cursor/Factory.ai 之间切换。
- 经常要对齐项目状态、协调 owner、讨论风险、推动工具选型、解释数据和会议结论。
- 需要在有限时间内快速进入状态，而不是翻聊天记录和纪要。

### 不做什么

- 不做通用心理咨询或情感操控工具。
- 不替用户自动发送敏感消息。
- 不把“某人会怎么想”当确定事实。
- 不在没有证据时推断人的人格、动机或立场。
- 不复刻 LinkedIn/Salesforce 的通用 role-play 训练；Personal AI 的核心差异是“具体个人 + 具体项目 + 具体下一场沟通 + 可追溯证据”。

## 核心用户场景

### 场景 1：会前 5 分钟快速恢复状态

用户日历上有 `AI Coding Tools Vote Follow-up`。打开会议前，Personal AI 弹出：

- 会议目标：确认 Codex / Claude Code / Factory.ai 试用后下一步。
- 相关人：Gary、Sophia、团队成员。
- 历史事实：Factory.ai trial 已获安全审批；团队讨论过 Cursor 成本；Gary 请求快速投票。
- 可能追问：成本、生产项目可用性、迁移影响、谁来维护规则/skill。
- 建议回应：30 秒版、2 分钟版、带数据版。

用户点 `Rehearse hard mode`，系统模拟 Gary 追问“为什么不继续 Cursor”，用户练习回应，系统用历史证据提醒哪些点漏掉了。

### 场景 2：重要 1:1 前做人物上下文恢复

用户即将和某位 stakeholder 1:1。系统按证据显示：

- 最近 30 天双方讨论过的项目。
- 对方公开表达过的关注点。
- 尚未关闭的承诺。
- 过去对方常问的问题类型。
- 需要避免的误区：把未确认信息当结论、忘记更新某个 action owner。

系统提供三轮演练：

- `status update`
- `risk escalation`
- `ask for decision`

每轮结束后给出回应建议和缺失证据。

### 场景 3：会议中无缝接入 Meeting Pilot

会前演练生成的 `Rehearsal Brief` 可以 handoff 给 Meeting Pilot：

- 会中右侧提示只显示 3-5 个关键 cues。
- 当 transcript 触发相关问题时，提示对应证据。
- 如果真实会议出现了演练没覆盖的新问题，系统标记为 `surprise`，会后用于校准。

### 场景 4：会后校准人物和项目记忆

真实会议结束后，系统对比：

- 演练预测的问题 vs 真实问题。
- 建议回应 vs 用户实际回应。
- 哪些风险被验证。
- 哪些预测错误或证据不足。
- 哪些人物关注点应写入长期画像，哪些只保留为本次会议观察。

这一步很关键：Memory Rehearsal Studio 不是为了“预测别人”，而是为了让 Personal AI 的记忆系统持续变准。

## 核心概念

### Rehearsal Session

一次具体的演练对象，绑定某个即将发生的会议、消息回复、Jira review、AI 工具评审或高风险沟通。

```ts
interface RehearsalSession {
  id: string;
  userId: string;
  title: string;
  scenarioType: 'meeting' | 'one_on_one' | 'message_reply' | 'jira_review' | 'ai_tool_review' | 'handover';
  status: 'draft' | 'brief_ready' | 'rehearsing' | 'handoff_ready' | 'calibrated' | 'archived';
  sourceEvent?: {
    provider: 'calendar' | 'meeting_pilot' | 'manual' | 'message_thread' | 'jira' | 'webpage';
    externalId?: string;
    startsAt?: number;
    url?: string;
  };
  participants: SimulatedParticipant[];
  goals: string[];
  evidencePackId: string;
  brief: RehearsalBrief;
  simulations: SimulationRun[];
  calibration?: RehearsalCalibration;
  privacyLevel: 'normal' | 'sensitive' | 'restricted';
  createdAt: number;
  updatedAt: number;
}
```

### Simulated Participant

不是“人格判断”，而是一个有证据边界的沟通代理。

```ts
interface SimulatedParticipant {
  personEntityId?: string;
  displayName: string;
  roleLabel?: string;
  evidenceStatus: 'enough' | 'thin' | 'missing';
  likelyConcerns: Array<{
    concern: string;
    confidence: number;
    evidenceRefs: string[];
  }>;
  communicationNotes: Array<{
    note: string;
    confidence: number;
    evidenceRefs: string[];
    scope: 'meeting_specific' | 'project_pattern' | 'long_term';
  }>;
  redactionFlags: string[];
}
```

### Rehearsal Brief

用户进会前最常用的输出。

```ts
interface RehearsalBrief {
  objective: string;
  thirtySecondAnswer: string;
  likelyQuestions: RehearsalQuestion[];
  riskMoments: RehearsalRisk[];
  missingFacts: MissingFact[];
  suggestedAgenda: string[];
  doNotForget: string[];
  evidenceCards: EvidenceCard[];
  confidence: number;
}
```

### Simulation Run

一次交互式演练。它可以是文字，也可以未来扩展成语音。

```ts
interface SimulationRun {
  id: string;
  mode: 'quick_questions' | 'hard_mode' | 'stakeholder_roundtable' | 'conflict_resolution';
  turns: SimulationTurn[];
  coachNotes: CoachNote[];
  score: {
    evidenceUse: number;
    clarity: number;
    directness: number;
    riskHandling: number;
    nextStepClosure: number;
  };
  createdAt: number;
}
```

### Calibration

真实会后校准，防止“错误记忆反复强化”。

```ts
interface RehearsalCalibration {
  actualMeetingId?: string;
  matchedPredictions: string[];
  missedQuestions: string[];
  falsePredictions: string[];
  usefulCues: string[];
  memoryUpdates: Array<{
    type: 'participant_concern' | 'project_fact' | 'decision' | 'follow_up' | 'discard';
    proposedText: string;
    evidenceRefs: string[];
    requiresUserConfirmation: boolean;
  }>;
  calibrationScore: number;
}
```

## 关键体验设计

### 1. Upcoming Rehearsals

入口可以放在：

- 扩展 popup。
- Meeting Pilot shell。
- Memory Exploring 页面。
- 日历/会议页面右侧浮层。
- ChatGPT/Claude/Codex/豆包页面的 context panel。

列表按“值得准备程度”排序，不是简单按时间排序：

- 会议重要性。
- 参与人数量和级别。
- 最近是否有冲突/变更/承诺。
- 是否有未关闭 action items。
- 是否和用户当前高关注项目相关。

### 2. Evidence-First Brief

Brief 不能像普通 AI 摘要一样只给结论。每个建议都要有证据状态：

- `3 sources`：来自多条消息/会议/网页。
- `changed`：相关前提最近更新。
- `thin evidence`：证据薄，不建议强推。
- `needs confirmation`：需要用户确认才能写入长期记忆。

用户点开任何一条，都能看到来源：

- 原始消息片段。
- 会议 transcript 片段。
- Jira / 网页链接。
- AI 对话 excerpt。
- 决策 episode / memory capsule 引用。

### 3. Rehearse Modes

初版不需要做复杂语音，先做文字交互即可。

推荐四个模式：

- `Quick Questions`：系统抛 5 个最可能问题，用户口头或文字回答。
- `Hard Mode`：模拟对方质疑成本、owner、风险、时间线。
- `Roundtable`：多参与者轮流追问，适合项目同步。
- `Conflict Path`：处理冲突/反对意见，参考 Rehearsal 论文的 counterfactual path 思路。

每轮后给出三类反馈：

- `Use evidence`：你可以补哪条历史证据。
- `Tighten answer`：如何缩短到 30 秒。
- `Close next step`：怎么落到 owner/date/decision。

### 4. Meeting Pilot Handoff

演练结果不要停在页面里。进入真实会议时，系统把 brief 压缩成 live cues：

- 3 个目标。
- 5 个可能问题。
- 3 条证据。
- 2 个不要忘。
- 1 个要拿到的 decision / owner / date。

Meeting Pilot 可以在 transcript 命中相似问题时显示对应 cue。这样会前演练和会中辅助连接起来。

### 5. After-Meeting Calibration

会后生成一张 calibration receipt：

- `Predicted and happened`
- `Predicted but did not happen`
- `Missed`
- `Useful cue`
- `Should update memory?`

用户只需要确认少量高价值更新。系统不应把所有模拟内容都写入长期记忆。

## 产品亮点

1. **把记忆变成未来沙盘**
   - 搜索和摘要是看过去；情景演练是用过去准备未来。

2. **具体到人和项目，但不装作读心**
   - 所有“对方可能关心什么”都绑定证据和置信度。

3. **会前、会中、会后闭环**
   - 会前演练。
   - 会中提示。
   - 会后校准。
   - 校准后反哺人物模型、项目状态和决策记忆。

4. **比通用 role play 更贴近真实**
   - 不是“练习和老板谈薪资”这种泛场景，而是“明天 Gary 可能会追问 Factory.ai trial 后下一步怎么落地”。

5. **帮用户把碎片记忆转成沟通表现**
   - 用户最需要的不是更多信息，而是在关键时刻说出正确、简洁、有证据的话。

## 与既有方案的关系

| 既有能力 | 关系 | 不重复的边界 |
|---|---|---|
| Cross-AI Memory Capsule | Rehearsal brief 可以导出为 capsule 给 ChatGPT/Claude/Codex 继续打磨 | Capsule 是上下文交接，Rehearsal 是未来沟通演练 |
| Decision Time Machine | Rehearsal 会引用决策 episode 作为证据 | Decision 是过去的判断回放，Rehearsal 是即将发生的对话准备 |
| Personal Skill Foundry | 演练中反复成功的沟通套路可沉淀成 skill | Skill Foundry 管长期技能，Rehearsal 管具体下一场沟通 |
| Meeting Pilot | 会中消费 rehearsal handoff | Meeting Pilot 是 live surface，Rehearsal 是 pre-meeting surface |
| Proactive Notification | 可以提醒“这场会值得准备” | Notification 是触达机制，Rehearsal 是准备体验 |

## 信息架构

### 页面布局

建议新建一个 `Rehearsal Studio` 页面：

- 左侧：Upcoming / 最近值得演练的会议和对话。
- 中间：Brief / 目标、可能问题、风险、缺失事实、证据。
- 右侧：Live Rehearsal / 模拟对话、回答草稿、coach notes。
- 底部或抽屉：Calibration / 会后对比和记忆更新。

### 关键控件

- 场景模式 segmented control：`Brief` / `Questions` / `Hard Mode` / `Roundtable` / `Calibration`。
- 时间预算：`2 min` / `5 min` / `15 min`。
- 风格控制：`Concise` / `Evidence-heavy` / `Diplomatic` / `Direct`。
- 隐私范围：`Work only` / `Project only` / `Exclude personal profile`。
- 输出按钮：
  - `Copy 30s brief`
  - `Send to Meeting Pilot`
  - `Create follow-up draft`
  - `Save rehearsal receipt`

## 后端设计

### 新增核心服务

```ts
class RehearsalService {
  listUpcomingRehearsalCandidates(userId: string): Promise<RehearsalCandidate[]>;
  createSession(input: CreateRehearsalSessionInput): Promise<RehearsalSession>;
  buildEvidencePack(sessionId: string): Promise<RehearsalEvidencePack>;
  generateBrief(sessionId: string): Promise<RehearsalBrief>;
  runSimulationTurn(input: SimulationTurnInput): Promise<SimulationTurnResult>;
  renderMeetingPilotHandoff(sessionId: string): Promise<MeetingPilotRehearsalHandoff>;
  calibrateFromMeeting(sessionId: string, meetingId: string): Promise<RehearsalCalibration>;
}
```

### 复用现有能力

- `RecallEngine`：召回消息、chunks、实体、时间线。
- `ContextRecallService`：快速获取当前会议/网页/消息线程的被动上下文。
- `TruthMaintainer`：识别前提变化和冲突事实。
- `ProviderContextService`：把 rehearsal brief 渲染成目标 AI 可读上下文。
- Meeting routes / Meeting Pilot persistence：绑定真实会议 transcript。
- `profile/items`：读取用户偏好和人物相关记忆，但必须加证据和权限控制。

### 推荐 API

```http
GET  /api/v1/rehearsals/candidates?surface=meeting_pilot
POST /api/v1/rehearsals
GET  /api/v1/rehearsals/:id
POST /api/v1/rehearsals/:id/evidence-pack
POST /api/v1/rehearsals/:id/brief
POST /api/v1/rehearsals/:id/simulation-turn
POST /api/v1/rehearsals/:id/handoff/meeting-pilot
POST /api/v1/rehearsals/:id/calibrate
POST /api/v1/rehearsals/:id/feedback
```

### Candidate 发现规则

候选评分：

```ts
candidateScore =
  meetingImportance * 0.25 +
  participantNoveltyOrSeniority * 0.15 +
  openCommitmentCount * 0.15 +
  recentFactChangeCount * 0.15 +
  decisionDensity * 0.10 +
  conflictOrRiskSignals * 0.10 +
  userManualInterest * 0.10
```

初版可以只做简单规则：

- 今天/明天会议。
- 标题命中高关注项目或 AI 工具。
- 参与人出现在近期重要消息中。
- 过去 14 天相关实体有未关闭 action items。
- 相关 decision episode 状态为 `revisit_needed` 或 `active`。

## 检索与生成策略

### Evidence Pack 构建

按层级取上下文，避免一上来塞满：

1. `source event context`
   - 会议标题、参与人、时间、相关链接、Jira issue、当前消息线程。

2. `recent direct interactions`
   - 参与人 + 项目实体 + 最近 30 天。

3. `project state`
   - 项目实体、Jira、网页记忆、会议结论、action items。

4. `decision memory`
   - 相关决策 episode、变更前提、风险。

5. `user preferences`
   - 输出风格、会议偏好、沟通习惯。

6. `negative evidence`
   - 明确过期、冲突、未确认的信息。

### 生成约束

所有模拟参与者必须遵守：

- 只能基于 evidence pack 和会议当前上下文发言。
- 对薄证据只能说“可能会关心”，不能说“他一定会”。
- 不推断敏感属性、私人动机、心理状态。
- 不模拟侮辱、操控、歧视性表达。
- 不把用户的私人记忆泄露给其他参会人的模拟视角。

### Prompt 骨架

```text
You are running a rehearsal for an upcoming work conversation.
You are not predicting the future. You are generating plausible questions and branches grounded in evidence.

Inputs:
- User goal
- Meeting metadata
- Evidence pack with source ids and confidence
- Participant public/work-context notes
- Known changed assumptions

Rules:
- Every likely question must cite evidence ids or mark thin_evidence.
- Do not infer hidden motives or sensitive traits.
- Keep the user coach practical and concise.
- Prefer action closure: owner, date, decision, next step.
```

## UI Demo 说明

Demo 文件：[`memory-rehearsal-studio-demo.html`](./memory-rehearsal-studio-demo.html)

原型体现三个核心交互：

1. 左侧选择即将发生的会议/对话。
2. 中间查看 evidence-first brief：目标、可能追问、风险、缺失事实、证据。
3. 右侧进行文字演练，并把结果 handoff 给 Meeting Pilot。

Demo 是纯静态 HTML/CSS/JS，可直接用浏览器打开，不需要启动 dev server。

## 实施计划

### Phase 0：Prototype / 设计验证

目标：验证交互是否足够清晰。

产物：

- 静态 HTML demo。
- 3 个真实风格 mock scenario。
- 用户评审问题：
  - 会前 5 分钟是否愿意打开？
  - 哪些卡片最有用？
  - 模拟追问是否让人感觉有价值而不是烦？

### Phase 1：Evidence-First Brief

目标：先不做对话演练，只做会前 brief。

范围：

- 新增 `RehearsalCandidate` 规则。
- 复用 `recall` / `context-recall` 构建 evidence pack。
- 生成 `RehearsalBrief`。
- 在 Meeting Pilot / popup 展示 brief。

验收：

- 对至少 5 个近期会议生成 brief。
- 每条 likely question 都有 evidence 或 `thin evidence` 标签。
- 生成时间目标：P50 < 8s，P95 < 20s。

### Phase 2：Interactive Rehearsal

目标：支持文字版演练。

范围：

- `simulation-turn` API。
- `Quick Questions` 和 `Hard Mode` 两种模式。
- 回答 coach notes。
- 保存 rehearsal transcript。

验收：

- 用户可以完成 3-5 轮演练。
- 每轮反馈包含 evidence use、clarity、next step closure。
- 不把模拟内容默认写入长期记忆。

### Phase 3：Meeting Pilot Handoff

目标：把会前演练带入真实会议。

范围：

- `handoff/meeting-pilot` endpoint。
- Meeting Pilot 读取 live cues。
- transcript 命中时显示 cue。
- 会中标记 `used`、`ignored`、`surprise`。

验收：

- 会中不遮挡主流程。
- live cues 不超过 5 条。
- 用户可一键关闭。

### Phase 4：After-Meeting Calibration

目标：让系统越用越准。

范围：

- 对比 rehearsal 与 transcript。
- 生成 calibration receipt。
- 提议更新人物关注点、项目事实、decision/action items。
- 需要用户确认后写入长期记忆。

验收：

- 至少输出 matched / missed / false prediction。
- 对敏感人物画像更新必须进入确认队列。
- 可查看“为什么更新/为什么丢弃”。

### Phase 5：Voice Rehearsal / Advanced

目标：如果文字版有效，再考虑语音。

范围：

- 利用桌面 app whisper 能力录音转写。
- 支持 push-to-talk。
- 给语速、停顿、冗长程度反馈。

暂缓原因：

- 语音权限和隐私成本高。
- 初期文字版已经能验证核心价值。

## 数据库变更建议

```sql
CREATE TABLE rehearsal_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  status TEXT NOT NULL,
  source_event_json TEXT,
  participant_json TEXT NOT NULL,
  goals_json TEXT NOT NULL,
  evidence_pack_id TEXT,
  brief_json TEXT,
  privacy_level TEXT NOT NULL DEFAULT 'normal',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE rehearsal_evidence_packs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  negative_evidence_json TEXT,
  generated_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES rehearsal_sessions(id)
);

CREATE TABLE rehearsal_simulation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  turns_json TEXT NOT NULL,
  coach_notes_json TEXT,
  score_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES rehearsal_sessions(id)
);

CREATE TABLE rehearsal_calibrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  actual_meeting_id TEXT,
  matched_predictions_json TEXT NOT NULL,
  missed_questions_json TEXT NOT NULL,
  false_predictions_json TEXT NOT NULL,
  memory_updates_json TEXT NOT NULL,
  calibration_score REAL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES rehearsal_sessions(id)
);
```

索引：

```sql
CREATE INDEX idx_rehearsal_user_status ON rehearsal_sessions(user_id, status);
CREATE INDEX idx_rehearsal_user_created ON rehearsal_sessions(user_id, created_at DESC);
CREATE INDEX idx_rehearsal_source_event ON rehearsal_sessions(user_id, json_extract(source_event_json, '$.externalId'));
```

## 前端集成点

### Extension Popup

新增一个轻量入口：

- `Today`
- `Worth rehearsing`
- `Start 5-min prep`

### Meeting Pilot

新增：

- 会前 `Prep` tab。
- 会中 `Rehearsal cues` sidebar。
- 会后 `Calibration` receipt。

### Memory Exploring

新增：

- 某个人 / 项目 / 决策页里可以点 `Rehearse next conversation`。

### Content Script

在 Calendar / Teams / Google Meet / RingCentral meeting 页面识别 meeting context，显示非打扰提示：

- `3 useful memories for this meeting`
- `Rehearse`
- `Dismiss`

## 安全与隐私

### 风险 1：人物画像越界

问题：系统可能把工作上下文中的行为误读成人格、动机或私人倾向。

策略：

- 字段命名用 `likelyConcerns`、`communicationNotes`，不用 `personality`、`attitude`。
- 每条都绑定证据、时间范围、scope。
- 敏感推断禁止写入。
- 长期人物记忆更新必须用户确认。

### 风险 2：模拟被误认为事实

问题：用户可能把“模拟提问”当作对方真实想法。

策略：

- UI 明确区分 `Evidence`、`Hypothesis`、`Simulation`。
- 默认显示置信度和 `thin evidence`。
- 会后 calibration 标记预测准确性。

### 风险 3：泄露用户私人记忆

问题：模拟不同参与者时，不应让“对方代理”知道用户的私人偏好或其他人的私密信息。

策略：

- 每个 participant agent 只拿该角色可见的工作上下文。
- 用户 coach 可以看到用户自己的私有上下文，但输出给 meeting handoff 时脱敏。
- `privacyLevel=restricted` 时禁用 roleplay，只提供事实 brief。

### 风险 4：过度准备造成打扰

问题：每天会议很多，不能每个会都推演。

策略：

- 只对高分候选提示。
- 默认 2 分钟 brief。
- 用户可以对某类会议永久降低权重。

## 关键问题补充：会议数据源、触发策略与展示位置

### 会议数据从哪里读取

建议按“稳定性 + 权限成本 + 上下文丰富度”分成四层，不押注单一来源：

1. **RingCentral Web 本地数据 / app.ringcentral.com IndexedDB**
   - 当前仓库已经有一条早期路径：`src/metadata/calendar.ts` 会读取 `Calendar` 数据库的 `event2` store，并转成 `subject / description / startTime / endTime / attendees / organizer`。
   - 这说明 Personal AI 过去已经假设 RingCentral Web 里有可读的 calendar event cache。
   - 优点：和用户实际打开的 `https://app.ringcentral.com/video/home/` 场景最贴近；也能和 Glip message context 同源串起来。
   - 风险：这是 Web App 内部缓存结构，字段名和 store 可能随 RingCentral 版本变化，需要做 capability probe 和 fallback。

2. **Exchange / Microsoft Graph 授权**
   - 如果用户能提供 Exchange/Microsoft 365 授权，推荐走 Microsoft Graph，而不是 EWS。Microsoft 官方建议 Exchange Online 应用迁移到 Graph；Graph 用 OAuth 2.0，并有更细粒度权限。
   - 获取 upcoming meeting 应优先用 `calendarView`，因为它会展开 recurring series 的 occurrences / exceptions。
   - 最小权限：
     - `Calendars.ReadBasic` 可读基础事件，但不含 body、attachments、extensions。
     - 若要读取 agenda/description/body、attendees、online meeting、location 等完整准备材料，实际需要 delegated `Calendars.Read`。
   - 产品上应把这做成可选 connector：用户授权后，Memory Service 定时同步未来 7-14 天和最近 30 天事件，保留 event id / iCalUId / seriesMasterId，避免重复导入 recurring events。

3. **macOS Calendar / EventKit 本地读取**
   - 本次本机验证结果：`~/Library/Calendars` 被 macOS 隐私权限拒绝，不能直接读 SQLite；AppleScript 可以读到日历列表，但全量 event 查询不稳定；Swift/EventKit 显示当前进程有 calendar full-access 状态 raw=4，但只看到 1 个 calendar 且 ±180 天事件数为 0。
   - 结论：本机 Calendar 作为辅助来源可行，但不建议作为 MVP 主路径。真正产品化需要 Desktop App 用 EventKit、带 `com.apple.security.personal-information.calendars` entitlement，并显式请求 full access。

4. **用户手动补充会议目标**
   - 必须保留。很多 daily / recurring meeting 的 event title 和 description 没有上下文，只靠日历无法知道今天要同步哪个依赖。
   - UI 应提供一个轻量输入：`这场会你想准备什么？`，并给自动建议，例如“同步 X dependency progress”“追 Y owner/date”“复盘 AI tool pilot”。

### 哪些会议需要会前准备

不应该每个会议都做完整准备。建议分三档：

| 档位 | 触发 | 体验 |
|---|---|---|
| Full rehearsal | 高风险/高价值会议：新参与人、决策、handover、工具选型、冲突、未关闭 owner/date、近期事实变化 | 生成完整 brief + quick questions / hard mode |
| Compact cues | recurring daily / weekly sync，但近期记忆中有相关依赖、阻塞、承诺、Jira 变更 | 只显示 3-5 条 cue，不进入演练 |
| Silent | 低信息会议、无相关记忆、用户已多次忽略同类会议 | 不主动提示，仅保留手动入口 |

Daily 会议默认不需要完整会前准备，但**需要 compact cues**。例如 Glip 里昨天讨论了某个 dependency progress，event description 里没有写，这时 daily meeting 仍然应该提示：“今天可能要同步 X 依赖，相关讨论来自 Y 群消息，owner 是 Z，最新状态是 blocked/updated”。

候选评分应加入：

```ts
prepScore =
  eventImportance * 0.15 +
  openCommitmentCount * 0.20 +
  recentDependencyMentions * 0.20 +
  decisionOrHandoverSignals * 0.15 +
  participantNovelty * 0.10 +
  userProvidedGoal * 0.15 +
  userSuppressionPenalty * -0.20;
```

### 整理信息展示在哪里

用户建议的 `https://app.ringcentral.com/video/home/` 是合理的 MVP 展示位置。

本次用 `webpage-mcp` 检查：

- 浏览器中已有 RingCentral 页面；后来路径变成 messages，因此另开了一个 `https://app.ringcentral.com/video/home/` 标签做检查。
- `chrome_network_request` 可取到 RingCentral SPA HTML，确认页面是 `#root` 挂载的 React/Web SPA，CSP 较严格。
- `chrome_screenshot` 可正常截取页面。
- `chrome_javascript` 在当前环境因 debugger/extension 限制报 `Cannot access a chrome-extension:// URL of different extension`，所以本次没有拿到 DOM snapshot。
- 现有 `src/manifest.json` 已经让 `contentScriptGlip.js` 匹配 `https://app.ringcentral.com/*`，所以扩展具备在 video home 页面注入 overlay 的权限基础。

实现建议：

- 不把逻辑塞进现有 `contentScriptGlip.tsx`，新增 `contentScriptRingCentralVideoHome.tsx` 或拆出 `ringcentral-home-prep` 模块。
- 匹配 `https://app.ringcentral.com/video/home/*` 和可能的无 suffix 路径。
- 用 isolated world 创建 Shadow DOM overlay，不依赖页面内部 React 组件。
- 不向 page world 注入外部 script，避免被 RingCentral CSP 卡住。
- 默认展示为右侧窄 panel 或会议卡片旁的 `Prep` drawer，避免遮挡 RC 原生 meeting list。

### 上下文来源与 recurring 会议处理

会议 agenda/description 算上下文，但只能作为第一层 seed，不够。

Rehearsal context 应由这些 seed 合并生成：

1. Calendar seed：subject、description/body、time、organizer、attendees、location、join URL、recurrence/series id。
2. User goal seed：用户手动输入的这场会议目标。
3. Participant seed：参会人最近互动、未关闭承诺、共同项目。
4. Project/entity seed：从 title/description/goal/participants 抽实体后召回相关 Glip、Jira、web、meeting、AI conversation 记忆。
5. Series seed：recurring meeting 的长期画像，包括这个系列常讨论什么、上次结论、上次 action items、哪些 topic 经常出现。
6. Live seed：如果用户已经在 RingCentral/Glip 当前聊天页，当前 thread 的最近消息可以作为额外 primary context。

Recurring meeting 不应每次当成全新会议。需要建立 `MeetingSeriesProfile`：

```ts
interface MeetingSeriesProfile {
  seriesKey: string; // Graph seriesMasterId / iCalUId / normalized title+attendees fallback
  titlePattern: string;
  participantEntityIds: string[];
  standingTopics: string[];
  recentEpisodes: string[];
  openActionItemIds: string[];
  ignoredCount: number;
  lastUsefulPrepAt?: number;
}
```

对 daily 的推荐体验：

- 默认只读 series profile + 最近 24-72 小时与 standing topics/participants 相关的 Glip/Jira/meeting 记忆。
- 如果用户输入目标，例如“今天要同步 xx dependency”，则提升为 compact/full prep。
- 如果 recurring event 的 description 为空，也不要放弃；用 series profile + recent dependency mentions 找 context。
- 如果连续多次用户忽略该 daily 的 prep，则降级为 silent，直到出现高风险信号或用户手动打开。

## 评估指标

### 产品指标

- 会前 brief 打开率。
- 演练完成率。
- 用户标记 `useful cue` 的比例。
- 会中 cue 被使用次数。
- 会后 calibration 中 matched predictions 比例。
- 用户准备时间是否下降。

### 质量指标

- Evidence coverage：每条 likely question 有证据的比例。
- Unsupported claim rate：无证据推断率。
- Calibration precision：预测命中率与误报率。
- Memory update acceptance：用户确认写入的比例。
- Latency：brief 生成耗时。

### 体验指标

- 5 分钟内是否能读完并进入会议。
- 卡片是否过多。
- 模拟追问是否真实但不过分冒犯。
- 用户是否愿意把 handoff 带入 Meeting Pilot。

## 测试计划

### 单元测试

- Candidate scoring。
- Evidence pack source filtering。
- Participant note privacy filtering。
- Brief schema validation。
- Calibration diff。

### 集成测试

- 从 mock calendar event 生成 rehearsal session。
- 从 recall mock items 生成 brief。
- simulation-turn 不产生无证据人物推断。
- handoff 输出符合 Meeting Pilot cue schema。
- calibration 只产生确认候选，不直接写敏感长期记忆。

### 人工验证

选 3 类真实风格场景：

- AI coding 工具选型 follow-up。
- 项目 handover / owner 变更。
- Jira 数据趋势 review。

每类检查：

- brief 是否能让用户快速进入状态。
- likely questions 是否贴近真实沟通。
- hard mode 是否有帮助。
- evidence 是否足够可追溯。

## 里程碑估算

| 阶段 | 时间 | 结果 |
|---|---:|---|
| Phase 0 demo + plan | 0.5-1 天 | 可评审原型 |
| Phase 1 evidence brief | 3-5 天 | 可在 popup/Meeting Pilot 展示会前 brief |
| Phase 2 text rehearsal | 4-6 天 | 可做文字演练 |
| Phase 3 Meeting Pilot handoff | 3-5 天 | 会中可消费 cues |
| Phase 4 calibration | 4-7 天 | 会后可校准并提议记忆更新 |
| Phase 5 voice rehearsal | 另行评估 | 依赖桌面 app/whisper 体验 |

## 推荐 MVP

最小可用版本不要先做“语音模拟真人”。建议做：

1. 在 Meeting Pilot / popup 里显示 `Worth rehearsing`。
2. 用户点开后生成 evidence-first brief。
3. 支持 `Quick Questions` 文字演练。
4. 支持 `Send to Meeting Pilot`。
5. 会后让用户标记 `useful / wrong / missed`，先积累 calibration 数据。

MVP 成功标准：

- 用户在真实会议前愿意打开。
- 5 分钟内能看完。
- 至少 30% 的 high-importance meeting brief 被用户标记为有用。
- 会后 calibration 能发现至少一条值得写回的事实或 follow-up。

## 最终判断

这个功能值得进入候选实现池。

原因：

- 它直接命中 Personal AI “在聊天、会议、其他 AI 对话中提供记忆关联提示”的核心目标。
- 它把记忆从“资料库”推进到“临场准备能力”，对真实用户更可感知。
- 它和已有 Meeting Pilot、memory-service recall、decision episode、provider context package 都能形成复用关系。
- 行业趋势已经验证 meeting prep、role play、memory layer 都是重要方向，但还没有产品很好地把“个人全域记忆 + 具体下一场沟通 + 证据优先演练 + 会后校准”打通。

如果只做一个新页面，我建议优先做 **Evidence-First Brief + Quick Questions**，先证明用户会在会前使用，再扩展到 hard mode、Meeting Pilot handoff 和 calibration。
