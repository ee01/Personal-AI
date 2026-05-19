# 新能力：Context Gap Radar / 上下文缺口雷达

> 生成日期：2026-05-17 CST  
> Codex 会话标题建议：新能力：上下文缺口雷达  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`memory-gap-radar-demo.html`](./memory-gap-radar-demo.html)

## 结论

建议设计一个新的 Personal AI 能力：**Context Gap Radar / 上下文缺口雷达**。

它不是再做一个记忆搜索页，也不是更大的 agent 控制台，而是在用户把任务交给 Personal AI、OpenClaw、Codex、Claude、豆包或任意 AI 之前，先做一次轻量的 **context preflight**：

- 这个任务到底要完成什么。
- 当前记忆里已经有哪些证据和候选锚点。
- 哪些关键槽位缺失，继续执行会失败、误查、误写或浪费 token。
- 哪个问题最值得问用户，问完就可以继续。
- 哪些缺口其实是工具能力缺口，不应该伪装成用户没说清。

一句话价值：

> Personal AI 不再等 agent 跑失败后才说“缺信息”，而是在发送、委派、查证、写回之前，把缺的上下文压缩成一个最小问题，让用户一键确认后继续。

## 为什么要做

Personal AI 的目标是保存用户与 AI、网页、消息、会议、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话中提供记忆关联提示。现有方向已经覆盖很多“记住”和“带过去”的能力：

- `AI Context Passport`：把一件事的上下文打包交给其他 AI。
- `Memory Lens`：在当前网页或屏幕旁提示相关记忆。
- `Memory Trust Console`：治理记忆可信度、冲突和过期。
- `Decision Time Machine`：回答历史决策为什么这么定。
- `Operation Memory Flight Recorder` / `Personal Skill Foundry`：把做事过程沉淀成 episode 和 skill。
- `Agent Memory Control Tower`：更重的多 agent 协作塔台，目前已搁置。

这些能力默认假设“要给 AI 的上下文是足够明确的”。真实工作里更常见的问题是：用户随手说一句“查一下 BE 进展”“帮我把 sprint 改一下”“AI 先修一遍我再看”，人能凭语境猜到，agent 却需要明确的 Jira、表格、项目、权限、写回边界、成功标准和恢复策略。

如果 Personal AI 不先识别缺口，就会出现三种体验问题：

1. **假装理解**：AI 选择了错误的项目、错误的表格或错误的时间窗口。
2. **行动失败**：外部 agent 跑了一圈才发现没有 Jira/Glip/网页能力、没有 URL、没有权限或没有恢复状态。
3. **用户疲劳**：系统抛出一串泛泛澄清问题，用户还不如自己重新解释。

上下文缺口雷达的目标是把这件事做成产品级体验：**只在关键缺口影响结果时打断，只问一个最高价值问题，能从记忆推断的就给出候选按钮，问过的答案会成为下次的默认槽位。**

## 本次输入信号

### Reminders 检查

本机 Reminders 可枚举列表包括：

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

没有发现名为 `Personal AI` 的列表。因此本次没有从 Reminder item 随机抽取全新 idea，也没有需要标记 done 或写备注的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。HTTP memory-service `/health` 可达但返回 degraded，`/api/v1/recall` 超时；本次改用 SSH 只读查询远端 `memory-service/data/users/esone.qiu` 下的 `memory.db` 和 markdown 文件，没有写入远端状态。

读到的关键轮廓：

- `messages_raw` 里有约 8693 条 `glip`、316 条 `meeting`、146 条 `calendar`、125 条 `doubao_chat`、36 条 `chatgpt`、9 条 `jira` 记忆。
- `chunks` 里有 `glip`、`reflection_thread`、`daily_log`、`meeting`、`calendar`、`jira`、`user_core` 等来源，说明 Personal AI 已经有跨渠道上下文。
- `USER_CORE.md` 目前只稳定沉淀了基础身份：Esone Qiu、Scrum Master、Asia/Shanghai；长期偏好、关键人物和稳定工作口径还很稀疏。
- 近期日常包括 Nova Brandy、RCVSDK、AI Notes、Rooms/NC Story Points、Nova WhatsApp/Adapter PoC、AI 工具培训、Jira 修复、Google Sheet 计划表和 sprint planning。
- 真实行动队列里多次出现 `delegate_openclaw` 失败或需要确认：
  - “外部查证: AI VBG 的 BE 部分完成情况如何”缺少正式交付确认。
  - “外部查证: engg-dashboard 需要核对什么”缺少 Jira/内部页面可访问入口。
  - “请假开始前 3h 设置 Glip 状态”和“请假结束后恢复 Glip 状态”缺少 Glip/RingCentral 状态读写能力与恢复快照。
  - “你好飘哈喽”这类模糊问题缺少具体事项、表格地址、Jira ticket 或外部数据源。
