# 新能力：Meeting Outcome Binder / 会议结果装订器

> Codex 会话标题：`新能力：会议结果装订器`  
> 交付物：功能计划 + 集成式 Demo  
> 当前状态：仅规划，不做实现  
> Demo：[`meeting-outcome-binder-demo.html`](./meeting-outcome-binder-demo.html)

## 结论

建议设计 **Meeting Outcome Binder / 会议结果装订器**。

它不是再生成一份会议摘要，也不是自动创建外部任务。它是一个把 **会前议程 / 会中讨论 / 会后聊天与 Jira 变化 / 下一次会议准备** 装订成同一个可追踪记忆对象的能力。

核心价值：

1. 用户进会前知道“这场会原本要解决什么”。
2. 会议结束后知道“哪些已经有证据地解决，哪些只是讨论过，哪些需要带到下一次”。
3. 之后 Ask、Today Pilot、Meeting Pilot、Memory Lens、Compose Assist 再引用这场会时，不再只面对一段 transcript 或一堆 action items，而是面对一个源证据明确、状态可延续的 outcome bundle。

推荐 P0 做在现有 Meeting Pilot / Today Pilot / Ask 消费面里，不新增独立一级页面。

## 用户真实场景

### 场景 1：Q3 planning 会前 5 分钟，用户不想重新翻日历描述和聊天

1. 用户打开 RingCentral Video Home，看到今天的 `2026 Q3 planning for video mobile`。
2. Personal AI 在会议卡片下方显示一个小条：`本场要闭环 3 件事`。
3. 展开后看到：
   - `Dev/QA estimate 是否已填齐`
   - `容量是否超过 team capacity`
   - `风险/issue 是否需要今天抛出`
4. 每个目标旁边有来源：日历 description、近期 Gary 的 ballpark estimate 消息、Jira Q3 filter 结果。
5. 用户点 `带入会议侧栏`，Meeting Pilot 侧栏顶部出现 `本场要闭环`，但没有自动发言、没有写 Jira、没有创建任务。
6. 会后 Panorama 显示：
   - `2 个目标已闭环`，分别带 transcript / chat / Jira 证据；
   - `1 个目标未闭环`，建议作为下一次 planning 的 carry-over；
   - `复制跟进草稿` 只复制到本机剪贴板，不发送。

用户体验上的差异：

- Before：会前准备是一段摘要，会议行动项是一组列表，用户需要自己判断“这场会原本要解决的问题到底有没有解决”。
- After：会议被装订成一个 outcome object，Ask 和下次会前准备都可以直接复用它。

### 场景 2：第二天用户问 Ask “昨天 planning 估时口径定了吗？”

1. 用户在 Quick Ask 里问：`昨天 Q3 planning 估时口径定了吗？`
2. Ask 不只召回 transcript 片段，而是优先拿到 `meeting_outcome_binder`：
   - `已确认：Gary 说 ballpark estimate 先填入`
   - `未确认：是否所有 INIT 都已补齐 Dev/QA estimate`
   - `下一步：复查 Plans board / Q3 filter`
3. 答案首屏显示 `结果装订回执`：
   - 来源是某场会议的 outcome binder；
   - 当前只读；
   - 未自动写 Jira / Calendar / RingCentral；
   - 仍有一个 carry-over 未闭环。
4. 用户可以复制一段给群里的跟进话术，或者打开会后 Panorama 看证据。

## 本次输入信号

### Reminders 检查

本机 Reminders 通过 EventKit 可读到 `Personal AI` 列表：

- `PERSONAL_AI_LIST_COUNT 1`
- `PERSONAL_AI_TOTAL 4`
- `PERSONAL_AI_INCOMPLETE_COUNT 0`

因此本次没有从 Reminder 选择全新的未完成功能 idea，也不会标记 Reminder done 或写备注。

### Repo 去重

已检查：

