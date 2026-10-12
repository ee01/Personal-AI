# 新能力：Attention Triage / 注意力分诊（消息 → 关注项 → 待办提案）

> 状态：仅规划，待决策。本轮未改任何运行时代码。
> 生成日期：2026-10-09 CST
> 代码核查基线：工作区 `develop` 分支，引用均为 `path:line`。
> Demo：[`memory-attention-triage-demo.html`](./memory-attention-triage-demo.html)（Glip 宿主页内的 Lens 分诊卡 + Task Center 落账）
> 来源：E-72 第二轮。用户给出真实场景：上级 Sophia 在「敏捷教练-RC China」群发布 Q4 Goal Setting 任务，截止 10/13/2026；问「Personal AI 看到这条消息时是否应立即响应，这是不是 Instinct 的方向，我们是否已覆盖」。

## 1. 一句话结论

**是 Instinct 的方向，也是我们早就宣称要做的方向，但今天的链路在三个地方断了。** Instinct 的「它会先给你发消息」（航班改期、忘了取消的预订、没回的邀请）与这个场景同构；差别在于 Instinct 直接去做，我们停在「建议创建待办」让用户一键拍板。现状：扩展靠一条硬编码的关注规则「Sophia 发送的所有消息」能弹通知，消息也会入库，但 (1) 消息里的日期一律按字符串入库，Heartbeat 的 deadline 检查永远看不见；(2) LLM 抽取出的 `is_action_item` 从未被消费，v3 的 `action_item / event / open_question` kind 没有任何通知或动作消费者；(3) 系统不知道 Sophia 是上级、用户是敏捷教练。本方案补上这条「消息 → 关注项 → 待办提案 → 到期提醒 → 闭环」的链路，并给它 OpenClaw standing intents 式的前瞻记忆生命周期。

## 2. 两个使用场景

### 场景 A：上级的群发截止日（用户给出的例子）

Sophia 在「敏捷教练-RC China」发：「Team 2026 Q4 Goal Setting Task 已发布，请大家及时完成并在 WD 提交。Deadline for Employee Goal Setting: 10/13/2026」。

- **Before（develop 现状）**：扩展规则 3 命中发送者 → bot 通知一条；ingest 落 `messages_raw` + 实体 Sophia / Goal Setting + `co_occurs`；`entity_properties` 若有也是 `value_type='string'`；Heartbeat 不产生 deadline 候选；Task Center 零写入。10/13 当天没有任何提醒。
- **After**：ingest 时分诊命中 `deadline`（日期 10/13/2026，未来 4 天）+ `request`（「请大家…提交」，受众包含我）+ 来源权重（发送者是已确认上级，群是我所在团队群）。Lens 在该消息下方出现一张分诊卡：「截止 10/13 · 提交 Q4 Goal Setting（WD）· 建议创建待办」，按钮：创建待办 / 已完成 / 不相关。点「创建待办」→ `proposed_actions(task_kind='remind')` 落账，提醒计划 T-48h、T-24h、当天早晨各一次，Day Pilot 的 open loop 段同步出现。用户 10/12 在 WD 提交后回群「done」→ 夜间 E 阶段把该关注项标 completed，剩余提醒取消。

### 场景 B：别人在等我的回复

同事在私聊问「@你 周五前能把 retro 的 action items 整理出来吗？」，用户当时在开会没回。

- **Before**：`CatchUpService` 的 `WAITING_PATTERN`（`?`、`@`、`帮我`、`请问`…）只在用户离开 2 小时回来时出现在 catch-up brief 里；没有到期概念，没有闭环。
- **After**：分诊命中 `request` + `deadline(周五)` + `addressed_to=me`。Lens 卡「同事在等你回复 · 周五前」。用户点「创建待办」或忽略；若 48 小时内用户在该线程回复，关注项自动 completed；若周五早上仍 open，Day Pilot 置顶一次。

## 3. 现状（代码事实）

