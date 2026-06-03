# 新能力：Scene Memory Autopilot / 场景记忆自动驾驶

> 生成日期：2026-06-03 CST  
> 状态：待决策，只做方案与 demo，未改运行时代码  
> Codex 会话标题建议：`新能力：场景记忆自动驾驶`  
> Demo：[`scene-memory-autopilot-demo.html`](./scene-memory-autopilot-demo.html)  
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表没有 `Personal AI` 清单，因此没有可随机选择或标记完成的全新功能 idea。本方案来自 `docs/progressing` 去重、远端 `esone.qiu` 真实记忆抽样，以及 2025-2026 年 AI memory / proactive agent / Human-AI interaction 资料。

## 结论

建议设计一个新的 Personal AI 能力：**Scene Memory Autopilot / 场景记忆自动驾驶**，中文 UI 可以叫 **场景记忆** 或 **记忆自动驾驶**。

一句话：

> Personal AI 不只要“召回相关记忆”，还要在每个真实场景里判断：现在应该安静、给一条低打扰提醒、展开证据卡、生成上下文包，还是延后到今日简报。

它不是一个新的总览页，也不是新的用户 review 队列。它是一层跨 Memory Lens、Compose Assist、Today Pilot、Meeting Pilot、Relationship Radar、Rehearsal、Answer Memory、Reflection / Action Queue 的 **场景投放与注意力预算机制**。

核心新原语是 `Memory Moment`：

- 当前场景是什么。
- 哪些记忆候选可能有用。
- 用户现在有多少注意力预算。
- 应该用哪种形态出现。
- 哪些候选被压住了，为什么。
- 这次出现或保持安静是否被用户后续行为证明有用。

## 为什么值得做

Personal AI 的目标是保存用户与 AI、网页、消息、会议、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话等场景提供记忆关联提示。现在系统已经有很多“记忆内容”和“单点消费方”：

- Memory Lens：页面/选区上的关联记忆。
- Compose Assist：写消息、Jira comment、AI prompt 前补上下文。
- Today / Day Pilot：把一天的工作整理成 mission。
- Meeting Pilot / Rehearsal：会议中和会前的记忆提示。
- Relationship Radar：人际上下文。
- Answer Memory Tracker：用户反复追问问题的当前答案。
- Memory Relevance Trainer：用户遇到错配记忆后的反馈修复。
- Reflection Threads / Action Queue / Confirm Requests：后台反思、外部核实和高风险确认。

但这些能力越多，一个新的问题越明显：

> 用户不是缺少记忆，而是缺少“这个场景此刻到底该出现哪一条、用多大声音出现、出现错了怎么下次更安静”的统一决策。

本次真实 `esone.qiu` 只读抽样也支持这个判断：

- `/api/v1/stats`：`10122` 条 messages、`7474` 个 chunks、`50254` 条 relationships、`50` 个 pending confirm requests。
- `/api/v1/coverage/messages-by-source`：`glip 8773`、`web 468`、`meeting 375`、`calendar 210`、`jira 37`，近期 7 天仍有 web / calendar / jira 新记忆进入。
- `/api/v1/coverage/pressure`：`687` 个 active reflection threads、`58` 个 queued actions、`50` 个 pending confirm requests，总 pressure items `795`。
- pending confirm requests 中大量围绕 `BE`、`MTR-141852` 的相似状态变化确认，例如多种语言和措辞都在表达“not ready / waiting for new design”。
- queued actions 中大量是 `delegate_openclaw` 的“继续外部核实”，且多数需要人工批准。
- skill sync 显示除 OpenClaw 和 Personal AI 内部外，Codex / Claude Code / Cursor / ChatGPT GPTs 等平台还没有稳定自动安装或回收能力，说明“跨 agent 自动塔台”短期不应成为主方向。

这些信号不是说要再做一个后台治理台。相反，它们说明 Personal AI 需要一个更靠近用户现场的投放层：把内部产生的很多记忆、反思、动作、确认，压缩成当前场景里最少、最有用、最可撤销的一次提示。

## 这不是已有功能的重复