- 用户工作记忆里频繁出现“AI 先修一遍我再看”“Esone's AI 帮我更新 sprint / Dev estimate / Jira 字段”等模式，说明用户愿意把执行前置给 AI，但系统必须先判断任务是否具备执行锚点。

这些信号共同指向一个产品空位：

> Personal AI 已经能记住很多材料，也开始能委派行动，但还缺一个“执行前把缺口问清楚”的 UX 层。

## 行业趋势与竞品参考

### ChatGPT Memory：记忆可管理，但缺少跨工具 preflight

OpenAI 的 ChatGPT Memory 支持 saved memories、reference chat history、自动管理 saved memories、搜索/排序、恢复历史版本、Pulse 夜间异步研究等能力。参考：[OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-persistent-memory-in-chatgpt)。

可借鉴点：

- 记忆必须可见、可删、可管理。
- 自动记忆要避免 memory full，并允许用户优先级管理。
- 记忆可以服务异步摘要，而不只是聊天。

缺口：

- 它主要在 ChatGPT 内部使用记忆，不负责判断“这个任务交给另一个工具前还缺哪个 Jira、表格、权限或恢复状态”。

### Claude Context Engineering：核心问题从 prompt 转为 context curation

Anthropic 把 context engineering 定义为在每次模型调用前策展和维护最佳 token 集合，强调 agent 长任务需要管理 tools、MCP、外部数据、历史消息等动态上下文。参考：[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)。

