# 新能力：Working Memory Return Stack / 工作记忆回程栈（搁置）

> Codex 会话标题建议：新能力：工作记忆回程栈（搁置）
> 生成日期：2026-06-08 CST
> 交付物：功能计划 + 可预览 Demo
> Demo：[`working-memory-return-stack-demo.html`](./working-memory-return-stack-demo.html)
> Idea 来源：未使用 Reminder。本机 Reminders 当前可见列表没有 `Personal AI` 清单，因此没有可随机选择的新功能 idea，也没有需要标记 done 的事项。本方案来自项目目标、`esone.qiu` 真实记忆只读查询、现有 `docs/progressing` 去重，以及近期 AI 产品和任务中断研究。

## 搁置原因

本方案先标记为搁置，短期不建议按当前形态实现。

核心问题是：`离开前的静默意图断点` 需要系统在用户没有明确表达的情况下，判断“用户当前到底想做什么”。这个判断在真实工作里非常不可靠。用户打开一个 Jira ticket，可能是在估算、核实状态、复制链接、随便浏览、被别人发来的链接带过去，甚至只是不小心点开。仅凭页面 URL、停留时间、输入框 focus/blur、切 tab、idle、页面关闭等弱信号，很容易把普通浏览误判为任务意图，最后变成噪音断点。

另一个更大的限制是：很多真实意图发生在 app 操作里，而不是可稳定观察的网页里。例如 Codex app、桌面 app、终端、本地文件、系统剪贴板、agent 会话状态、外部 AI app 的内部 UI。要可靠识别这些意图，系统需要更强的 OS/app 观测能力、更多权限和更复杂的跨 app 状态解释，这会带来稳定性、隐私、误判和维护成本问题。若只能观察网页局部行为，能力覆盖又会很残缺。

如果把方案改成用户手动点击“记录当前意图”、手动 pin、或由 Codex/Meeting Pilot/Jira 等 app 主动发出结构化 checkpoint，它会更可靠，但也不再是原计划里“静默自动保存短期意图断点”的能力，而更接近现有的稍后处理、任务提醒、Operation Flight Recorder、Context Passport 或 app-native 状态恢复。

因此当前判断是：这个方向表达的用户痛点成立，但原设计依赖的自动意图检测机制不成立。除非未来已有稳定的 app-native checkpoint、用户显式 intent marker、或外部 agent session 能可靠输出 `current_goal / next_step / blocked_reason`，否则不应作为独立新能力推进。

## 结论

当前不建议实现这个新的 Personal AI 能力：**Working Memory Return Stack / 工作记忆回程栈**。

它不是再做一个 dashboard，也不是全天候操作录制。它要解决一个更日常、更痛的瞬间：用户正在 Jira、RingCentral、ChatGPT、Codex、会议、Google Sheet 之间切换时，脑子里的“我刚才做到哪、下一步要干什么、为什么要这么干”很容易在几分钟内丢掉。Personal AI 应该在中断、切页、换工具、会议插入、AI 会话暂停时，自动保存一个轻量的 **Intention Snapshot / 意图断点**，并在用户回到相关场景时给出低打扰 **Return Cue / 回程提示**。

一句话价值：

> 用户不再反复问“我刚才要继续干什么来着”；Personal AI 在正确页面、正确输入框、正确 AI 工具旁边，把刚才的目标、最后一步、下一步和证据带回眼前。

## 为什么值得做

Personal AI 已经保存了很多“过去发生了什么”：消息、网页、会议、AI 对话、操作、偏好、skill、关系、项目、反思和确认请求。但真实使用里，用户最常丢的不是长期历史，而是**短期工作记忆**：

- 打开 Jira 查一个估算，突然被 RingCentral 消息打断。
- 在 ChatGPT / Codex 里写了一半 prompt，又切回会议或网页找证据。
- 看完一段网页资料，忘了它和当前项目的下一步有什么关系。
- 会议前刚想好要问谁什么，会议开始后被新话题冲掉。
- 多个 AI 工具各自有上下文，但没有一个地方保存“当前任务的暂停点”。

这类记忆有几个特点：

1. **生命周期短**：几分钟到几天后就可能无用，不适合默认写进核心长期记忆。
2. **价值极高**：丢一次就要重新翻消息、网页、Jira、AI 对话。
3. **必须贴近现场**：它不应该藏在探索页，而应该在用户回到原网页、AI 输入框或会话时出现。
4. **需要低 review 成本**：系统应自动保存和衰减，只有跨隐私边界、外发、删除、长期事实写入时才要求用户确认。