| 环节 | 现状 | 出处 | 判定 |
|---|---|---|---|
| 扩展捕获 | Glip 消息经 LLM 分析（prompt 身份只有用户名）→ 命中默认关注规则 3「Sophia (Jinmei) Lin 发送的所有消息」→ bot / Chrome 通知 → `shouldStore` 则 ingest | `src/messageDealing.ts:859-863`、`:1210-1301`；`src/prompts/messageAnalysis.ts:184` | 能通知、能入库；靠硬编码 sender 规则 |
| importance | 由扩展 `priority` 标签映射 high=0.75 | `IngestionPipeline.ts:110-117` | 可用作分诊输入 |
| LLM 抽取 | schema 含 `is_action_item`，但定义后无消费者 | `IngestionPipeline.ts:80`、`:952` | 断 |
| v3 抽取 | `kind` 枚举含 `action_item / event / open_question / risk` | `v3/ExtractionContract.ts:13-14` | 有数据无消费者（v3 目录无 notification / proposed_actions 引用） |
| 属性日期 | ingest 写 `entity_properties` 一律 `'string'`；唯一写 `'date'` 的是 `ProjectTimelineExtractor`（仅 watched project 命中时） | `IngestionPipeline.ts:1246`；`ProjectTimelineExtractor.ts:270-273` | 断 |
| Heartbeat deadline | 只查 `value_type='date'` 且 48h 内 | `HeartbeatLoop.ts:889-905` | 因上一行永远为空 |
| 等待信号 | `WAITING_PATTERN` 仅用于 catch-up brief | `CatchUpService.ts:35,79` | 有识别无生命周期 |
| 组织关系 | `social_edges.relation_type` 有 `manager`，唯一 writer 是手工 `POST /profile/social`；ingest 只写 `co_occurs` | `migrations/002_profiles.sql:52-65`；`routes/profile.ts:328`；`IngestionPipeline.ts:1212-1215` | 无生产者 |
| 角色 | `role` 槽位要用户在 UserProfilePage 手填；扩展只同步 name / timezone | `ProfileManager.ts:261-270`；`UserIdentitySyncService.ts:57-69` | 空 |
| `proposed_actions` 写入方 | Reflection、MessageRule、Outreach、ActionExecutor、taskCenter / agentTasks / confirmRequests / ask 路由；**ingest 零次** | `ActionRepository.ts:293-301` 及各调用方 | 断 |
| 投递 | `ProactivityPolicy` 已有 `deadline` 类型，missCost 0.95；`NotificationCenterService` 把 deadline 路由到 `todo` lane | `ProactivityPolicy.ts:27-57`；`NotificationCenterService.ts:822-845` | 现成 |
| 规则自动化 | 关注项带 `automationPrompt` 可生成 `notify_user` + `delegate_openclaw` | `MessageRuleAutomationPlanner.ts:998-1163` | 可覆盖，但需用户为每条规则写 prompt，不是通用能力 |
| UI | 无「从消息一键生成建议待办」；`taskCenter.ts:286-290` 注释提到 snooze 建 reminder 但扩展未调用 | `src/backendNotifications.ts`；`TaskCenterPage.vue` | 缺卡片 |

## 4. 为什么这是「写入时的薄分诊」而不是「写入时的重整理」

与 `memory-sleep-time-reconciliation-plan.md` 的原则一致：整理（merge / supersede / 矛盾）放睡眠期；但**时间敏感的关注项不能等到夜里**。分诊只做三件便宜的事：

1. 复用已经在跑的那一次 v3 抽取（`MEMORY_WRITE_V3_SHADOW` 已开），读它的 `action_item / event / open_question` 与日期字段，不新增 LLM 调用。
2. 确定性规则：日期解析（中英混合格式、相对日期「周五前」）、请求词、受众（@我 / 我所在群 / 私聊）、发送者权重（已确认上级 / 高频协作者）。
3. 写一条 `attention_candidates` 行并让 Lens 展示；不写 `proposed_actions`，不写 `entity_properties`。**只有用户点「创建待办」才落账**（agent-task-ledger「人是一等 gate、永不投机生成任务」）。

夜间 E 阶段负责整理：同一截止日跨多条消息去重、根据后续证据（用户回复、WD 提交记录、Jira 状态）标 completed、过期清理、把 open 项喂给 one-pager 的 `open_loops` 段。