- `AGENT.md`
- `docs/progressing/to-verify.md`，当前为 `暂无。`
- 自动化记忆 `${CODEX_HOME:-$HOME/.codex}/automations/automation-2/memory.md`
- `docs/features/index.md`
- 相关 progressing 计划标题和 Meeting / Today / Ask 文档片段

本计划刻意避开以下近邻：

| 已有能力 / 计划 | 已解决什么 | 本计划新增什么 |
|---|---|---|
| Today Pilot 会前准备 | 根据日历、记忆、关系、Rehearsal 给出会前上下文 | 把会前目标和会后结果绑定，形成可延续的 outcome object |
| Meeting Pilot | 会中 capture、实时提醒、行动项、Panorama、会议历史 | 用 agenda/outcome slot 判断这场会原本要解决的问题是否已解决 |
| Meeting Pilot 行动项复核 | 抽取 owner / deadline / evidence，支持确认、忽略、完成 | 不把所有 outcome 降级成任务；保留 decision、unresolved、carry-over、fact update 等状态 |
| Operation Memory Flight Recorder | 跨应用操作 episode，串联操作上下文 | 本计划只处理“会议目标 -> 会议结果 -> 下一次会议/Ask 复用”的会议闭环 |
| Memory Outcome Loop | 学习某条记忆提示是否被采用、忽略、失败 | 本计划不是反馈学习，而是会议内外证据的 outcome 装订 |
| Evidence Watch / Open Question Exit | 外部事实复核、开放问题生命周期 | 本计划只把会议目标装订成 outcome；未解决项可交给这些系统，但不替代它们 |
| Research Trail Synthesizer | 研究过程和 adopted/rejected sources | 本计划面向协作会议，不是研究轨迹 |
| Keystone Memory Briefs | 高信号跨源简报 | 本计划的粒度是一场会议和它的目标闭环，可被 Keystone Brief 消费 |
| Change Memory Ledger | old/new 字段变化链 | 本计划可以引用字段变化作为会后证据，但不负责解析所有变更 |
| Working Memory Return Stack（搁置） | 尝试恢复跨场景隐式意图 | 本计划依赖显式日历/会议对象，不猜测用户离开前意图 |

### 线上记忆服务信号

只读查询 `10.32.56.212:3210`，用户 `esone.qiu`：

- `/health` 可达但 degraded，health 中 `database.connected=false`。
- `/api/v1/stats` 返回约：
  - `messages.total = 11386`
  - `messages.thisWeek = 232`
  - `messages.last90Days = 3524`
  - `chunks.total = 10184`
  - `entities.total = 14186`
  - `relationships.total = 54683`
  - `confirmRequests.pending = 30`
  - active retrieval tier 约 `2630`
- `/api/v1/coverage/pressure`：
  - `actionsQueued = 113`
  - `confirmRequestsPending = 30`
  - `reflectionThreadsActive = 885`
  - `totalPressureItems = 1028`
- `/api/v1/coverage/messages-by-source`：
  - `calendar = 555`，近 7 天 `145`
  - `jira = 168`，近 7 天 `47`
  - `web = 149`，近 7 天 `39`
  - `meeting = 318`
  - `glip = 10023`

可用样本：

- 日历记忆中有 `2026 Q3 planning for video mobile`，description 明确写着 review scope、Dev/QA estimate、team capacity、monthly deliver goal、risk/issue。
- 近期 Glip/Jira 样本里反复出现 Q3 planning、Target Delivery Quarter、ballpark estimate、Plans board、INIT/Jira filter 等上下文。
- 当前 pressure/action/open-question 信号继续很重，但这些已经被 `Action Readiness Contracts`、`Open Question Exit Contract`、`Evidence Watch Contracts` 覆盖，不适合作为新 idea 再做一遍。

所以这次更有价值的缺口是：**日历和会议上下文已经很多，但系统缺少一个把会前意图和会后事实闭合起来的记忆对象。**