## 本次输入信号

### Reminders 检查

本机 Reminders 可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。没有名为 `Personal AI` 的列表。

因此本次没有从 Reminder 随机抽取全新功能 idea，也没有需要标记 done 或写备注的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本轮通过 memory-service 只读 API 读取，没有写入远端数据。

关键统计：

- `messages.total=9508`，其中 `today=73`、`thisWeek=134`、`last90Days=2699`。
- `chunks.total=7739`，`relationships.total=50383`。
- 实体总量 `13796`，其中 `Project=2724`、`Person=1955`、`Topic=6120`。
- `confirmRequests.pending=49`，`reflectionThreads.active=704`，`actions.total=695`。
- 最近 action 样例包括多条 `delegate_openclaw` 外部核实，例如 `MTR-148115: Migrate AI Notes Update Flow from Fixed Interval Polling to Long Polling`、`codex · status`、`RCV W-T (Rooms): Join Meetings via QR · full_feature_delivery_version`。
- 最近 reflection thread 样例集中在 `Chrome Skills · platform`、`New AI Meetings Desktop Client · focus_areas`、`Robust Interactive Workflows from Skills-Q2 · jira_ticket`、多个 Jira / 项目事实跟进。

这些信号说明：Personal AI 已经有大量项目、人物、主题、反思和外部动作，但用户日常会在许多未闭环事项之间切换。系统现在更像能记住“事情很多”，还缺一个轻量层来记住“用户刚才暂停在哪一步，回来的时候该如何继续”。

## 已有能力避让

| 已有/搁置方向 | 解决什么 | 本能力的边界 |
|---|---|---|
| `Memory Day Pilot` | 日级 mission 编排 | Return Stack 是分钟/小时级的中断恢复，不做全天计划 |
| `Operation Memory Flight Recorder` | 完整跨工具操作 episode | Return Stack 不录全流程，只保存暂停点、下一步和最小证据 |
| `AI Context Passport` | 把任务上下文打包给外部 AI | Return Stack 可以生成 passport，但核心是本地恢复，不是外发交接 |
| `Scene Memory Autopilot` | 决定当前场景 silent/chip/card/context-pack | Return Stack 新增一等对象 `Intention Snapshot`，不是只筛选 recall 结果 |
| `AI Session Context Drift Radar`（搁置） | 追踪外部 AI 会话是否上下文漂移 | Return Stack 不要求可靠观察外部 AI 会话状态，只锚定本地页面、输入框、时间窗口和用户动作 |
| `Operation / Artifact / Decision` 系列 | 操作链、成果链、决策链 | Return Stack 是工作记忆断点，可以被它们消费，但不替代长期 episode |
| `Message Reaction` / `Topic Based Messages` 稍后处理 | 单条消息或主题延后 | Return Stack 跨网页、AI、Jira、会议和消息，保存的是“任务意图状态” |
| `Memory Authority Contracts` | 事实写入的证据权威 | Return Stack 默认是临时意图，不写长期事实；若要长期写入必须经过权威合约 |

本能力引入的新原语是：**短期、可衰减、可恢复的工作意图断点**。它不是又一个信息聚合页。

## 行业产品观察

### ChatGPT Pulse：主动记忆开始进入日常节奏