### 4.1 场景里会出现什么信息，扩展要监测到什么颗粒度（2026-10-09 补）

先说颗粒度原则：**分诊的原子单位是「一条有边界的事件」，不是 DOM 变化，也不是屏幕像素。** 聊天是一条消息（带前后 N 条线程上下文），Jira 是一次字段变更，日历是一条事件增删改，网页是一个页面 capsule 或一段划选。扩展今天已经按这个颗粒度捕获（`contentScriptGlip.tsx`、`contentScriptJira.ts`、`calendar_events`、`SourceMemoryCaptureService` 的 dwell / scroll / selection 信号），本方案不新增监测面，只给每个事件补齐分诊需要的字段。

| 场景 | 信息类型（用户看到的） | 分诊关心的字段 | 扩展需要补的 | 不监测 |
|---|---|---|---|---|
| Glip 消息 | 广播 / 通知、请求（对我 / 对团队）、提问、承诺（我的 / 他人的）、决定、状态更新、日期与截止、时间协商、链接与附件、@ 提及、表态 | 发送者 entity、群与成员数、@ 列表、reply-to、线程前 3 条、日期 span、请求动词 span、受众 span（claim attribution 的 speech-mode） | 可见性（消息在视口 ≥ 1.5s 才算「看到」）、reply-to 与线程上下文、群成员数 | 已读回执、他人私聊、键盘输入、滚动细节 |
| Jira | 指派给我、状态变更、评论 @ 我、due date 变更、blocked 标记、sprint 变更 | 字段 diff（old → new）、操作者、issue 与我的关系（assignee / reporter / watcher） | 字段级 diff（今天只有页面级） | 他人 issue 的无关变更 |
| 日历 / 会议 | 邀请、改期、取消、会前材料、会后 action items（转写） | 时间变化、参与者、是否需要我准备 | 会后 action item 的 owner 字段 | 会议音频本身（已有转写路径） |
| 网页（Confluence / Google Docs / 表单 / 文章） | 待我填写的表单（如 WD 任务）、我被 @ 的文档评论、与 watched project 相关的页面 | 页面 capsule + 划选；表单的截止字段 | 无新增；沿用 capture 信号 | 全文 OCR、全站爬取 |
| 我自己的动作 | 我发出的回复、我创建的任务、我在表单提交 | 作为 `completed` 证据与 `commitment` 来源 | Compose 发送回执、表单提交回执（只记「提交了」，不记内容） | 未发送的草稿内容 |

补齐这些字段后，分诊输入契约 `TriageInput` 才能填满：`kinds[]`（来自 v3 抽取）、`dates[]`、`requestVerbs[]`、`audience`、`senderWeight`（§5.2）、`importance`、`visibility`。

### 4.2 会产生什么动作，哪些要固化（2026-10-09 补）

不是只有「纯当下提示」。按**固化层级**分四级，级别越高越需要用户动作：

| 级 | 名称 | 产物 | 谁触发 | 持久化 | 例子 |
|---|---|---|---|---|---|
| L0 | 当下提示 | Lens 卡（Passive） | 系统自动 | 只写 `memory_exposures`（I9：展示 ≠ 确认） | 消息旁「截止 10/13 · 建议创建待办」 |
| L1 | 关注项 | `attention_items` 行（candidate / proposed / dismissed / completed） | 系统自动 | **总是持久化**：用于跨消息去重、夜间 completed 判定、`not_relevant` 学习、一页纸 `open_loops` 段 | 同一截止日第二条消息不再出卡 |
| L2 | 承诺的动作 | `proposed_actions` 行 | **用户点按钮** | 持久化 + 生命周期（冷却 / 预算 / 过期 / 取消） | 待办、只提醒、standing intent、草稿、日历占位提案、委派、evidence watch |
| L3 | 耐久记忆 | `user_profile_items` / `social_edges` / `profile_slots` | **用户确认 chip** | 持久化，进一页纸 identity | 「Sophia 是我的上级」「我是敏捷教练」 |