| 已有能力 / plan | 解决什么 | 场景记忆自动驾驶新增什么 |
| --- | --- | --- |
| Memory Lens | 在网页/消息页面显示相关记忆 | Autopilot 决定 Lens 此刻是否应该出现、出现几条、用 chip 还是 card、哪些候选保持安静 |
| Memory Relevance Trainer | 用户指出“不相关”后修复召回 | Autopilot 是反馈前的投放策略；Trainer 是投放失败后的学习闭环 |
| Memory Reflection Governor（搁置） | 后台反思/动作/确认的巡航治理 | Autopilot 不建治理后台；它把高信号事项投到当前页面、会议、聊天、AI prompt 中 |
| Memory Day Pilot | 一天开始前的任务简报 | Autopilot 是分钟级、页面级、输入框级场景路由 |
| AI Context Passport | 把任务上下文交给外部 AI | Autopilot 可以触发 `Build context pack`，但不负责完整 Passport 生命周期 |
| AI Session Context Drift Radar（搁置） | 追踪外部 AI 会话拿到的上下文是否过期 | Autopilot 不需要可靠登记每个外部会话，只看当前页面/输入框/日历场景 |
| Relationship Radar | 人物上下文 | Autopilot 决定人物卡何时以低打扰方式出现 |
| Visual Episodic Memory | 捕获和召回视觉证据 | Autopilot 可消费视觉证据，但不新增截图/视觉源 |
| Memory Freshness Radar | 来源变化导致旧记忆过期 | Autopilot 决定 freshness alert 是否应该现在打扰，或延后 |

一句边界：

> 其他能力回答“有哪些记忆可用”；Scene Memory Autopilot 回答“此刻应该怎么用，或者为什么不用”。

## 大白话运行逻辑

用户正在某个真实场景里工作，例如打开 Jira ticket、进入 RingCentral 群、准备会议、在 ChatGPT / Codex / 豆包输入 prompt、阅读 Google Slides。

Personal AI 不再让每个能力各自决定要不要冒泡，而是先生成一个 `Scene Frame`：

1. 这是哪个表面：RingCentral、Jira、会议、AI chat、Docs、普通网页。
2. 用户当前在做什么：阅读、输入、准备开会、发消息、查看 ticket、查旧答案、复制上下文。
3. 当前场景里最强锚点是什么：人、项目、issue、calendar event、group、selected text、AI prompt draft、source URL。
4. 现在用户是否适合被打断：正在输入长消息、会议刚开始、页面停留 90 秒、即将发送、刚切到一个相关 ticket。
5. 召回候选里哪些真的值得出现：同项目、同人、同 issue、未来场景、活答案、已验证来源、近期变化。
6. 这次最多能花多少用户注意力：零提示、一个 chip、一张展开卡、一个可复制 context pack、或高风险确认。

然后系统输出一个 `Memory Moment`：

- `silent`：保持安静，只在后台记录为什么没出现。
- `badge`：低存在感角标，用户主动 hover 才展开。
- `whisper_chip`：一句话提示，例如“这张 Jira 有 1 条相似历史结论”。
- `expanded_card`：证据卡，例如会前 10 分钟显示人物/项目风险。
- `compose_guard`：在发送前提醒“这条状态曾经被多次确认为 not ready”。
- `context_pack`：给 AI prompt / Codex / OpenClaw 的最小上下文包。
- `confirm_request`：只有外发、删除、跨隐私边界、 durable profile 等高风险时才需要用户确认。

关键是：**多数时候保持安静也是一个有记录、有学习价值的决策**。这比不断弹出“可能相关”的卡片更接近真实用户体验。

## 行业与研究参考

### ChatGPT / Gemini：记忆正在走向跨对话和个人上下文

[OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-and-controls-faq) 和 [OpenAI memory update](https://openai.com/index/memory-and-new-controls-for-chatgpt/) 显示 ChatGPT 记忆已经包含 saved memories 与 chat history 两类个性化上下文，并提供开关、删除、管理等控制。

[Google Gemini Personal Intelligence](https://gemini.google/overview/personal-intelligence/) 和 [AI Mode Personal Intelligence](https://blog.google/products-and-platforms/products/search/personal-intelligence-ai-mode-search/) 则把 Gmail、Photos、Search、YouTube 等个人数据作为可连接上下文，让 Gemini 或 AI Mode 给出更个性化的回答。

对 Personal AI 的启发：

- 行业方向已经不是单轮聊天，而是个人上下文持续参与。
- 但大平台主要在“回答时使用上下文”；Personal AI 的差异机会是 **在用户自己的页面、会议、消息和其他 AI 工具里主动选择最少必要记忆**。

### Microsoft Recall / Notion Enterprise Search：找回一切不等于打扰一切

[Microsoft Recall](https://support.microsoft.com/en-us/windows/retrace-your-steps-with-recall-aa03f8a0-a78b-4b3e-b0a1-2eb8ac48701c) 证明用户需要找回“我之前看过什么”，并强调 opt-in、暂停、删除、过滤 app / website 等控制。

[Notion Enterprise Search](https://www.notion.com/en-gb/help/enterprise-search) 和 [Notion 2.51](https://www.notion.com/releases/2025-05-13) 展示了跨 Notion、连接工具和 web 的统一搜索 / AI Meeting Notes / Research Mode。

对 Personal AI 的启发：

- 统一记忆和跨工具搜索很重要，但它们多半仍是用户主动查。
- Personal AI 的机会在“当前工作流里刚好给一条”，不是把所有搜索结果都推成通知。

### Human-AI Interaction：打断时机本身是产品能力

[Microsoft Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/?p=564561) 明确提出 AI 应根据用户当前任务和环境选择行动/打断时机，并支持高效调用与高效关闭。

[Google PAIR Feedback + Control](https://pair.withgoogle.com/guidebook-v2/chapters/feedback-controls/) 也强调反馈和控制要服务于用户信任，系统建议即使之前不相关，也可能在未来场景相关，所以控制要细粒度而不是粗暴全局关闭。

对 Personal AI 的启发：

- 记忆相关性不只是在候选列表里排序，还包括“此刻是否应该出现”。
- `Dismiss` 不应该只是丢弃一条记忆，而应学习：这个场景、这个模式、这个打扰级别哪里不合适。

### Proactive agents：主动帮助必须先理解场景和注意力

[ContextAgent](https://arxiv.org/abs/2505.14668) 研究 context-aware proactive agent，目标是用开放世界感知上下文增强主动辅助能力。

[LlamaPIE](https://arxiv.org/abs/2505.04066) 研究对话中的实时 proactive assistant，核心挑战包括什么时候响应、如何给出简短提示、如何利用用户知识且保持低打扰。

[ProMemAssist](https://arxiv.org/abs/2507.21378) 从 working memory modeling 出发，强调及时帮助要考虑用户当前心理/工作负载，而不是只靠预定义任务。

[Persistent Assistant](https://augmented-perception.org/publications/2025-persistant_assistant.html) 也强调日常 AI 交互不应只靠费时的自然语言往返，而要用 grounded interaction 和多模态反馈降低认知负担。

对 Personal AI 的启发：

- “主动”不是多推送，而是把意图、对象、时机和反馈都嵌入当前任务。
- Personal AI 已经有大量私有记忆，缺的是一个能判断注意力成本的投放策略。

### Agent memory / context engineering：上下文越多越需要路由

[Mem0](https://arxiv.org/abs/2504.19413) 和 [Zep Graphiti](https://arxiv.org/abs/2501.13956) 都说明长期 AI agent 需要结构化、动态、可演化的记忆，而不是把所有历史塞进 prompt。

[Lost in the Middle](https://arxiv.org/abs/2307.03172) 和 [Context Length Alone Hurts LLM Performance Despite Perfect Retrieval](https://arxiv.org/abs/2510.05381) 提醒我们：长上下文本身会降低模型利用信息的稳定性，即使相关信息存在，过多无关上下文也会伤害输出。

对 Personal AI 的启发：

- Autopilot 的工作不是“尽量塞更多记忆”，而是“少而准地投放”。
- 每次给外部 AI 的 context pack 都应该经过 attention budget 和 evidence gate，避免 context rot。

## 产品定义

### 功能名

**Scene Memory Autopilot / 场景记忆自动驾驶**

UI 简称可以是：

- `场景记忆`
- `记忆自动驾驶`
- `此刻相关`

### 核心承诺

1. **把每个当前页面变成一个可理解的场景**
   不只是 URL / title，而是表面、任务、锚点、人、项目、issue、输入框状态、日历时段、用户注意力状态。

2. **统一决定记忆出现形态**
   Memory Lens、Compose Assist、Meeting Pilot、Relationship Radar、Rehearsal、Answer Memory、Confirm Request 不再各自抢用户注意力。

3. **把安静也记录为决策**
   如果没有足够高信号证据，系统保持安静，并记录 quiet reason，后续可通过用户主动打开、搜索、反馈来校准。

4. **以用户注意力预算为第一约束**
   会议中、输入中、发送前、阅读中、切换任务后，每种场景的打扰预算不同。

5. **只在高责任边界要求确认**
   普通相关性、排序、低打扰提示不要求用户审；外发、删除、跨隐私、durable profile 更新等高风险才进 confirm request。

6. **把反馈变成路由学习**
   `有用`、`太打扰`、`不是这个项目`、`晚点提醒` 不只是 UI 反馈，而是更新投放策略、eval case 和 scene policy。

## 核心用户体验

### Flow A：打开 Jira ticket，系统只给一条真正有用的记忆

1. 用户打开 `MTR-148115: Migrate AI Notes Update Flow from Fixed Interval Polling to Long Polling`。
2. Autopilot 识别当前场景：
   - surface：Jira。
   - task：阅读 / 评估 ticket。
   - anchors：MTR-148115、AI Notes、Long Polling、DEV estimate。
   - attention：页面刚打开，不适合大卡；停留 45 秒后可显示 chip。
3. 系统从 Memory Lens、Answer Memory、Reflection、web captures 中找到 8 个候选，但只显示一个 chip：
   - “这张 Jira 有一个待核实 DEV estimate 线索，来自 2026-06-02 页面捕获。”
4. 用户点开后看到：
   - 证据摘要。
   - 为什么是这条。
   - 其他 7 条为什么保持安静，例如“同主题但不是同 issue”、“只是 AI Notes 泛词命中”、“旧会议没有 action item”。
5. 用户可以点 `复制给 Codex`，生成最小 context pack，而不是把整页历史塞给外部 AI。

### Flow B：在 RingCentral 写消息，发送前才提醒

1. 用户在一个群里准备发“BE 看起来 ready 了”。
2. Autopilot 不在用户阅读时弹一堆卡，而是在发送前检测到 draft 里有 `BE ready`。
3. 系统发现历史里有多条 confirm request 都指向“BE not ready / waiting for new design”，但表达重复。
4. 它不要求用户审 15 条确认，只给一个 compose guard：
   - “谨慎：这个 BE 状态最近多次被记为 not ready。建议改成：目前没有明确 ready 证据。”
5. 用户可以：
   - `插入更谨慎说法`。
   - `查看证据`。
   - `这次忽略`。
   - `这个群以后少提醒`。

### Flow C：会前 10 分钟，主动推一个最小 brief

1. 日历显示 10 分钟后有 `Bug - AI 先修一遍我再看`。
2. Autopilot 识别这是高价值未来场景，但用户可能正在忙。
3. 只显示一个小提示：
   - “这场会涉及 repo、branch、Mobile MR。有 2 条准备信息可用。”
4. 展开后不是完整 Day Pilot，而是只给：
   - repo / branch。
   - 最近相关 Jira / MR。
   - 上次用户偏好：让 AI 先修一遍再看。
   - 一键生成给 Codex 的 context pack。

### Flow D：在 ChatGPT / Codex / 豆包输入 prompt，自动建议最小上下文

1. 用户输入：“帮我看一下这个 AI Notes long polling 的方案”。
2. Autopilot 识别当前表面是外部 AI 输入框。
3. 它不要求系统完整追踪外部 AI 会话，只对当前输入草稿做即时判断：
   - 是否需要上下文。
   - 需要哪些来源。
   - 是否含隐私或内部链接。
4. 给出一个 inline chip：
   - “可附加 3 条 Personal AI 记忆：ticket 背景、上次 comment、风险约束。”
5. 用户点 `插入上下文` 后，把最小 evidence-backed context 加到输入框。

## 交互形态

### 1. 场景 chip

默认形态是当前页面右下角或输入框附近的小 chip：

- 不遮挡正文。
- 只显示一条最强提示。
- 3-8 秒后收缩为角标。
- hover / click 才展开。

示例文案：

- `此刻相关：1 条 Jira 记忆`
- `发送前提醒：BE 状态可能不稳`
- `会前 10 分钟：2 条准备信息`
- `保持安静：没有同项目证据`

### 2. Memory Moment 面板

展开后显示：

1. **当前判断**
   - 场景、任务、锚点、注意力预算。
2. **这次出现的记忆**
   - 最强候选、证据、为什么有用。
3. **被压住的候选**
   - 最多 3 条，解释 quiet reason。
4. **可执行动作**
   - 复制上下文、插入更谨慎说法、打开来源、晚点提醒、这次忽略。
5. **反馈**
   - `有用`
   - `太打扰`
   - `不是这个项目`
   - `以后这种场景少提醒`

### 3. 输入框 guard

只在发送 / 提交前触发，不在每次键入时抢焦点：

- RingCentral message。
- Jira comment。
- Google Docs comment。
- ChatGPT / Codex / 豆包 prompt。

guard 分三类：

- `context_missing`：缺必要背景。
- `contradiction_risk`：和高置信旧记忆冲突。
- `outbound_privacy`：外发可能跨隐私边界，需要显式确认。

### 4. 周期性 quiet report

不做新的总览后台，但可以在 Today Pilot / 周报里给一句低负担总结：

- “本周场景记忆保持安静 128 次，主动出现 14 次，被用户采用 8 次。”
- “泛 AI 工具公告在 Jira 页面被降噪 17 次。”
- “BE ready 相关重复确认已合并为一个发送前提醒。”

## 核心机制

### Scene Frame

`Scene Frame` 是 Autopilot 的输入。

```ts
type SceneFrame = {
  id: string;
  userId: string;
  surface:
    | 'ringcentral'
    | 'jira'
    | 'meeting'
    | 'calendar'
    | 'google_docs'
    | 'google_sheets'
    | 'web_ai'
    | 'generic_web'
    | 'memory_exploring';
  activity:
    | 'reading'
    | 'typing'
    | 'before_send'
    | 'meeting_prestart'
    | 'in_meeting'
    | 'task_switch'
    | 'asking_ai'
    | 'searching';
  anchors: {
    urlHost?: string;
    urlPathHash?: string;
    issueKeys: string[];
    people: string[];
    projects: string[];
    topics: string[];
    groupName?: string;
    calendarEventId?: string;
    selectedTextHash?: string;
    inputDraftHash?: string;
  };
  attention: {
    dwellMs: number;
    isTyping: boolean;
    secondsUntilMeeting?: number;
    secondsSinceLastNudge: number;
    userDismissedRecentNudge: boolean;
    currentBudget: 'none' | 'badge' | 'chip' | 'card' | 'guard';
  };
  privacy: {
    scope: 'work' | 'personal' | 'mixed';
    outboundTarget?: 'internal_ai' | 'external_ai' | 'public_web' | 'message_send';
    sensitiveDetected: boolean;
  };
  createdAt: number;
};
```

### Memory Moment

`Memory Moment` 是 Autopilot 的输出。

```ts
type MemoryMoment = {
  id: string;
  sceneFrameId: string;
  mode:
    | 'silent'
    | 'badge'
    | 'whisper_chip'
    | 'expanded_card'
    | 'compose_guard'
    | 'context_pack'
    | 'confirm_request';
  surfacePlacement:
    | 'bottom_right'
    | 'near_input'
    | 'meeting_sidebar'
    | 'today_pilot'
    | 'notification_center'
    | 'none';
  attentionCost: 0 | 1 | 2 | 3 | 5;
  primaryCandidate?: MemoryCandidateRef;
  suppressedCandidates: Array<{
    ref: MemoryCandidateRef;
    quietReason:
      | 'weak_anchor'
      | 'duplicate'
      | 'low_information'
      | 'stale'
      | 'user_recently_dismissed'
      | 'attention_budget_exceeded'
      | 'privacy_gate';
  }>;
  reason: string;
  actions: MemoryMomentAction[];
  expiresAt: number;
  createdAt: number;
};
```

### 候选来源

Autopilot 本身不负责生成全部记忆候选。它消费已有能力的输出：

- `/context-recall`：页面/选区候选。
- `RelationshipRadarService`：人物上下文。
- `Rehearsal`：未来场景提示。
- `AnswerMemoryService`：活答案和不确定性。
- `ReflectionThreadService` / `ActionRepository`：高影响反思、外部核实和 confirm debt。
- `MemoryFreshness` / `SourceMemory`：来源变化、source capsule。
- `AmbientCalibration` / feedback traces：用户过去对提示的采用、忽略、插入、改写。

### 决策顺序

Autopilot 的优先级不应该是一个固定权重表，而是一组 gate：

1. **隐私和责任边界先过**
   敏感、跨个人/工作边界、外发、删除、durable profile 更新，必须先 gate。

2. **场景锚点必须足够强**
   同 issue / 同人 / 同群 / 同会议 / 同 selected text / 同 input draft 优先。只有泛主题词相同不足以主动出现。

3. **注意力预算决定形态**
   用户正在输入时最多 near-input guard；刚打开页面先保持安静；停留后才 chip；会前才 brief；发送前才 guard。

4. **候选之间去重合并**
   多条 `BE not ready` 近似确认合并成一个发送前提醒，而不是 15 条确认。

5. **新鲜度和证据质量**
   confirmed / recent / primary source / direct quote 优先；空会议、无 action item、泛公告默认降级。

6. **用户历史反馈**
   如果用户最近对同类场景点过 `太打扰`，降低自动出现；如果用户主动打开过同类 chip，则增加 badge / chip 机会。

7. **默认为安静**
   低于阈值时记录 quiet reason，不展示。

## 数据模型建议

### `scene_frames`

记录当前场景快照，默认短期保留。只保存必要锚点和 hash，不保存完整输入框内容。

```sql
CREATE TABLE scene_frames (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  activity TEXT NOT NULL,
  anchors_json TEXT NOT NULL,
  attention_json TEXT NOT NULL,
  privacy_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
```

### `memory_moments`

记录出现或保持安静的投放决策。

```sql
CREATE TABLE memory_moments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scene_frame_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  placement TEXT NOT NULL,
  attention_cost INTEGER NOT NULL,
  primary_candidate_json TEXT,
  suppressed_candidates_json TEXT,
  reason TEXT,
  actions_json TEXT,
  outcome TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
```

### `scene_memory_policies`

保存从反馈中学到的场景策略。

```sql
CREATE TABLE scene_memory_policies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  scene_signature_json TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  source_moment_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
```

### `memory_moment_feedback`

把用户现场动作转成路由学习。

```sql
CREATE TABLE memory_moment_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  moment_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  detail TEXT,
  implicit_signal_json TEXT,
  created_at INTEGER NOT NULL
);
```

## API 草案

### `POST /api/v1/scene-memory/frame`

由 extension / desktop app 发送场景帧。

请求：

```json
{
  "surface": "jira",
  "activity": "reading",
  "anchors": {
    "issueKeys": ["MTR-148115"],
    "topics": ["AI Notes", "Long Polling"],
    "projects": ["mThor"]
  },
  "attention": {
    "dwellMs": 46000,
    "isTyping": false,
    "secondsSinceLastNudge": 1800
  }
}
```

响应：

```json
{
  "moment": {
    "mode": "whisper_chip",
    "reason": "同 issue + 近期 web capture + 无近期打扰",
    "title": "这张 Jira 有 1 条待核实估算线索",
    "actions": ["open", "copy_context", "dismiss"]
  }
}
```

### `POST /api/v1/scene-memory/feedback`

记录用户对 moment 的反馈。

```json
{
  "momentId": "mm_123",
  "feedbackType": "too_interruptive",
  "detail": "阅读 Jira 第一屏时不要自动展开卡片"
}
```

### `GET /api/v1/scene-memory/policies`

给设置页 / 调试面板使用，不是默认用户入口。

## 实施计划

### Phase 0：离线策略验证

目标：不改 UI，先用真实数据回放判断策略是否能减少噪声。

- 从现有 `/context-recall`、confirm requests、actions、reflection threads 采样 50 个场景。
- 给每个样本生成候选和 expected placement：silent / chip / card / guard。
- 建 `evals/cases/scene-memory-autopilot/`。
- 指标：
  - `silent_when_weak_anchor`。
  - `guard_when_before_send_contradiction`。
  - `merge_duplicate_confirm_debt`。
  - `no_review_queue_for_low_risk`。

### Phase 1：Jira + RingCentral 的低打扰 chip

目标：证明“少而准”。

- extension 内容脚本构造 `SceneFrame`。
- Memory Service 新增 `SceneMemoryAutopilotService`。
- 只接入 `/context-recall` 和现有 feedback traces。
- UI 只做 bottom-right / near-input chip。
- 支持 `有用`、`太打扰`、`不是这个项目`、`这次忽略`。
- 不接入 confirm request，不外发，不自动写 durable profile。

### Phase 2：发送前 guard

目标：把 repeated confirm debt 转成实际场景价值。

- RingCentral / Jira comment / Web AI prompt 的 before-send guard。
- 消费 Answer Memory、Confirm Requests、Reflection candidates。
- 合并重复事实冲突，例如 `BE ready`。
- 只在 draft 与高置信旧记忆冲突时出现。

### Phase 3：会议 / AI prompt context pack

目标：在高价值场景生成最小上下文。

- 会前 10 分钟 brief。
- 外部 AI 输入框 context pack。
- 接入 Relationship Radar、Rehearsal、AI Context Passport 的最小包能力。
- 添加隐私 envelope：内部链接、敏感字段、跨域外发检查。

### Phase 4：策略学习和体验评估

目标：让 Autopilot 变成长期机制。

- `scene_memory_policies` 支持从反馈自动更新。
- `memory_moment_feedback` 接入 Ambient Calibration / Outcome Ledger。
- 体验 eval 每周跑：
  - 噪声率。
  - 采用率。
  - 发送前风险拦截质量。
  - 用户主动打开 chip 的比例。
  - 高风险确认是否只在必要时出现。

## 需要改动的代码区域

P1 预计涉及：

- `memory-service/src/core/SceneMemoryAutopilotService.ts`
- `memory-service/src/routes/sceneMemory.ts`
- `memory-service/src/storage/migrations/0xx_scene_memory_autopilot.sql`
- `memory-service/src/core/ContextRecallService.ts`：暴露候选和 quiet reason。
- `memory-service/src/core/RecallContextExpansionService.ts`：提供 scene anchors。
- `memory-service/src/core/NotificationCenterService.ts`：未来可承接低打扰 digest。
- `src/contentScriptJira.ts`
- `src/contentScriptGlip.tsx`
- `src/web-intelligence/contextRecallGuards.ts`
- `src/services/MemoryServiceClient.ts`
- `src/modals/components/MemoryCoveragePage.vue` 或 settings 调试区域：只放 debug / policy，不做主入口。

## 体验评估建议

这个能力的价值高度依赖判断质量，不能只靠 E2E 点击测试。建议新增 eval suite：

```text
evals/
  cases/
    scene-memory-autopilot/
      jira-reading.jsonl
      ringcentral-before-send.jsonl
      meeting-prestart.jsonl
      web-ai-context-pack.jsonl
  workflows/
    scene-memory-autopilot/
      experience.md
```

推荐指标：

| 指标 | 目标 |
| --- | --- |
| Weak-anchor silence rate | 泛主题命中但无同人/同项目/同 issue 时，80%+ 保持安静 |
| High-value moment recall | 发送前事实冲突、会前准备、同 issue 近期证据，80%+ 出现 |
| Attention cost budget | 单页面 30 分钟内自动 chip 不超过 2 次 |
| Duplicate debt merge | 同一事实的重复 confirm request 合并率 70%+ |
| User correction capture | `太打扰/不是这个项目` 能生成 scene policy 和 eval case |
| Privacy gate precision | 外发到 Web AI 的敏感内容默认不自动插入 |

## 风险和规避

### 风险 1：变成隐形黑盒，用户不知道系统为什么不出现

规避：

- `Memory Moment` 保存 quiet reason。
- 用户主动打开 Lens 时可以看到“为什么刚才没有自动提示”。
- 周报只用一两句展示降噪统计，不做繁重后台。

### 风险 2：又变成一个 review / 管理成本

规避：

- 默认不要求用户审核 scene policy。
- 只有高责任边界进入 confirm request。
- 普通反馈一键生效，有撤销，不让用户维护规则库。

### 风险 3：和 Memory Lens 混在一起

规避：

- Lens 是展示组件和召回消费方。
- Autopilot 是跨表面的投放策略。
- P1 可以先只服务 Lens，但 API 和数据模型应保持跨表面。

### 风险 4：误判导致重要记忆保持安静

规避：

- 用户主动打开 Lens / Ask 时仍能看到候选。
- 高风险 before-send guard 比普通 reading chip 更保守。
- eval 要覆盖 false silent，不只看噪声减少。

### 风险 5：隐私边界复杂

规避：

- SceneFrame 只保存 hash 和锚点，不保存完整 draft。
- context pack 外发前走 privacy envelope。
- 跨 work/personal、外部 AI、公开 web 都走更高 gate。

## 成功标准

P1 成功不是“弹出更多记忆”，而是：

- 用户每天看到的主动提示更少，但更有用。
- Memory Lens 的 `太打扰 / 不相关` 反馈下降。
- Jira / RingCentral 的强锚点提示能被用户采用。
- 同类重复 confirm debt 不再以多条卡片打扰用户。
- 外部 AI 输入框能得到更短、更准的 context pack。

建议 P1 的可量化目标：

- Jira / RingCentral 主动 chip 采用率达到 30%+。
- 单页面弱锚点自动提示减少 50%+。
- `too_interruptive` 反馈低于 20%。
- before-send guard 的用户采纳或查看证据率达到 40%+。
- P95 决策延迟 < 300ms，不拖慢页面。

## 真实用户场景

### 场景 1：用户打开 Jira 准备让 Codex 先修一遍

用户打开 `Bug - AI 先修一遍我再看` 相关 Jira / repo 页面。以前 Personal AI 可能会召回一堆泛 AI 工具、旧会议和无关网页。现在 Autopilot 只在停留后给一个 chip：

> “这个任务有一个 repo / branch / Mobile MR 上下文包，适合发给 Codex。”

用户点 `复制给 Codex`，得到简短上下文、约束、证据链接和下一步，不需要自己从日历、Jira、聊天里拼。

### 场景 2：用户准备在 RingCentral 里确认 BE ready

用户在群里打算回复“BE ready 了”。发送前 Autopilot 发现最近多条记忆都显示这个 BE 仍是 `not ready / waiting for new design`，但不把 15 条 confirm request 弹出来，只提示：

> “谨慎：这个 BE 状态近期仍没有 ready 证据。建议改成‘目前没有明确 ready 证据，需要再确认设计/BE 状态’。”

用户一键插入更谨慎说法，避免把不稳定记忆变成错误外发。

## 为什么这个方向有亮点

1. **它把 Personal AI 从“记忆搜索器”推进到“现场助理”**
   用户不需要想起去搜；系统知道什么时候该出现。

2. **它符合用户想要的自主记忆愿景**
   系统内部自己做路由、降噪、合并和预算，不把日常判断推给用户 review。

3. **它能复用现有能力，而不是新开孤岛**
   Lens、Compose、Rehearsal、Relationship、Answer、Reflection 都可以接入 `Memory Moment`。

4. **它直接解决真实数据里的压力结构**
   50 个 pending confirm、687 个 active reflection、58 个 queued actions，不应该变成一个更大的后台，而应该在真实场景里合并成少数高价值提示。

5. **它是未来跨 AI 的前置层**
   在 Context Passport、AI prompt、Codex/OpenClaw handoff 之前，先决定“什么上下文值得带过去”，这比盲目塞长上下文更稳。

## Demo 说明

Demo 文件：[`scene-memory-autopilot-demo.html`](./scene-memory-autopilot-demo.html)

Demo 模拟三个集成场景：

1. Jira ticket 页面：Autopilot 只显示一个同 issue 的记忆 chip，并解释被压住的候选。
2. RingCentral 输入框：发送前出现 BE 状态 guard。
3. 外部 AI prompt：生成最小 context pack，而不是塞满历史。

这个 demo 不是独立产品页，而是模拟 Personal AI 嵌入在其他网页中的效果，重点看低打扰 chip、Memory Moment 面板和 quiet reason。