[ChatGPT Pulse](https://help.openai.com/en/articles/12293630) 会基于过去聊天、memory、反馈和连接应用，每天主动产出可扫读的视觉摘要，并支持保存、追问和反馈。它证明用户会接受 AI 主动把相关内容推回来，但 Pulse 是日级简报，不解决用户在具体网页或输入框里“刚才暂停点”的恢复。

Personal AI 的机会：把 proactive memory 从“明天早上看什么”下沉到“现在回到这个页面该接着做什么”。

### Gemini Scheduled Actions：定时 AI 行动已经成为自然期望

[Gemini Scheduled Actions](https://blog.google/products-and-platforms/products/gemini/scheduled-actions-gemini-app/) 支持让 Gemini 在特定时间或周期执行任务，例如早上总结日历和未读邮件，也可以把 prompt 转成 recurring action。它说明“未来某个时间帮我重新带回来”会成为普通交互。

Personal AI 的机会：Return Stack 的 snooze 不是普通提醒，而是带着上次任务状态、证据和下一步回流。

### Microsoft Recall：找回看过的东西很有价值，但还缺意图

[Microsoft Recall](https://support.microsoft.com/en-us/windows/retrace-your-steps-with-recall-aa03f8a0-a78b-4b3e-b0a1-2eb8ac48701c) 让用户 retrace steps，并提供 snapshot copy/delete、站点或 app 过滤和批量删除。它证明“回到某个瞬间”是强需求，也提醒隐私控制必须前置。

Personal AI 不应该复制全屏快照时间线。它应该更窄：少存截图，多存“当前目标、最后动作、下一步、证据 ref、隐私范围”。

### Notion 3.0 Agents：工作上下文和行动正在合并

[Notion 3.0](https://www.notion.com/en-gb/blog/introducing-notion-3-0) 强调 agent 可以创建 docs、build databases、search across tools、execute multi-step workflows，并理解用户工作方式。它证明知识工作 agent 的价值在于理解工作上下文并执行。

Personal AI 的机会：用户的上下文不在单一 Notion workspace，而在 RingCentral、Jira、会议、AI 对话、网页、本机操作之间。Return Stack 是让 agent/action 之前先有可靠“当前暂停状态”的底层。

### Granola MCP：上下文正在进入用户真正工作的 AI 工具

[Granola MCP](https://www.granola.ai/blog/granola-mcp-claude-chatgpt-cursor) 让 Claude、ChatGPT、Cursor 等工具直接查询会议 notes、action items 和 decisions。它说明上下文应该出现在用户深度工作所在的 AI 工具里，而不是留在单独产品页面。

Personal AI 的机会：Return Stack 可以向 Codex / Claude / ChatGPT 暴露“最近中断的工作意图”，让外部 AI 不只查历史会议，还能接住用户刚刚暂停的任务。

## 研究依据

### 中断恢复依赖目标编码和状态复述

Trafton、Altmann 等人的 interruption/resumption 研究指出，人在被打断前如果有时间准备，会通过编码恢复目标和复述当前状态来更快恢复任务。对产品的启发是：Personal AI 应该在切页、离开输入框、切换 app 的瞬间自动生成一个“我下一步要做什么”的断点，而不是等用户回来后再让用户回忆。

参考：[Preparing to resume an interrupted task](https://www.sciencedirect.com/science/article/abs/pii/S1071581903000235)。

### 自动 cue 比手写笔记更适合恢复编程任务

Microsoft Research 的 CHI 2010 研究 [Evaluating Cues for Resuming Interrupted Programming Tasks](https://www.microsoft.com/en-us/research/publication/evaluating-cues-for-resuming-interrupted-programming-tasks/) 调查了 371 位程序员，并比较自动 cue 与手写笔记。研究摘要显示，使用自动 cue 的开发者任务完成成功率约为 note-taking alone 的两倍，且更偏好按时间顺序呈现的具体 cue。

对 Personal AI 的启发：Return Cue 不应只是“你有一个任务未完成”，而要按时间顺序带出最后几个具体动作和下一步。

### LLM agent 也需要显式任务状态

[Task Memory Engine](https://arxiv.org/abs/2505.19436) 指出 LLM 在多步交互中容易 hallucinate、重复动作、误解用户修正，原因是线性上下文缺少对 evolving goals 和 task dependencies 的持久跟踪。它用动态图任务记忆来支撑 revision-aware agents。

Return Stack 可以把人的当前任务意图也建模成轻量任务图：当前目标、子任务、依赖证据、暂停原因、下一步动作。

### 长任务需要主动管理工作记忆

[Memory as Action](https://arxiv.org/abs/2510.12635) 把 working memory management 视为可学习的策略动作，指出长上下文仍需要精心管理来避免 attention dilution。[AI Agents Need Memory Control Over More Context](https://arxiv.org/abs/2601.11653) 则强调 artifact recall 和 state commitment 要分离，避免未经验证的内容变成持久记忆。

对本功能的启发：Return Stack 必须默认是临时 working memory，不应把每个断点都提交成长期事实；它可以被召回、衰减、合并、删除，并在需要长期化时走更严格的写入边界。

## 功能定义

### 一句话

Personal AI 在用户工作中断时自动保存短期意图断点，并在用户回到相关页面、输入框、会议或 AI 工具时，用低打扰 cue 帮用户继续刚才的任务。

### 是什么

- 一个跨页面、跨工具的短期工作记忆层。
- 一个按相关性、时间和未闭环程度排序的 Return Stack。
- 一个可在网页右下角、AI 输入框旁、Meeting Pilot、memory-exploring 中出现的 Resume Cue。
- 一个可以生成最小 resume packet 给 Codex / ChatGPT / Claude / 豆包的上下文片段。
- 一个默认自动衰减、默认本地优先、默认不外发的机制。

### 不是什么

- 不是截图全量记录。
- 不是新的任务管理器。
- 不是要用户手动维护的 GTD 清单。
- 不是把所有 pending confirm requests 换个页面列出来。
- 不是外部 AI 会话监控器。
- 不是无需用户确认就把临时想法写成长期事实。

## 核心体验

### 体验 1：离开前的静默意图断点

当系统检测到以下情况时，创建或更新 `Intention Snapshot`：

- 用户在 Jira / RingCentral / Google Docs / ChatGPT / Codex / Meeting Pilot 等高价值 surface 停留并发生有效操作。
- 输入框里有未发送草稿，或当前页面上下文和最近记忆命中同一项目/人/任务。
- 用户切换 tab、关闭页面、离开输入框、会议开始、长时间 idle。
- 当前场景有明确任务动词，例如“核实、估算、回复、总结、生成、比较、部署、问某人、跟进”。

大多数断点不打扰用户，只在本地或 memory-service 的短期层保存。

### 体验 2：回到相关场景时的 Return Cue

用户之后打开同一 Jira issue、相关 RingCentral thread、同一项目网页、AI 输入框或 Meeting Pilot 时，如果 `returnScore` 足够高，右下角出现一个小 cue：

- 标题：`继续刚才：MTR-148115 估算核对`
- 最后动作：`你上次停在 Jira comment 的 evidence 对齐`
- 下一步：`先核实 fixed interval -> long polling 的估算口径，再生成给 Codex 的上下文`
- 证据：`Jira / RingCentral / reflection_run / action queue`
- 动作：`继续`、`复制给 Codex`、`稍后`、`已完成`、`丢弃`

低置信度只进入 Return Stack，不弹出。

### 体验 3：输入框旁的 Resume Packet

在 ChatGPT、Claude、豆包、Codex Web、Jira comment、RingCentral reply 等输入框 focus 后，Personal AI 不直接写入内容，而是显示一个 compact icon。点击后可以插入一段 resume packet：

```text
我正在继续处理：MTR-148115 long polling 估算核对。
刚才停在：已看到 Dev Estimate Original=0.3，但仍需核实更精确细节。
下一步：请帮我列出需要向 BE/owner 确认的 3 个点，并生成 Jira comment 草稿。
可用证据：Jira memory、reflection_run action、最近 RingCentral 讨论。
不要做：不要把未核实状态写成已确认结论。
```

这复用 Compose Assist / Context Passport 的插入边界：用户最终决定是否插入、编辑、发送。

### 体验 4：Return Stack 面板

在 `memory-exploring` 或扩展侧边栏增加轻量列表：

- `现在可继续`：和当前页面/会议/输入框强相关。
- `今天暂停过`：当天被中断但未完成的断点。
- `稍后回流`：用户主动 snooze 的断点。
- `自动衰减`：低价值断点会 24-72 小时后自动归档，不占长期视图。

每个 item 显示：

- 任务名、来源图标、暂停时间、当前状态。
- 最后动作、下一步、证据数量。
- 静默原因或弹出原因。
- `完成 / 稍后 / 合并 / 丢弃 / 生成 Passport`。

### 体验 5：会议和 AI 对话中的回程提示

Meeting Pilot 场景：

- 会议开始前，如果有与参会人/项目相关的中断断点，显示 `带入会议` cue。
- 会议后，如果讨论覆盖了某个断点，自动把断点标为 `absorbed_by_meeting` 或生成新的 follow-up。

AI 工具场景：

- 用户打开 ChatGPT / Claude / Codex 相关会话时，Return Stack 只显示适合外发的 resume packet。
- 本地-only 或 restricted 证据只显示“本地证据存在”，不默认插入原文。

## 数据模型

### Intention Snapshot

```ts
type IntentionSnapshot = {
  id: string;
  userId: string;
  sceneKey: string;
  surface:
    | 'jira'
    | 'ringcentral'
    | 'google_doc'
    | 'google_sheet'
    | 'chatgpt'
    | 'claude'
    | 'doubao'
    | 'codex'
    | 'meeting'
    | 'browser'
    | 'desktop'
    | 'other';
  taskLabel: string;
  goal: string;
  lastAction: string;
  nextIntendedAction: string;
  pauseReason:
    | 'tab_blur'
    | 'page_close'
    | 'input_focus_loss'
    | 'meeting_started'
    | 'idle'
    | 'manual_pin'
    | 'ai_session_paused'
    | 'unknown';
  anchors: Array<{
    kind: 'url' | 'entity' | 'project' | 'person' | 'thread' | 'meeting' | 'source';
    value: string;
    label?: string;
    confidence: number;
  }>;
  evidenceRefs: Array<{
    type: 'message' | 'chunk' | 'entity' | 'action' | 'reflection_thread' | 'page' | 'meeting';
    id: string;
    label: string;
    scope: 'local' | 'safe_to_pack' | 'restricted';
  }>;
  sensitivity: 'normal' | 'internal' | 'restricted' | 'private';
  confidence: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  state: 'active' | 'snoozed' | 'resolved' | 'discarded' | 'absorbed' | 'expired';
  metadata?: Record<string, unknown>;
};
```

### Return Cue

```ts
type ReturnCue = {
  snapshotId: string;
  displayMode: 'silent' | 'chip' | 'card' | 'input_companion';
  returnScore: number;
  reason: string;
  quietReason?: string;
  primaryAction:
    | 'resume'
    | 'copy_resume_packet'
    | 'open_evidence'
    | 'snooze'
    | 'mark_done';
  receipt: {
    matchedAnchors: string[];
    hiddenEvidenceCount: number;
    restrictedEvidenceCount: number;
    lastSeenAt: number;
  };
};
```

### Resume Packet

```ts
type ResumePacket = {
  taskLabel: string;
  currentGoal: string;
  lastKnownState: string;
  nextStep: string;
  evidenceSummary: string[];
  constraints: string[];
  notAllowed: string[];
  freshness: {
    capturedAt: number;
    staleAfter: number;
    sourceWindow: string;
  };
};
```

## Return Scoring

建议先用规则 + LLM classification 的混合评分：

```text
returnScore =
  0.30 * anchorMatch
+ 0.20 * openLoopStrength
+ 0.15 * recency
+ 0.15 * effortToReconstruct
+ 0.10 * userInteractionSignal
+ 0.10 * sourceReliability
- 0.20 * privacyRisk
- 0.15 * repeatedDismissalPenalty
- 0.10 * lowInformationPenalty
```

弹出阈值建议：

- `>= 0.78`：当前页面显示 card。
- `0.62 - 0.78`：只显示 compact chip。
- `0.42 - 0.62`：进入 Return Stack，不主动弹。
- `< 0.42`：静默保存或直接衰减。

## 技术方案

### 采集层

可复用现有能力：

- Chrome content scripts：监听页面 URL、title、选中内容、输入框 focus/blur、站点类型、Personal AI icon surface。
- Desktop App：监听 AI 会话、agent session、文件/CLI adapter 的任务摘要。
- memory-service：接收 snapshot create/update，做去重、合并、衰减、召回。
- Context Recall / Scene Autopilot：用于当前页面匹配相关 memory。
- Source Memory / Webpage Memory：给页面证据 ref，不直接复制大段原文。
- Compose Assist / Context Passport：生成可插入 resume packet。

### 存储层

新增表建议：

```sql
CREATE TABLE working_intent_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  surface TEXT NOT NULL,
  task_label TEXT NOT NULL,
  goal TEXT NOT NULL,
  last_action TEXT NOT NULL,
  next_intended_action TEXT NOT NULL,
  pause_reason TEXT NOT NULL,
  anchors_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  confidence REAL NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  metadata_json TEXT
);

CREATE INDEX idx_working_intent_user_state_updated
  ON working_intent_snapshots(user_id, state, updated_at DESC);

CREATE INDEX idx_working_intent_user_scene
  ON working_intent_snapshots(user_id, scene_key, updated_at DESC);
```

新增 feedback/event 表：

```sql
CREATE TABLE working_intent_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  surface TEXT,
  scene_key TEXT,
  created_at INTEGER NOT NULL,
  metadata_json TEXT
);
```

### API

```text
POST /api/v1/working-intents/snapshots
GET  /api/v1/working-intents/return-stack?sceneKey=&surface=&limit=
POST /api/v1/working-intents/:id/event
POST /api/v1/working-intents/:id/resume-packet
POST /api/v1/working-intents/:id/snooze
POST /api/v1/working-intents/:id/resolve
POST /api/v1/working-intents/:id/discard
```

### 前端入口

1. Browser content script：
   - 在 Jira / RingCentral / AI 工具 / Google Docs / Sheets 中显示 compact cue。
   - 只在当前页面 anchor match 时显示。

2. Extension side panel：
   - Return Stack 列表和当前页面匹配解释。

3. `memory-exploring.html#/return-stack`：
   - 用于查找、合并、批量清理、调试。

4. Compose Assist：
   - 输入框 focus 后把 high-score snapshot 作为可插入 resume packet。

5. Meeting Pilot：
   - 会前显示相关断点，会后吸收或生成 follow-up。

## 隐私和边界

默认策略：

- 断点默认是短期 working memory，不进入核心 profile。
- 默认保存摘要和证据 ref，不保存完整输入框内容；草稿只保存 redacted summary，除非用户手动 pin。
- restricted / private 页面只允许本地 ref，不生成外发 packet。
- 外发到 ChatGPT / Claude / Codex / 豆包前必须走 egress gate，用户确认插入。
- 断点过期后自动归档或删除，保留最小 feedback 统计。
- 用户可以对站点、app、项目、人、source type 关闭 Return Cue。

高责任边界：

- 不能自动发送消息。
- 不能自动提交 Jira comment。
- 不能把未核实的临时下一步写成事实。
- 不能把 private/restricted evidence 原文插入外部 AI。
- 不能把用户丢弃的断点反复弹出。

## MVP 范围

### P0 做

- 支持 Jira、RingCentral、ChatGPT/Codex 类 AI 输入框、Meeting Pilot 四类 surface。
- 创建 `Intention Snapshot`，包含 goal、last action、next intended action、anchors、evidence refs。
- Return Stack API 和扩展 side panel 简版列表。
- 当前页面 high-score cue。
- Resume packet 生成和复制，不自动发送。
- Snooze / done / discard / quiet feedback。
- 24-72 小时自动衰减。

### P0 不做

- 不做全屏截图或 OCR timeline。
- 不做外部 AI 会话可靠跟踪。
- 不做跨设备同步。
- 不做自动执行。
- 不做复杂 task graph 编辑器。
- 不做大型 dashboard 首页。

## 里程碑

### Phase 0：设计验证

- 完成本 plan 和 demo。
- 从真实 `esone.qiu` 数据里采样 10 个跨工具任务，手工模拟 snapshot。
- 验证 cue 文案是否能让用户在 10 秒内恢复下一步。

### Phase 1：只读 Return Stack

- 新增 storage/API。
- content script 只创建/展示候选，不外发。
- side panel 显示当前页面匹配断点。
- 加入 discard/snooze/done feedback。

### Phase 2：Resume Packet

- 接入 Compose Assist / Context Passport 渲染。
- 支持复制到 Codex / ChatGPT / Claude / 豆包。
- 加入 privacy / egress receipt。

### Phase 3：会议和 agent session

- Meeting Pilot 会前/会后吸收断点。
- Codex CLI / Claude Code / Cursor agent session 抽取 producedArtifacts、verificationSignals 和 nextStep，生成断点。

### Phase 4：自动合并和学习

- 学习用户在哪些 surface 接受/拒绝 cue。
- 自动合并同一项目/人/URL 的断点。
- 重复成功的 resume packet 可转给 Skill Foundry。

## 成功指标

体验指标：

- 用户点击 `继续` 后 30 秒内进入目标页面或输入框的比例。
- `copy_resume_packet` 后被用户保留/编辑发送的比例。
- Cue dismissal rate，尤其是同一 scene 重复打扰率。
- 用户手动搜索“刚才/继续/上次做到哪”的次数下降。
- 被标记 `done` 的断点中，后续是否产生有效 output / comment / meeting follow-up。

质量指标：

- 高置信 cue 的用户接受率。
- hidden/restricted evidence 正确抑制率。
- stale snapshot 弹出率。
- 与 Day Pilot / Autopilot / Passport 重复提示率。

工程指标：

- Snapshot 生成延迟。
- Return Stack 查询延迟。
- 断点表增长和自动衰减效果。
- content script 对页面性能影响。

## 风险与对策

### 风险 1：变成新的通知噪音

对策：

- 默认 silent，只有高 `returnScore` 才弹。
- 同一 scene 30 分钟内最多 1 次。
- 用户 dismiss 两次后自动降低该 scene 阈值。
- Return Stack 面板比弹窗更重要。

### 风险 2：保存太多临时垃圾

对策：

- 短生命周期，自动衰减。
- 低信息断点不写远端，只保留 sessionStorage/local cache。
- 合并相邻断点，按 sceneKey 聚合。

### 风险 3：隐私和外发风险

对策：

- 保存证据 ref 和摘要，不默认保存完整草稿。
- restricted evidence 不进入 resume packet。
- 外发前显示 source/scope receipt。
- 支持站点过滤和一键清空某站点断点。

### 风险 4：误判用户意图

对策：

- Cue 文案使用“可能要继续”，不伪装成确定结论。
- 下一步来自可解释 evidence 和最近动作。
- `错了` / `不是这件事` feedback 会训练 scene threshold。

### 风险 5：和现有能力混淆

对策：

- UI 文案只围绕“继续刚才”，不叫任务、项目、决策、成果。
- Day Pilot 负责今天做什么；Return Stack 负责刚才停在哪。
- Operation Flight Recorder 负责完整过程；Return Stack 负责暂停点。
- Context Passport 负责交给外部 AI；Return Stack 负责本地恢复。

## 真实使用场景

### 场景 1：Jira 估算核对被聊天打断

用户在 Jira / Personal AI Ask 里处理 `MTR-148115: Migrate AI Notes Update Flow from Fixed Interval Polling to Long Polling` 的估算核对。系统看到用户正在围绕 `Dev Estimate Original=0.3`、外部核实和 RingCentral 讨论来回切换。此时 RingCentral 有新消息，用户离开 Jira。

Personal AI 静默保存断点：

- 目标：核实 MTR-148115 估算口径。
- 最后动作：看到已有 action 仍要求“继续核实更精确细节”。
- 下一步：问 BE/owner 或让 Codex 生成核实清单。
- 证据：Jira memory、reflection_run、RingCentral 项目讨论。

20 分钟后用户打开 ChatGPT 或 Codex，输入框旁出现 `继续刚才`。点击后得到一个 resume packet，用户不用重新翻 Jira 和 action queue。

### 场景 2：会议前想问的问题被午饭中断

用户打开 Meeting Pilot 准备 `New AI Meetings Desktop Client · focus_areas` 相关会议，刚看完项目事实跟进和最近消息，准备在会上问“当前 focus areas 是否仍然覆盖 Skills-Q2 interactive workflows”。午饭打断。

会议开始时，Meeting Pilot 显示 Return Cue：

- `你刚才准备问：focus areas 是否仍覆盖 Robust Interactive Workflows from Skills-Q2`
- `相关证据：active reflection thread、最近项目消息、AI Meetings Desktop Client`
- 动作：`带入会议问题`、`稍后`、`不相关`

用户点 `带入会议问题`，它进入会前 cue cards，而不是被埋在长期记忆里。

## Demo

Demo 文件：[`working-memory-return-stack-demo.html`](./working-memory-return-stack-demo.html)。

Demo 模拟三个真实入口：

- Jira 页面上的 `继续刚才` card。
- RingCentral 线程旁的低打扰 chip。
- AI 输入框里的 resume packet 插入面板。

它不是独立产品首页，而是模拟集成在其他网页中的效果。

## 最终建议

不建议把 **Working Memory Return Stack / 工作记忆回程栈** 作为下一个可实现新能力。它的用户痛点真实，但当前方案最关键的前提是“系统能在用户离开前静默识别当前意图”，这个前提在真实工作中不可靠。

如果未来重新评估，应先从更可靠的入口开始，而不是从弱行为信号推断意图：

- 用户显式点击 `记录当前意图` / `稍后继续这个任务`。
- Codex app、Meeting Pilot、Jira 自动化、agent session 等内部能力主动发出结构化 checkpoint。
- 已有明确任务对象的场景，例如未发送草稿、正在运行的 agent、已创建的 follow-up session、用户手动 pin 的网页。
- 只把这些 checkpoint 作为 Context Passport / Operation Flight Recorder / Message Reaction / Meeting Pilot 的补充，不先做独立一级能力。