L2 的动作类型（都走 `proposed_actions`，`task_kind` 已有 push / agent / remind / dev / reflection / outreach）：

| 动作 | 触发器 | 落点 | 是否需要二次确认 |
|---|---|---|---|
| 待办 `task` | 用户点「创建待办」 | Task Center 任务 + 可选提醒 | 否（点击即是确认） |
| 只提醒 `remind` | 用户点「只创建提醒」 | 时间触发，T-48h / T-24h / 当天 | 否 |
| 条件提醒 `standing_intent` | 用户说「等 Sophia 回复再提醒我」 | 事件触发，FTS 预过滤，冷却 24h、最多 3 次、90 天过期 | 否 |
| 回复草稿 `draft` | 用户点「帮我起草」 | Compose Assist 草稿，**永不自动发送** | 发送由用户 |
| 日历占位 `calendar_hold` | 消息含时间协商 | 提案卡，确认后才写日历 | 是 |
| 委派 `delegate` | 用户选「让 agent 去查 / 去做」 | OpenClaw / ACP executor，经 `ActionReadinessService` | 是（write 模式） |
| 状态监控 `evidence_watch` | 「这个 Jira 变 ready 时告诉我」 | `evidence_watch_contract`，零 LLM | 否 |

规则：L0 → L1 自动；L1 → L2 必须用户一次点击；L2 → 外部副作用（发送、写日历、改 Jira）必须再确认或走 allowlist（agent-task-ledger「人是一等 gate」）；L3 永远走确认 chip。这样回答了「要不要固化」：**检测结果固化（L1），承诺固化（L2），但没有用户动作的东西永远不会变成任务或外发。**

## 5. 方案

### 5.1 关注项类型与生命周期

| kind | 触发信号 | 到期 | 自动 completed 的证据 |
|---|---|---|---|
| `deadline` | 未来日期 + 任务动词（提交 / 完成 / 回复 / 交付） | 解析出的日期 | 用户在同线程 / 同主题回复完成词；Jira / WD 等一手记录 |
| `request` | 请求词 + 受众含我 | 显式日期或默认 3 个工作日 | 用户回复该发送者 |
| `commitment` | 我自己说「我来 / 我周五给你」 | 显式日期或默认 3 个工作日 | 用户后续消息含交付词 |
| `waiting` | 我问了别人、对方未回 | 默认 2 个工作日 | 对方回复 |
| `open_question` | v3 `open_question` kind 且与我的 workstream 相关 | 7 天 | 新证据恢复（Today Pilot 已有逻辑） |

生命周期（对齐 OpenClaw standing intents 与 `rehearsal` 的 stale 语义）：`candidate → proposed(用户看到卡) → accepted(落 proposed_actions) | dismissed | completed → armed → fired(冷却 24h) → done(fire budget 3 次耗尽) | expired(到期后 7 天) | cancelled(用户显式)`。取消是持久状态，永不从对话里推断取消（ProEvent 2026 指出主动代理最难的就是取消）。

### 5.2 发送者关系解析（SenderRelationResolver，2026-10-09 第二次修订）

「是不是我的上级」只是最强的一种信号。分诊需要的是**这个发送者对我有多重要、这条消息是不是冲着我来的**，所以解析分四层，**上一层答得出就不往下查，答不出就继续**；每层都允许「不知道」，不强行编关系：

| 层 | 数据源 | 读什么 | 成本 | 典型答案 |
|---|---|---|---|---|
| L0 画像 identity | `user_profile_items`（`manager` / `role` / `organization` / `team`，`user_confirmed=1`），经一页纸 identity 段缓存 | 发送者 entity id 是否等于 `manager`；我的 role | 一次内存比较 | 「是直属上级」「我是敏捷教练」 |
| L1 社交关系 | `social_edges`（`relation_type` colleague / manager / report / friend / client / vendor，`strength`、`confidence`、`user_confirmed`，`migrations/002_profiles.sql:52-65`） | 我 → 发送者的边；优先 confirmed，其次 confidence ≥ 0.7 的 inferred | 一次索引查询（`idx_social_edges_to`） | 「是我的 report」「是客户」 |
| L2 行为关系 | `RelationshipRadarService`（radar state core / active / rising / dormant / watch）、`BehaviorAffinityService`（outcome 加权）、`relationships(co_occurs)` 频次 | 近 30 / 90 天互动频率、互惠（我是否也常回他）、是否同在 watched project | 两次聚合查询，可缓存到一页纸 `people` 段 | 「core 协作者」「30 天 27 次」 |
| L3 场景上下文 | 本条消息：`@我` / 私聊 / 群成员数 / 群名含我的团队名 / reply-to 我的消息 / 线程里我是否发过言 | 受众与直接性 | 消息内字段 | 「群发含我」「直接 @我」 |