Claude Developer Platform 的 context editing 和 memory tool 进一步说明：长任务会耗尽有效上下文，需要清理 stale tool results、保存关键经验并跨会话复用；Anthropic 报告 memory tool + context editing 在内部 agentic search 评测上相对 baseline 提升 39%，context editing 在 100-turn web search 评测里减少 84% token 消耗。参考：[Managing context on the Claude Developer Platform](https://claude.com/blog/context-management)。

可借鉴点：

- 上下文不是越多越好，而是每次行动前都要选择最小高信号上下文。
- 长任务需要“保留什么、丢掉什么、何时读取什么”的策略。

Personal AI 的机会：

- 把 context curation 做成用户可见的 preflight，而不是隐藏在 agent runtime 里。

### Gemini Import Memory：跨 AI 迁移正在产品化

Gemini 已提供“把其他 AI 的 chat history 和 memories 转入 Gemini”的产品页，支持导入偏好摘要、上传其他 AI provider 导出的 zip，并强调可以继续沿用过去对话。参考：[Import your AI chat history and memories to Gemini](https://gemini.google/cm/import-memory/?hl=en-GB)。

可借鉴点：

- 用户不想每换一个 AI 就重新解释自己。
- AI 记忆正在从单平台能力变成迁移和互操作能力。

Personal AI 的机会：

- 进一步解决“迁移后仍然缺执行槽位”的问题。导入历史不等于任务准备充分，执行前仍要判断目标、证据、工具和风险是否齐备。

### 研究：LLM 很容易不问该问的问题

2026 年 survey 把 agent memory 形式化为 write-manage-read loop，并指出未来挑战包括 causally grounded retrieval、trustworthy reflection、learned forgetting、privacy governance 和 multimodal embodied memory。参考：[Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670)。

澄清问题方向的研究也说明了这个能力的重要性：

- [CLAMBER](https://arxiv.org/abs/2405.12063) 指出当前 LLM 在识别和澄清模糊查询方面实用性有限，CoT 和 few-shot 也可能带来过度自信。
- [InfoQuest](https://arxiv.org/abs/2502.12257) 发现模型面对 hidden context 的开放请求时，经常给出泛泛回答，而不是有效收集关键信息。
- [Structured Uncertainty guided Clarification for LLM Agents](https://arxiv.org/abs/2511.08798) 直接针对 tool-calling agent 的模糊或不完整指令，提出用结构化不确定性和 EVPI 选择要问的问题，报告 SAGE-Agent 在模糊任务上 coverage 提升 7-39%，澄清问题数量减少 1.5-2.7 倍。

这正是 Context Gap Radar 的核心产品原则：**不是让 AI 多问问题，而是让 AI 知道哪个问题最值得问，何时应该停止问并执行。**

## 产品定义

### 核心对象：Task Frame

每个用户输入、页面触发、自动化候选或外部 agent 委派，在执行前都会被解析成一个 `Task Frame`：

```ts
type TaskFrame = {
  id: string;
  source: 'ask' | 'composer' | 'ringcentral' | 'jira' | 'calendar' | 'agent_delegate' | 'desktop';
  userText: string;
  inferredIntent: string;
  targetObjects: TaskObject[];
  requiredSlots: TaskSlot[];
  evidenceAnchors: EvidenceAnchor[];
  missingGaps: ContextGap[];
  capabilityGaps: CapabilityGap[];
  riskLevel: 'low' | 'medium' | 'high';
  readiness: number;
  recommendedQuestion?: ClarifyingQuestion;
  suggestedExecution?: ExecutionPlan;
};
```

### Slot 类型

第一版重点支持这些高频槽位：

| Slot | 示例 | 为什么重要 |
|---|---|---|
| `target_entity` | AI VBG、Nova Brandy、RCVSDK | 避免查错项目 |
| `source_anchor` | Jira ticket、Google Sheet、RingCentral thread、meeting event | 避免无来源行动 |
| `time_window` | 本周、上个 sprint、5 月底前 | 避免召回范围过大 |
| `desired_output` | 简短回复、Jira comment、表格更新、handoff plan | 避免产物不合用 |
| `write_boundary` | 只读、草稿、可写 Jira、可发消息 | 避免越权写入 |
| `recipient_context` | 发给 Fred、Sophia、群组、自己留档 | 决定语气和隐私边界 |
| `success_criteria` | 查证完成、字段已写、状态已恢复 | 决定何时停止 |
| `restore_snapshot` | 原 Glip 状态、原字段值 | 所有临时写操作都需要 |
| `tool_capability` | Jira read、Glip presence write、Google Sheet read | 区分“用户没说清”和“系统没有能力” |

### Gap 类型

| 类型 | 含义 | 处理 |
|---|---|---|
| `missing_anchor` | 缺 Jira、Sheet、thread、URL、meeting id | 从记忆找候选，问用户选哪个 |
| `ambiguous_entity` | BE、AI VBG、engg-dashboard 等有多种解释 | 给出 top candidates + 证据 |
| `insufficient_permission` | 需要登录/权限/API key | 生成 capability gap，不归咎用户 |
| `unsafe_write` | 可能写 Jira、发消息、改状态 | 降级为草稿或请求明确确认 |
| `restore_required` | 临时改状态但没有原状态快照 | 先读取快照或改为提醒 |
| `low_evidence` | 召回只有摘要，没有原始证据 | 只给 tentative answer，不自动执行 |
| `stale_context` | 相关记忆太旧或被新证据覆盖 | 请求时间窗口或刷新来源 |

## 用户体验

### 1. 输入框旁的 preflight 气泡

场景：用户在 RingCentral、Personal AI Ask、Jira、Google Sheet 或 AI chat 输入：

> 查一下 AI VBG 的 BE 部分完成情况如何，原计划我记得是 5 月底交付。

系统不直接委派 agent，而是在发送前生成一张小卡：

- 已识别：`AI VBG`、`BE = backend?`、`目标 = 查证交付完成情况`、`时间 = 5 月底前`。
- 已找到候选：`Google Sheet: AI 使用情况`、`历史记忆: BE 部分 2025-11/12 有批量交付`。
- 缺口：没有正式交付确认来源。
- 推荐问题：**“用这个 Google Sheet 作为查证源，还是需要查 Jira/会议记录？”**
- 操作：`用 Sheet 查`、`查 Jira`、`只生成待确认回复`、`手动补链接`。

### 2. Agent 委派前的 readiness gate

当 `proposed_actions` 准备调用 OpenClaw、Codex 或其他 agent：

- `readiness >= 0.8` 且低风险：可自动执行。
- `0.45 <= readiness < 0.8`：只问一个高价值问题。
- `readiness < 0.45`：不执行，生成“缺口摘要 + 建议补充”。
- 存在 `capability_gap`：不问用户无关问题，直接说明缺工具或权限，并给出配置/降级路径。

### 3. 页面内模拟效果

Demo 模拟的是 RingCentral 群聊 + Personal AI 侧边预检面板：

- 用户要把“查 BE 进展”委派给 AI。
- Context Gap Radar 在右侧列出 `Ready / Missing / Capability` 三组槽位。
- 系统只突出一个最值得问的问题。
- 用户选择候选后，readiness 提升，并生成可执行 agent brief。

Demo 文件：

```text
docs/progressing/memory-gap-radar-demo.html
```

### 4. 不增加一个重页面

MVP 不建议先做一级导航页面。它应该先作为以下入口的内嵌能力：

- Personal AI Ask 输入框。
- RingCentral / Glip content script 侧边提示。
- Jira 页面快捷操作。
- Context Assist / Composer Guard 发送前检查。
- `proposed_actions` / `confirm_requests` 队列的执行前检查。

后续可以增加一个“Gap Review”页面，但那是运维/调试入口，不是用户高频入口。

## 与已有能力边界

| 已有/规划能力 | 主对象 | Context Gap Radar 的边界 |
|---|---|---|
| Memory Lens | 当前页面相关记忆 | Lens 告诉用户“有哪些相关记忆”；Gap Radar 判断“继续执行还缺什么” |
| AI Context Passport | 已知上下文打包外发 | Gap Radar 是 Passport 生成前的完整性检查 |
| Memory Trust Console | 记忆可信度治理 | Gap Radar 只关注当前任务是否可执行 |
| Memory Egress Firewall | 外发隐私/安全 | Gap Radar 决定缺哪些上下文；Firewall 决定哪些上下文能不能发 |
| Decision Time Machine | 决策证据链 | Gap Radar 会要求决策类问题具备足够时间窗口和证据锚点 |
| Operation Flight Recorder | 操作 episode | Gap Radar 可以把一次成功澄清 + 执行记录作为 episode 输入 |
| Personal Skill Foundry | 技能沉淀 | Gap Radar 的 slot schema 可以成为 skill 的 precondition |
| Agent Control Tower | 多 agent 分工与监控 | Gap Radar 不调度多 agent，只做单次任务 preflight |

## MVP 范围

### Phase 0：只读分析与日志

目标：不改变用户路径，先在后台记录 task frame 和 gap。

范围：

- 在 `proposed_actions` 创建时同步生成 `TaskFrame`。
- 对现有失败行动做离线回放，标注失败原因属于 `missing_anchor`、`capability_gap`、`unsafe_write` 还是 `ambiguous_entity`。
- 输出内部 debug JSON，不展示 UI。

验收：

- 至少能解释最近 20 个 failed / confirm-required action 的主要缺口。
- 对 `Glip 状态恢复` 能识别为 capability + restore snapshot gap。
- 对 `外部查证: engg-dashboard` 能识别为 missing source anchor + tool capability gap。

### Phase 1：Ask / proposed_actions preflight

目标：在 Personal AI 内部 Ask 和自动行动队列里可见。

范围：

- `POST /api/v1/context-gaps/analyze`
- `POST /api/v1/context-gaps/:id/answer`
- `POST /api/v1/context-gaps/:id/accept-assumption`
- `POST /api/v1/context-gaps/:id/create-confirm-request`
- `TaskFrame` 存储与 evidence refs。
- 一个 compact React/Vue 组件：`ContextGapPreflightCard`。

入口：

- Personal AI Ask。
- Confirm request detail。
- Proposed action detail。

验收：

- 用户输入含糊任务时，系统最多提出 1 个推荐问题。
- 用户选候选后，系统能生成可执行 brief。
- capability gap 不会被包装成普通用户澄清问题。

### Phase 2：RingCentral / Jira / Google Sheet 内嵌

目标：把 preflight 带到真实工作页面。

范围：

- RingCentral message composer 中检测“查一下/帮我更新/AI 先修一遍”等委派表达。
- Jira 页面识别 ticket context，自动填充 `source_anchor`。
- Google Sheet 页面识别 sheet URL、tab、selected range，作为候选 evidence anchor。
- 与 Composer Guard / Context Assist 共用页面上下文 adapter。

验收：

- 在 RingCentral 里触发任务时，能读取当前 thread、联系人、最近消息作为候选上下文。
- 在 Jira ticket 上触发任务时，不再问 ticket 是哪个。
- 在 Google Sheet 上触发任务时，可把当前 sheet/range 纳入 source anchor。

### Phase 3：学习用户默认槽位

目标：让问过的问题减少。

范围：

- 对每类任务学习默认 output contract，例如：
  - Jira 更新：先生成草稿 comment，写入前确认。
  - 外部查证：需要原始 URL 或明确系统来源。
  - Glip 状态：必须读取原状态快照。
  - sprint planning：默认输出 Story Points / fixVersion / due date / owner checklist。
- 把高频答案写入 `user_profile_items` 或独立 `task_preference_items`。
- 允许用户在卡片上点 `以后默认这样`。

验收：

- 同类任务第二次触发时，系统减少至少一个澄清问题。
- 默认项可撤销、可查看来源。

## 技术设计

### 新增数据表

```sql
CREATE TABLE context_gap_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref_id TEXT,
  user_text TEXT NOT NULL,
  inferred_intent TEXT,
  readiness REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  state TEXT NOT NULL DEFAULT 'open',
  recommended_question_json TEXT,
  suggested_execution_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE context_gap_slots (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  slot_label TEXT NOT NULL,
  state TEXT NOT NULL,
  value_json TEXT,
  candidate_values_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0,
  blocking BOOLEAN NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(event_id) REFERENCES context_gap_events(id)
);

CREATE TABLE context_gap_answers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  slot_id TEXT,
  answer_text TEXT,
  selected_value_json TEXT,
  remember_scope TEXT NOT NULL DEFAULT 'none',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(event_id) REFERENCES context_gap_events(id)
);
```

### 复用现有表

- `messages_raw` / `chunks`：召回候选证据。
- `entities` / `relationships` / `relationship_radar_people`：实体 disambiguation。
- `proposed_actions`：行动执行队列。
- `confirm_requests`：用户确认入口。
- `memory_feedback_events`：记录用户是否觉得问题有帮助。
- `personal_skills` / `skill_versions`：把稳定 preflight schema 变成技能 precondition。

### 服务模块

```text
memory-service/src/core/ContextGapRadarService.ts
memory-service/src/core/TaskFrameExtractor.ts
memory-service/src/core/ContextGapQuestionSelector.ts
memory-service/src/routes/contextGaps.ts
src/context-gap/ContextGapPreflightCard.tsx
src/context-gap/contextGapClient.ts
```

### 分析流程

1. **Normalize**：清洗用户输入、来源页面、当前 thread/Jira/sheet context。
2. **Intent classify**：判断是 search、external_check、write_update、status_change、delegate_agent、meeting_prep 还是 draft_message。
3. **Slot schema select**：根据 intent 选择必填/可选槽位。
4. **Memory retrieval**：用 recall / FTS / entity search 找候选目标和证据。
5. **Capability check**：查 provider binding、skill binding、tool availability。
6. **Risk gate**：写入、外发、状态变更进入确认模式。
7. **Question selection**：按 blocking、EVPI、用户成本、候选置信度选择一个问题。
8. **Brief generation**：槽位齐备后生成 agent brief 或 answer brief。

### Question selector 策略

第一版不需要训练模型，采用规则 + LLM scorer：

```ts
score(question) =
  0.42 * unblockProbability
  + 0.22 * riskReduction
  + 0.18 * candidateConfidence
  + 0.10 * reuseValue
  - 0.08 * userCost;
```

约束：

- 一次最多问一个推荐问题。
- 如果缺的是 capability，不问用户“你是不是想要 X”，而是展示缺能力和降级路径。
- 如果用户输入本身是 brainstorming，不进入 preflight。
- 如果风险高，即使槽位齐备也必须走确认。

## UI 文案原则

### 好的卡片

- “我找到了 2 个可能的来源，选一个就能继续。”
- “缺 Jira ticket；当前页面没有 ticket，上次相关的是 NOVA-9946。”
- “这需要改 Glip 状态，但我没有当前状态快照。先只创建提醒。”
- “如果是 AI VBG BE，用这份 Sheet 查；如果不是，请贴链接。”

### 避免的卡片

- “请提供更多信息。”
- “你想怎么做？”
- “我无法完成。”
- “当前上下文不够。”

## 指标

### 体验指标

- `clarification_question_count_per_task`：平均每任务澄清问题数，目标 <= 1.2。
- `first_question_resolution_rate`：第一个问题后可执行比例，目标 >= 70%。
- `agent_failure_due_to_missing_context_rate`：因缺上下文失败比例，目标下降 50%。
- `capability_gap_misclassified_rate`：能力缺口误判成用户澄清的比例，目标 < 5%。
- `user_accept_assumption_rate`：用户接受系统默认候选比例。

### 业务指标

- 自动行动从 `failed` 到 `ready` 的转化率。
- Confirm request 中“用户无需改写直接确认”的比例。
- 外部查证任务平均完成时间。
- 低价值打扰反馈率。

## 风险与约束

### 1. 过度打扰

风险：系统总觉得缺东西，每次都问。

控制：

- 只问 blocking gap。
- 低风险、可逆、只读任务允许带假设执行。
- 用户可关闭某类 preflight。

### 2. 问错问题

风险：系统问了低价值问题，用户觉得烦。

控制：

- 记录 question usefulness feedback。
- 同类任务失败后回放 slot schema。
- 问题必须绑定明确 slot 和执行收益。

### 3. 伪造能力

风险：系统把没有工具能力的事包装成“请你确认一下”。

控制：

- capability gap 独立建模。
- provider binding / skill binding 必须可验证。
- 没能力时只能给配置路径、降级为草稿或人工提醒。

### 4. 隐私与外发

风险：为了补上下文，把太多历史消息交给外部 AI。

控制：

- 与 Memory Egress Firewall 协作。
- 预检卡只展示必要 evidence title / source，不默认展开敏感正文。
- 外发 agent brief 需要标记 `share_level`。

### 5. 学到错误默认值

风险：用户一次选择被长期当成默认。

控制：

- `以后默认这样` 必须显式点击。
- 默认值带来源和最近使用时间。
- 高风险写操作不允许完全默认。

## 竞品差异

| 产品/方向 | 做得好的地方 | 缺口 | Personal AI 机会 |
|---|---|---|---|
| ChatGPT Memory | 记住偏好、历史、可管理 | 不知道用户当前 Jira/Glip/Sheet 工具是否可执行 | 跨工具 preflight |
| Claude memory/context editing | agent runtime 上下文管理强 | 面向开发者 API，不是用户日常 UX | 把 context engineering 显性化 |
| Gemini import memory | 降低换 AI 的重新解释成本 | 导入历史后仍可能缺行动锚点 | 对每次任务做 slot readiness |
| 企业 RAG / Search | 能基于知识库找资料 | 常常回答而不是询问缺口 | 明确“缺哪一个来源就能继续” |
| Agent frameworks | 可以 tool-call 和 retry | retry 往往发生在失败后 | 执行前阻断失败 |

## 推荐实施顺序

1. **先做 proposed_actions 离线回放**  
   成本最低，能用现有失败样本验证 slot schema。

2. **再接 Personal AI Ask / Confirm Request**  
   用户能看到价值，但不用碰复杂网页 DOM。

3. **最后接 RingCentral/Jira/Sheet 页面内浮层**  
   这一步体验最好，但需要 site context adapter 稳定。

## 为什么这个功能值得推进

这个能力切中 Personal AI 的下一阶段：系统已经有很多记忆，也开始能把记忆转成行动，但真正决定日常体验的是“行动前能不能把上下文补齐”。

它满足用户三个高频需求：

1. **少解释**：系统从记忆里找候选，让用户点选而不是重写背景。
2. **少失败**：在 agent 跑之前发现缺 Jira、Sheet、权限、恢复状态和成功标准。
3. **越用越懂**：用户每次回答的缺口都会变成下次同类任务的默认槽位。

亮点不是“AI 又多了一个页面”，而是 Personal AI 变成了用户和所有 AI/agent 之间的上下文协商层：

> 它不急着回答，也不盲目行动；它知道什么时候该问，问什么最值钱，问完怎么继续。