## 为什么值得做

### 1. 会议真正消耗用户精力的不是“有没有摘要”，而是“有没有闭环”

会议摘要已经是 AI 产品的标配。用户真正需要的是：

- 我原本进会是为了确认什么？
- 哪些已经确定？
- 哪些只是被提到？
- 哪些没有证据？
- 哪些应该下次继续问？
- 哪些可以喂给 Ask / Compose / Jira 跟进？

Meeting Outcome Binder 把这些问题变成结构化状态，而不是让用户每次重新读 transcript。

### 2. 它能让 Personal AI 的记忆从“记录发生了什么”升级为“知道协作有没有推进”

Personal AI 已经有消息记忆、会议记录、日历、Jira、source-memory、Ask、Today Pilot。缺的是把它们围绕同一场会议形成一个生命周期：

`会前目标 -> 会中证据 -> 会后结果 -> 下一次 carry-over`

这个 lifecycle 是私人记忆系统区别于通用会议工具的关键。

### 3. 它降低用户的二次整理成本

用户不需要再手工把日历议程复制到会议纪要、再把会议纪要拆成 Jira/Glip 跟进、再在下一次会议前回忆上次没闭环的点。

P0 只做只读装订和复制草稿，不做外部写入。这样既实用，也符合 Personal AI 的信任边界。

## 行业和研究参考

### Granola：会议前中后连续上下文，但重点仍是 note / action