- **写入规则不变**：L0 / L1 的 confirmed 值只由用户一次性确认 chip 写入（`durable identity 必须用户确认`）。chip 的问题由 L1 / L2 的证据生成：L1 有高置信 inferred 边就问「Sophia 是你的上级？」；只有 L2 高频互动就问「Sophia 是你的同事 / 上级 / 其他？」。确认同时写 `user_profile_items` 与 `social_edges`（后者 `user_confirmed=1`），两者由同一事务维护，不再区分「数据源」与「镜像」。
- **权重合成**：`senderWeight = max(L0: 1.0 manager / 0.8 report, L1: confirmed 0.8 · inferred 0.5, L2: core 0.6 · active 0.4 · rising 0.3, 默认 0.1) + L3 加成（@我 +0.3、私聊 +0.2、reply-to 我 +0.2、群发含我 +0.1）`，封顶 1.0，进 `ProactivityPolicy.utilityV2` 的 `needScore`。扩展「关注项」规则命中直接置 1.0（§5.3.1）。
- **解释性**：卡片回执显示命中的层与证据（「上级（已确认）」或「近 30 天互动 27 次，未确认关系」），用户可以从回执直接进入确认 chip。
- **为什么不只查画像**：画像只有用户亲口确认过的少数人；团队里大多数发送者没有 confirmed 关系，但 L2 的行为证据足以判断「这个人的请求值得出卡」。为什么不只查关系表：它今天没有生产者，等它有数据之前 L2 是唯一可用的信号。
- 受众判定用 claim attribution 的 speech-mode：`请大家` + 我在群 → `addressed_to=team_including_me`；`@我` / 私聊 → `me`；他人之间的对话 → `others`，不产关注项。
- 权重：`manager` +0.3、`@me` +0.3、私聊 +0.2、我的 watched project +0.2；进入 `ProactivityPolicy.utilityV2` 的 `needScore`。

### 5.3 Surface 与打扰预算

- **Lens 卡**（Passive，无 LLM）：出现在原消息下方，不改消息已读状态（设计红线：观察不产生副作用）。
- **Task Center**：accepted 项以 `task_kind='remind'` 落 `proposed_actions`，`recurrence_spec` 写三次提醒计划；现有 `TaskCenterMaintenanceService` 周期逻辑可复用。
- **提醒**：Heartbeat 新增读 `attention_items` 的 `armed` 行（替代只读 `entity_properties.date`），经 `ProactivityPolicy`（deadline missCost 0.95）投 `notification_records(todo lane)`。
- **Day Pilot**：open 项进 mission 聚类的 `open_loop_pressure`；遵守 Attention Budget（每日 ≤ 3 次打扰、同 mission 2 小时不重复）。
- **一页纸**：open 项即 `open_loops` 段（见 `memory-resident-one-pager-plan.md`）。

### 5.3.1 能力归属与「关注项」的关系

- **归属**：这个能力横跨三层，各归其位。检测层（分诊）属于 ingest 的确定性步骤；展示层（消息旁的卡）属于 **Memory Lens**，是 Lens 的一种新卡型 `attention`，与现有 Rest / Hover Peek / Expanded Card 共用首屏仲裁与用户总开关（`docs/features/memory_lens.md`）；账本层（accepted 后的待办与提醒）属于 **Task Center**。对用户只说一句话：「Lens 看到重要消息时会在旁边建议创建待办」。
- **与扩展现有「关注项 / Concerned Items」的关系**：今天的关注项（`src/messageDealing.ts:859-863` 默认规则、`chrome.storage.local.concernedItems`）是「用户 / 开发者预置的 sender 或话题规则 → 命中即通知」。它恰好就是用户说的「很确定命中的重要消息」。本方案不替代它，而是把它当作分诊的最高权重输入：规则命中 → `senderWeight=1.0`，分诊卡直接出现在该消息旁并与通知合并（不双发）。用户新增关注项时多一个可选项「命中时建议创建待办」。
- 分诊卡的三个按钮扩展为「创建待办 / 创建提醒（只到期提醒不建任务）/ 已完成 / 不相关」，对应 `task_kind='remind'` 的两种 `recurrence_spec`。

### 5.4 与既有 plan 的关系

| plan / 能力 | 关系 |
|---|---|
| `agent-task-ledger-plan.md` §十 Intent Inbox | 分诊卡就是 Intent Inbox 的「消息来源车道」；六条确认规则（一页摘要、溯源、AI 推断显式标记）直接套用 |
| `memory-day-pilot-plan.md` Attention Budget / Evening Closeout | 提醒走其预算；Closeout 的「新 open loop / 已关闭承诺」候选改由本方案的 ledger 提供 |
| `memory-proactivity-cost-asymmetry-plan.md` | 复用 `utilityV2` 与 COST_MATRIX，不新增配额 |
| `memory-reflection-runtime-governance-plan.md` 方案 D | 「会不会被完成」是监控不是反思：completed 判定走 evidence watch，零 LLM |
| `memory-sleep-time-compute-plan.md` catch-up | `WAITING_PATTERN` 升级为分诊规则之一；catch-up brief 改读 ledger |
| `rehearsal`（`docs/features/rehearsal.md`） | Rehearsal 管「未来场景该说什么」，本方案管「未来时点该做什么」；共用 cue 匹配与 stale 降权语义 |
| `relationship-memory-radar-plan.md` | per-person open loop 由本 ledger 提供；manager 确认 chip 的落点是 `social_edges` |
| `MessageRuleAutomationPlanner` | 用户自定义规则继续可用；本方案是无需配置的默认能力 |
| `memory-sleep-time-reconciliation-plan.md` E 阶段 | 夜间去重 / completed / 过期 / 喂 one-pager |
| `memory-write-provenance-gate-plan.md` | 只有 `origin_class ∈ {owner, observed}` 的消息能产关注项；心跳 / 反思产物不产 |

### 5.5 明确不做

- 不自动创建待办、不自动回复、不自动提交 WD、不自动改日历（人是一等 gate；评论区 #79 #108 对越权的担忧）。
- 不做任务管理器；Task Center 仍是账本。
- 不从对话推断「取消」；不在 Passive 面调在线 LLM。
- 不自动写 manager / role；只通过一次性确认 chip。
- 不做 agent-to-agent 协调。

## 6. 数据契约

- `attention_items(id, user_id, kind, title, due_at, addressed_to, source_unit_id, source_message_id, sender_entity_id, weight, status, fire_count, last_fired_at, cooldown_until, expires_at, accepted_action_id, completed_evidence_id, created_at, updated_at)`；幂等键 `(user_id, kind, normalized_title, due_at)` 用于跨消息去重。
- `attention_feedback(item_id, verdict ∈ {accepted, dismissed, not_relevant, completed}, at)` → 回流 `ProactivityPolicy` 校准与 `memory_feedback_events`。
- 分诊输入契约：`TriageInput { unit kinds, dates[], requestVerbs[], audience, senderWeight, importance }` → `TriageDecision { kind, due_at, confidence, reasons[] }`，纯函数，可单测。
- 提醒计划：`recurrence_spec = { fires: ['-48h', '-24h', 'due_day_morning'], cooldownHours: 24, maxFires: 3 }`。

## 7. 实施阶段