[Granola](https://www.granola.ai/) 把自己定位成 back-to-back meetings 的 AI notepad，强调 before/during/after meeting 和 searchable memory。它的 AI note-taking 页面还提到会议决策可以推成 Linear / Jira / Asana 票据。

可借鉴点：

- 会议工具正在从“记录”走向“行动”。
- Personal AI 不应只做 transcript summarizer。

本计划的差异：

- Granola 更像会议笔记和 action-item 自动化；Meeting Outcome Binder 更关注私人记忆里的 agenda/outcome closure。
- P0 不直接写 Jira/Asana，避免把低置信 outcome 变成外部任务。

### Notion AI Meeting Notes：action items 可进入工作库

[Notion AI Meeting Notes](https://www.notion.com/product/ai-meeting-notes) 会生成会议 summary、decisions、action items，并让内容可在 workspace 中搜索。Notion 的 help 也强调 AI Meeting Notes 会识别 key points 和 action items。

可借鉴点：

- 会议内容要落在用户已有工作空间里，而不是孤立 transcript。
- 决策和行动项都应该可检索、可复用。

本计划的差异：

- Personal AI 面向私人跨平台记忆，不把 Notion workspace 当唯一真源。
- 结果装订会保留“未闭环 / 证据不足 / 带到下次”的状态，而不是只有 notes 和 tasks。

### Microsoft Teams Copilot Recap / Facilitator：会中会后 AI notes、tasks、open questions

Microsoft Teams 的 [Recap](https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams)、[Copilot catch-up](https://support.microsoft.com/en-us/teams/copilot/catch-up-on-meetings-with-microsoft-365-copilot-in-teams) 和 [Facilitator](https://support.microsoft.com/en-us/teams/copilot/facilitator-in-microsoft-teams-meetings) 都覆盖 key points、follow-up tasks、AI notes、open questions。

可借鉴点：

- open questions 和 follow-up tasks 是会议 AI 的核心输出。
- 会中和会后都需要消费同一套结构化记录。

本计划的差异：

- Teams 面向团队会议记录；Personal AI 需要私人视角：这场会对我今天、下一次会议、Ask、Jira 跟进有什么影响。
- Meeting Outcome Binder 用日历 agenda 和用户记忆做会前目标，不只从会议 transcript 中事后总结。

### 研究：会议 recap 仍缺个人相关性，action-item-driven summary 只是第一步

`Summaries, Highlights, and Action items` 研究指出 LLM meeting recap 对 highlights / hierarchical minutes 有价值，但仍会缺少个人相关性、遗漏细节，并且误归因会伤害协作动态：<https://arxiv.org/abs/2307.15793>。

`Action-Item-Driven Summarization of Long Meeting Transcripts` 说明 long transcript 可以围绕 action items 分段汇总，但这仍是 transcript 内部 summarization：<https://arxiv.org/html/2312.17581v2>。

`Dynamic agenda-aware real-time meeting summarization` 明确提出 agenda encoding、topic tracking、sliding window 和 memory mechanism 对实时会议总结有帮助：<https://link.springer.com/article/10.1007/s44443-025-00304-y>。

`Meetalk` 则强调 personalized meeting minutes 需要用户知识引导，否则 summary 缺少 faithfulness 和用户结构/风格：<https://aclanthology.org/2025.knowllm-1.9/>。

对本计划的启发：

- 不能只把 transcript 丢给 LLM 总结。
- 需要 agenda-aware。
- 需要 personalized memory context。
- 需要把用户在会后编辑/复制/忽略的行为作为质量信号，但 P0 不新增操作负担。

## 产品定义

### 核心对象：Meeting Outcome Binder

`MeetingOutcomeBinder` 是一个围绕单场会议生成的只读优先记忆对象。

它包含：

- 这场会的来源：calendar event、meeting session、Glip/Jira/source-memory 补充证据。
- 会前目标：从 calendar title/description、Today Pilot meeting prep、Rehearsal、近期项目上下文抽取。
- 会中/会后证据：transcript chapter、action item、decision、chat follow-up、Jira field change、web/source memory。
- outcome slots：每个目标当前是 `resolved`、`partially_resolved`、`unresolved`、`carried_over`、`blocked_by_missing_evidence`。
- carry-over：下一次会议、Today Pilot、Ask、Compose Assist 应该带入的未闭环点。
- receipts：来源、更新时间、可见切片、写回边界、隐私边界。

### 用户可见状态

| 状态 | 含义 | 用户看到什么 |
|---|---|---|
| `planned` | 只从日历/会前上下文提取了目标，还没有会议证据 | `本场要闭环 3 件事` |
| `in_meeting` | Meeting Pilot capture 正在进行，可实时标记目标被提及 | `已提到 2/3，尚未确认 1` |
| `post_meeting_pending` | capture 结束，等待结构化分析或外部证据补齐 | `正在装订结果；暂不当作最终结论` |
| `bound` | 有足够证据生成结果装订 | `2 已闭环，1 带到下一次` |
| `partial` | transcript/证据不足，仍可显示已知部分 | `仅基于日历 + 部分 transcript` |
| `blocked` | 缺 transcript、日历权限、meeting id 或证据冲突 | `无法装订；只显示可读来源` |

### Outcome slot 类型

| slot 类型 | 示例 | 可写入长期记忆吗 |
|---|---|---|
| `decision` | `ballpark estimate 先填入 Plans board` | 只有有证据且无冲突时可作为候选 |
| `action` | `Esone 复查 Q3 initiative estimate` | P0 只复制草稿，不创建外部任务 |
| `open_question` | `capacity 是否超标还没定` | 可交给 Open Question Exit / Evidence Watch |
| `fact_update` | `MTR-144266 DEV Estimate Original 被重新确认` | 交给 Change Ledger / Authority 逻辑 |
| `context_to_carry` | `下次 sync 继续看 risk/issue` | 可进入下次 meeting prep |
| `discarded_agenda` | `某个 agenda 未讨论且不再重要` | 默认只在 binder 内保留，不写长期事实 |

## UX 设计

### 入口 1：RingCentral Video Home / Today Pilot 会前卡

用户看到会议列表时，会议卡下面出现轻量条：

```text
会议结果装订
本场要闭环 3 件事 · 来自日历 agenda + 近期 Q3 planning 记忆
[展开] [带入会议侧栏]
```

展开后：

- 每个目标有来源小标签。
- 目标可以是只读 preview。
- `带入会议侧栏` 只写本机 handoff cache，不启动 capture，不外发，不写 Calendar/Jira。

### 入口 2：Meeting Pilot 会中侧栏

实时页顶部 `现在先看` 下方增加 `本场要闭环`：

- `已提到`：transcript 或会中事件已命中，但不代表已解决。
- `可能已解决`：有 decision/action evidence，但还未完成 post-meeting binding。
- `未提到`：当前会议还没碰到。

点击 slot 会跳到相关 transcript/chapter 或 evidence card。

### 入口 3：Meeting Pilot Panorama 会后页

Panorama 顶部新增 `结果装订` section：

```text
这场会原本要解决 3 件事
2 已闭环 · 1 带到下一次 · 当前只读
```

每个 slot 结构：

- 目标：来自哪里。
- 结果：resolved / partial / carry-over。
- 证据：transcript line、action item、Jira message、source memory。
- 推荐下一步：copy follow-up、Ask follow-up、carry into next meeting prep。
- 边界：点击只复制 / 只打开证据 / 只更新本地 view state；不会写外部系统。

### 入口 4：Ask / Quick Ask

当用户问某场会、某个 planning、某个 Jira 讨论时，Ask 优先把 binder 作为一个 source card。

回执：

```text
结果装订回执：答案基于 2026 Q3 planning 的 Meeting Outcome Binder。
已闭环 2 项，未闭环 1 项。当前回答不代表 Jira / Calendar 已更新。
```

### 入口 5：下一次会议会前准备

如果同一 recurring meeting 或同一 project/participants 再次出现，Today Pilot 会显示：

```text
上次未闭环：capacity 是否超出 team capacity。
建议本场优先确认。
```

这不是自动 agenda 变更，只是会前提示。

## 数据契约草案

### 表：`meeting_outcome_binders`

```ts
type MeetingOutcomeBinder = {
  id: string;
  userId: string;
  meetingKey: string;
  calendarEventId?: string;
  meetingSessionId?: string;
  title: string;
  startsAt?: number;
  endsAt?: number;
  timezone: string;
  status:
    | 'planned'
    | 'in_meeting'
    | 'post_meeting_pending'
    | 'bound'
    | 'partial'
    | 'blocked';
  sourceSummary: {
    calendar: boolean;
    meetingTranscript: boolean;
    glipFollowups: number;
    jiraSignals: number;
    sourceMemories: number;
  };
  slotCount: number;
  resolvedCount: number;
  carriedOverCount: number;
  blockedReason?: string;
  generatedAt: number;
  updatedAt: number;
};
```

### 表：`meeting_outcome_slots`

```ts
type MeetingOutcomeSlot = {
  id: string;
  binderId: string;
  kind:
    | 'decision'
    | 'action'
    | 'open_question'
    | 'fact_update'
    | 'context_to_carry'
    | 'discarded_agenda';
  title: string;
  agendaSource: 'calendar_description' | 'today_prep' | 'rehearsal' | 'user_pin' | 'memory_context';
  agendaEvidenceIds: string[];
  outcomeStatus:
    | 'not_discussed'
    | 'mentioned'
    | 'resolved'
    | 'partially_resolved'
    | 'carried_over'
    | 'blocked_by_missing_evidence'
    | 'conflicted';
  outcomeSummary: string;
  confidence: number;
  evidenceIds: string[];
  carryOverTarget?: {
    kind: 'next_recurring_meeting' | 'today_pilot' | 'ask_hint' | 'evidence_watch' | 'open_question_exit';
    reason: string;
  };
  writebackEligibility:
    | 'none'
    | 'copy_only'
    | 'memory_candidate'
    | 'confirm_required'
    | 'external_action_requires_approval';
  createdAt: number;
  updatedAt: number;
};
```

### Evidence link

```ts
type MeetingOutcomeEvidence = {
  id: string;
  binderId: string;
  slotId?: string;
  sourceType:
    | 'calendar'
    | 'meeting_transcript'
    | 'meeting_action_item'
    | 'glip_message'
    | 'jira_issue'
    | 'source_memory'
    | 'ask_answer'
    | 'manual_note';
  sourceRefId: string;
  quotePreview: string;
  occurredAt?: number;
  role: 'agenda' | 'decision' | 'action' | 'contradiction' | 'carry_over' | 'background';
  freshnessLabel: string;
  openBoundary: string;
};
```

### API 草案

```http
GET /api/v1/meeting-outcomes?window=today
GET /api/v1/meeting-outcomes/:id
POST /api/v1/meeting-outcomes/preview
POST /api/v1/meeting-outcomes/:id/rebind
POST /api/v1/meeting-outcomes/:id/feedback
```

P0 可以先不新增公开 API，直接由 Today Pilot / Meeting Pilot 内部服务消费。但 contract 应该独立，避免逻辑散在多个 UI。

## 实施方案

### P0：Calendar agenda + Meeting Pilot post-meeting binder

范围：

1. `MeetingOutcomeBinderService.previewFromCalendarEvent()`
   - 输入 calendar raw memory / calendar event。
   - 抽取 1-5 个 agenda slots。
   - 排除纯会议链接、Zoom/RCV boilerplate、weekly/no-action repeating meetings。
2. `MeetingOutcomeBinderService.bindMeetingSession()`
   - 输入 Meeting Pilot session / transcript chapters / action items / decisions。
   - 把 agenda slot 和 outcome evidence 做匹配。
   - 标记 resolved / partial / carried-over / not-discussed。
3. Today Pilot / Video Home
   - 会前卡显示 `本场要闭环` preview。
4. Meeting Pilot side panel
   - 会中显示 slot 提及状态。
5. Panorama
   - 会后显示结果装订。
6. Ask
   - 当 query 命中 meeting title / project / date / participant 时，把 binder 作为优先 source card。

P0 不做：

- 不自动创建 Jira / Planner / Reminders / RingCentral 任务。
- 不自动改 Calendar agenda。
- 不把所有 action item 写入长期 memory fact。
- 不做会议机器人。
- 不要求用户每天进入 review queue。

### P1：Glip/Jira 会后证据补齐

会议结束后 24-72 小时内，后台用同一 meeting/project/participants/Jira anchors 查找：

- 会后群聊是否确认了某个决定；
- Jira 是否出现字段变化；
- source-memory 是否保存了相关页面；
- Ask 是否已有用户追问。

只补强 binder，不自动外部写入。

### P2：Recurring meeting carry-over

对 recurring meeting / same participant group / same project meeting：

- 把未闭环 slot 带到下一场会前准备。
- 显示 `来自上次未闭环`。
- 如果连续多次未闭环，降级为 `长期开放问题` 并交给 Open Question Exit，而不是继续在每场会里刷屏。

### P3：受控外部写入

只有当 slot 具备 owner、deadline、evidence、target system readiness，且用户明确确认时，才可：

- 创建 Jira comment / task；
- 发 RingCentral follow-up；
- 写 Calendar note；
- 生成 Scheduled Message。

这里必须复用 `Action Readiness Contracts` 和现有确认边界。

## 关键算法

### Agenda slot extraction

输入：

- calendar title / description；
- Today Pilot meeting prep；
- Rehearsal cue；
-近期相关 Glip/Jira/source-memory。

输出：

- 1-5 个 `MeetingOutcomeSlot`。
- 每个 slot 必须有 agenda evidence。
- weekly / sync / standup 只有出现明确 `review / decide / confirm / update / risk / estimate / deadline / owner` 才抽 slot。

### Outcome matching

按以下证据层级：

1. 明确 decision / action item / transcript evidence。
2. 会后 Glip/Jira follow-up。
3. Ask / user feedback。
4. 弱匹配 transcript mention。

状态规则：

- 只有 mention 不能算 resolved。
- action item 缺 owner/deadline/evidence 时不算 fully resolved。
- 冲突证据进入 conflicted，不静默选边。
- transcript 不完整时进入 partial。

### Carry-over selection

只 carry over：

- 会前 agenda 明确；
- 会中未讨论或未闭环；
- 对用户后续场景仍有价值；
- 没有被用户 dismiss；
- 不属于 secret / sensitive transient content。

## 隐私、权威、恢复与写回边界

### 来源边界

每个 slot 必须显示：

- agenda 来源；
- outcome 来源；
- 当前是否含 transcript；
- 是否含会后 Jira/Glip 补证据；
- 最新证据时间。

### 权威边界

会议 transcript 不是事实权威。它只能证明“有人在会议里说过”。如果 slot 要更新长期事实，需要：

- Jira / source-memory / confirm request / Change Ledger 等权威层参与；
- 或明确标成 `meeting_claim`，不当作当前事实。

### 隐私边界

- 不把完整 transcript 默认发给外部 AI。
- 不把会议链接 passcode、OAuth、JWT、API key 等 secret 进入 binder evidence preview。
- 不把未公开的人名/敏感组织信息自动推到外部任务系统。

### 写回边界

P0 所有 visible actions 默认：

- `复制跟进草稿`：只写本机剪贴板。
- `打开证据`：只打开本机/安全来源链接。
- `带到下一次`：只写 Personal AI binder/carry-over，不改 Calendar。
- `Ask 追问`：只打开 Ask draft，不发送。

外部写入必须进入 P3，并复用 readiness + approval。

### 恢复边界

如果 binder 误判：

- 用户可点 `不相关` / `不是结果` / `不带到下次`。
- 反馈进入 Outcome Loop / recall relevance，不立即删除原始 meeting memory。
- 原始会议记录和 action item 仍可从 Meeting History 打开。

## Eval 决策

需要创建 evals。

原因：

- agenda slot 抽取质量依赖 LLM / ranking / heuristic 组合；
- outcome matching 容易把“提到”误判成“解决”；
- carry-over 有打扰风险；
- Ask 是否优先使用 binder 而不是 raw transcript 需要体验判断。

实现后应新增：

```text
evals/cases/meeting-outcome-binder/
evals/workflows/meeting-outcome-binder/experience.md
```

注册 suite：

```yaml
id: meeting-outcome-binder
schedule: weekly
```

第一批真实场景建议从 `10.32.56.212` 的 `esone.qiu` 数据里取：

1. `2026 Q3 planning for video mobile`
   - calendar agenda 包含 estimates / capacity / risk。
   - 预期：抽 3 个 slots；不能把会议链接当 slot。
2. `Gary ballpark estimate` 相关 Glip/Jira 场景
   - 预期：估时口径可作为 evidence；缺 Jira 更新时不能算 fully resolved。
3. 普通 weekly / daily meeting
   - 预期：没有明确 agenda 时不生成 binder 或只生成低置信 partial。
4. transcript 只提到问题但没有决策
   - 预期：状态为 `mentioned` 或 `carried_over`，不能 resolved。
5. 会后 Jira 字段变化
   - 预期：可以补强 slot，但要显示 Jira/source freshness。

通过标准：

- agenda slot precision >= 0.8。
- resolved/partial/carry-over 状态准确率 >= 0.8。
- 0 个 secret raw value 出现在 evidence preview。
- Ask 场景能优先引用 binder，并显示结果装订回执。
- 失败样本必须生成 reader-facing report，继续迭代直到 suite 通过。

实现完成后必须运行：

```bash
npm run eval:validate
npm run eval:run -- --suite meeting-outcome-binder --no-repair
```

如果改动 Meeting Pilot / Today Pilot UI，还应跑对应 E2E 和 root `npm start` 首次编译。

## 文档维护要求

完成功能代码实现后，需要把关键行为和关键逻辑维护进正式文档：

- `docs/features/today_pilot.md`
  - 会前卡如何显示 outcome preview。
  - carry-over 如何进入下一场会前准备。
- `docs/features/meeting_pilot.md`
  - Meeting Pilot side panel / Panorama 的 outcome binder 行为。
  - transcript/action/evidence 边界。
- `docs/features/ask.md`
  - Ask 如何消费 binder source card。
- `docs/features/memory_system.md`
  - `meeting_outcome_binders` 作为记忆派生对象的生命周期。
- 如实现范围足够大，可新建 `docs/features/meeting_outcome_binder.md`，并在 `docs/features/index.md` 新增索引行。

实现完成并迁入 canonical docs 后，应删除或标记本 `docs/progressing` 计划和 demo，避免 planning 与正式文档双轨。

## 风险与取舍

### 风险 1：用户觉得又多了一个会议面板

对策：

- P0 不新增独立页面。
- 会前只显示一行 `本场要闭环`。
- 会后只在 Panorama 顶部显示 compact outcome。
- Ask 只在相关问题时显示 binder source card。

### 风险 2：把“提到”误判成“决定”

对策：

- 状态明确区分 `mentioned`、`partial`、`resolved`。
- action item 缺 owner/deadline/evidence 时不能 fully resolved。
- 需要权威事实更新时交给 Change Ledger / confirm request。

### 风险 3：carry-over 打扰太多

对策：

- 只有明确 agenda + 未闭环 + 高相关才带到下一次。
- 连续多次未闭环后降级给 Open Question Exit。
- 用户 dismiss 后同一 slot 不再重复出现。

### 风险 4：会议数据不完整

对策：

- `partial` 是一等状态。
- 没有 transcript 时只做 agenda preview，不生成会后结论。
- evidence preview 必须说明当前基于哪些来源。

### 风险 5：和 Meeting Pilot 行动项重复

对策：

- 行动项只是 outcome slot 的一种。
- Binder 关注的是 agenda closure；Meeting Pilot action items 继续负责 owner/deadline/evidence 复核。

## 推荐 P0 范围

做：

1. 从 calendar description 提取 agenda slots。
2. 在 Today Pilot / Video Home 显示 `本场要闭环` preview。
3. 在 Meeting Pilot side panel 显示会中提及状态。
4. 在 Panorama 显示会后 resolved / partial / carry-over。
5. Ask 可把 binder 作为 source card。
6. 创建 `meeting-outcome-binder` eval suite。

不做：

1. 不做外部任务自动创建。
2. 不做 Calendar agenda 自动写回。
3. 不做团队共享 meeting notes。
4. 不做全局会议仪表盘。
5. 不替代 Evidence Watch / Open Question Exit / Change Ledger。

## Demo

Demo 文件：

```text
docs/progressing/meeting-outcome-binder-demo.html
```

Demo 模拟集成在 RingCentral Video Home / Meeting Pilot / Ask 中：

- `会前`：会议卡下的 outcome preview。
- `会中`：Meeting Pilot 侧栏顶部的 `本场要闭环`。
- `会后`：Panorama 的 `结果装订`。
- `Ask`：基于 binder 的回答回执。

## 最终建议

这是一个值得推进的能力，但应保持 P0 收敛：

**先把一场会议从 agenda 到 outcome 装订清楚，再考虑外部写入。**

它满足的用户需求是：不再只保存会议内容，而是让 Personal AI 记住“这场协作到底推进了什么，以及下一次该接着哪里继续”。

亮点在于它把通用 AI meeting notes 的 summary/action-item 输出，升级为私人记忆系统里的 agenda-aware、source-grounded、carry-over-aware 协作闭环。