| 阶段 | 内容 | 天数 | 门槛 |
|---|---|---|---|
| Phase 0 | 只读统计 `esone.qiu` 近 90 天消息中含未来日期 + 请求词的条数、其中来自高频发送者的比例；人工标注 60 条作为 eval 种子 | 2 | 数字进本 plan |
| Phase 1 | `attention_items` 表 + 纯函数分诊 + ingest 挂钩（shadow：只写表不展示） | 3 | shadow 命中率 / 误报率达标 |
| Phase 2 | Lens 分诊卡 + 创建待办 / 不相关 / 已完成 + manager 确认 chip | 4 | 卡片在 Glip 宿主页可见；不改已读 |
| Phase 3 | Heartbeat 读 ledger 提醒 + 生命周期（冷却 / 预算 / 过期 / 取消） | 3 | 三次提醒计划正确；取消持久 |
| Phase 4 | 夜间 E 阶段去重 / completed 证据 / 喂 one-pager 与 Day Pilot | 3 | 场景 A 全链路通过 |

## 8. Evals（上线门槛）

新增 `memory-service/evals/attention-triage/`，用真实 `esone.qiu` 消息脱敏构造：

| case 组 | 最少条数 | 门槛 |
|---|---|---|
| 含未来截止日的请求（中英混合日期格式） | 20 | 召回 ≥ 0.85；日期解析正确 ≥ 0.9 |
| 负例：过去日期、他人之间的截止日、通讯稿 / 新闻、转发 | 15 | 误报 ≤ 15% |
| 受众判定（@我 / 群 / 私聊 / 他人） | 12 | 准确 ≥ 0.9 |
| 跨消息同一截止日去重 | 8 | 重复卡 0 |
| 生命周期（冷却、3 次预算、取消持久、completed 证据） | 10 | 违规 0 |
| 不产生副作用（已读状态、自动回复） | 全部 | 违规 0 |

纳入 `eval:memory-abilities` 回归门。LLM-judge 仅用于「卡片标题是否可理解」的软指标。

## 9. 风险与缓解

- **误报打扰**：Passive 卡不弹窗，只在消息下方；提醒走 Attention Budget；`not_relevant` 反馈回流权重。
- **日期解析错**：卡片显示解析出的日期供用户纠正；纠正写入 Teach Once 的 scoped 纠正。
- **受众误判把别人的任务当成我的**：`others` 不产卡；`team_including_me` 卡片标「群发」字样，权重低于 `me`。
- **与用户自定义规则冲突**：规则命中优先，分诊卡合并进同一条通知，不双发。
- **成本**：分诊零新增 LLM；夜间 E 阶段只对 open 项做证据匹配（确定性 + 可选 cheap LLM，预算帽见 reconciliation plan）。

## 10. 可观测性与回滚

- 指标：候选数 / 展示数 / accepted / dismissed / not_relevant / completed、提醒触发数、到期未处理数。
- Flag：`ATTENTION_TRIAGE_ENABLED`（shadow / lens / remind 三档）、`ATTENTION_MANAGER_CHIP_ENABLED`。
- 回滚：关 flag 即停；已 accepted 的 `proposed_actions` 保留。

## 11. Demo 说明

`memory-attention-triage-demo.html` 模拟 Glip 团队群页面：Sophia 的消息、消息下方的 Lens 分诊卡（截止日、受众、来源权重、创建待办 / 只创建提醒 / 已完成 / 不相关四个按钮）、manager 确认 chip、点「创建待办」后的 Task Center 卡（三次提醒计划与生命周期状态）、点「不相关」后的回执。文案中文，消息原文保留原语言。

## 12. 文档交接

实现后并入 `docs/features/task_center.md`（新增「从消息到待办提案」节）、`docs/features/memory_lens.md`（分诊卡）、`docs/features/today_pilot.md`（open loop 来源），更新 `docs/index.md`，删除本 plan，demo 移至 `docs/demo/`。

## 13. 推荐决策

Phase 0 + Phase 1（五天，零 LLM，shadow）先量误报率；达标后做 Phase 2 的 Lens 卡。这个方向是 E-72 讨论里唯一能在两周内让用户「看到 Instinct 式主动性」的改造，且完全在「人拍板」的边界内。
