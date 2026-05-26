# Today Pilot / 今日领航

_最后更新: 2026-05-26_

## 是什么

Today Pilot 是 Personal AI 的每日任务和会前准备层。它从用户已经沉淀的原始记忆、日历、通知、待办、反思线程、技能和关系数据中，整理出“今天真正需要注意的事情”。

它不是新的聊天入口，也不是输入框写作助手。它的目标是让用户在每天开始工作、打开会议列表或进入会议时，直接看到 Personal AI 已经提前准备好的上下文。

## 大白话运行逻辑

Today Pilot 像每天早上的“今日注意力筛选器”：它从日历、会议、记忆、通知、行动队列、反思线程、Rehearsal 预演提醒、人物关系和技能建议里挑出今天真的值得看的几件事，并把原因和下一步说清楚。

结果主要受这些因素影响：

1. 今日时间窗口：今天的会议、临近 deadline、近期活跃消息和待处理动作权重最高。
2. 真实行动信号：owner、deadline、decision、approval、blocked、follow-up、meeting prep 这类信号比泛泛 FYI 更重要。
3. 证据可追溯性：没有来源证据或只有系统 heartbeat 的内容不能进入主 mission。
4. 去噪规则：旧通知、重复 digest、没有 nextBestAction 的聚类会被降级或排除；旧 Rehearsal 默认降权，不把历史预演当成今天必须做的事。
5. 预生成缓存：会前准备优先使用 nightly/backfill 生成的 meeting prep；用户刷新时再触发补齐。

## 核心功能

### 1. 今日 Mission

首页展示 3-7 个具体事项，而不是分类汇总。

每个 mission card 包含：

- 具体标题。
- 你要做什么。
- 为什么现在值得关注。
- 优先级和状态。
- 相关人、项目和证据。
- 可复制给其他 AI 的 context pack。

Today Pilot 只做日级引导，不替代 Decision Center、Action Queue、Topic、Skill Library 等强状态页面。需要处理的具体动作仍跳转到对应页面完成。

折叠态也必须能看懂，不依赖展开后才知道含义。首页卡片至少直接展示：

- `你要做`：一句可执行的下一步，例如“确认 NPM Registry 迁移影响范围，并更新需要改配置的项目或 owner”。
- `为什么出现`：一句证据驱动的出现原因，例如“2 条来自 glip 的最近窗口内记忆信号指向同一件事”。

展开态再展示证据、建议动作、待确认问题、context pack 和反馈按钮。

### 1.1 Mission 质量标准

Today Pilot 的 mission 必须是“事情”，不是“分类”或“系统事件”。可进入主列表的 card 需要满足：

- 有明确用户动作：用户看完应知道下一步是准备、确认、回复、整理、审批、复查还是静默。
- 有真实证据：至少 1 条可追溯来源，不能只基于空泛统计。
- 有今日理由：会议临近、近期消息集中、动作待确认、事实冲突会影响今天上下文、技能建议有复用价值等。
- 标题可读：避免直接暴露 opaque id、内部 topic uuid 或系统化标题。
- 不制造假紧急：陈旧信号和重复系统通知不能因为分数高而成为 critical mission。
- 只有泛泛 FYI 或高重要度但没有 follow-up / 决策 / 截止 / 失败 / 会议 / 反思 / 技能等行动信号的消息，不进入主列表。

以下内容默认不进入 Today Pilot 主列表：

- `notify_user + heartbeat + 事实跟进` 这类系统巡检通知。
- 只有 “was revisited by heartbeat / recent evidence item(s) / 事实变化” 的通知。
- `Weekly Dream Digest`、heartbeat digest 等只说明系统生成了摘要/梦境的通知。
- 超过近期窗口且没有 `truth_conflict`、deadline、reminder、approval、decision 等强动作语义的旧通知。
- 超过 14 天的旧 `事实跟进` reflection/action，除非已经被新的真实证据重新激活。
- 已经过期超过 14 天、且不需要审批的旧 queued action。
- 无法生成具体 `nextBestAction` 的聚类。
- 只描述 Jira 字段变更的消息，例如 `fixVersion` 或 sprint 被更新，但没有 owner/risk/decision/confirm 等动作语义。
- 只有“互动频率高 / 关系上下文值得保留”的 Relationship Radar 记录；关系类 card 必须带明确 follow-up、承诺、待回复、变冷风险、owner/ETA 或会前准备语义，才可作为独立 mission。普通关系历史只作为 meeting prep/context pack 的证据使用。

陈旧信号会降权：没有未来 due time 的 mission 会按最新证据年龄加 penalty，避免 2-3 周前的系统信号压过今天的新消息和会议。

日历信号会同时从 `calendar_events` 和被摄入为 `messages_raw.source_type=calendar` 的 raw memories 进入扫描。两条入口使用同一套清洗和行动性判断：

- `Calendar event:`、`Description:`、会议链接和 dashboard URL 不应进入卡片标题。
- daily / weekly / sync / all-hands / standup 等重复会议默认不进入主列表，除非文本里有明确 owner、risk、decision、approval、confirm、准备材料等行动语义。
- Jira dashboard 或 meeting link 本身不算行动语义。
- raw calendar memories 只进入当前 Today Pilot 的近期/未来窗口；远期会议不会因为同步为 message 而提前进入今日排序。
- 普通通知必须带具体 follow-up / owner / deadline / decision / approval / retry 等行动信号；仅说明同步完成、后台运行完成或泛泛 FYI 的通知不进入 mission。
- 高重要度消息里的普通问句不会因为带 `?` / `？` 就自动变成 open loop。问句只有同时指向 owner、risk、deadline、decision、approval、reply、fix/retry、准备或类似动作语义时，才会进入 Today Pilot 排序。

### 2. 会前准备

Today Pilot 会提前扫描当天和近期会议，根据日历事件和相关记忆生成 meeting prep。

会前准备包含：

- 会议背景摘要。
- 会中可以使用的 cue cards。
- 命中参会人、会议标题、项目或日历事件的 Rehearsal 预演提示。
- 建议带进会议的问题。
- 相关风险或未关闭事项。
- 证据来源。
- Meeting Pilot 可消费的 context pack。

RingCentral Video Home 只是 Today Pilot 会前准备的消费面：用户打开会议列表时，直接看到已准备内容，不需要输入“本次目标”或点击生成。

#### 2.1 Storyline 生成提示

部分会议不是只需要会前摘要，而是可能需要用户准备一段可讲述材料，例如分享、汇报、复盘、培训、workshop、项目 review 或对外解释。Today Pilot 可以在生成 meeting prep 的同一轮 LLM 判断里，附带产出一个轻量 `storylineOpportunity`，用于决定是否在会前准备卡片里展示 `生成故事线草稿` 按钮。

这个判断不应是独立的关键词匹配规则。关键词可以作为成本控制的弱 prefilter，但不能作为最终展示依据。最终是否展示提示，必须由 LLM 基于以下结构化上下文判断：

- 日历事件：标题、描述、时间、组织者、参会人、链接类型和是否重复会议。
- 召回证据：相关消息、会议、Jira、资料记忆、AI 对话、skill、Rehearsal、关系上下文。
- 输出意图：这场会是否需要对别人表达、讲述、培训、同步进展、解释方案或复盘经验。
- 素材规模：是否有足够证据形成至少 3 个 story segment，而不是只有一条 cue 或一个待办。
- 受众范围：是否面向小组、社区、项目干系人或多人 review；普通 1:1 / daily sync 默认不展示，除非证据显示用户要做明确分享或复盘。
- 风险边界：证据是否主要来自私聊、内部 Jira、meeting URL 或未确认推断；如果风险过高，只显示内部版/需打码提示，或者不展示按钮。

`storylineOpportunity` 只决定是否显示按钮，不自动生成完整 Storyline。按钮文案需要让用户知道“点击后才生成”，例如：

- `生成 8 分钟分享故事线`
- `整理复盘故事线`
- `生成 Slides 提纲`

展示时应同时显示一个很短的 reason，例如：

> 这场会有 4 类可讲素材：Cursor workshop、Codex/Jira 自动化、NotebookLM 资料理解、OpenClaw skill。

如果 LLM 判断没有足够素材，或这只是普通同步会，Today Pilot 不显示 Storyline 入口，只保留普通 meeting prep。

推荐的结构字段：

```ts
interface StorylineOpportunity {
  available: boolean;
  confidence: number;
  storyType?:
    | 'sharing'
    | 'status_report'
    | 'retro'
    | 'training'
    | 'proposal'
    | 'weekly_update';
  buttonLabel?: string;
  oneLineReason?: string;
  audienceHint?: string;
  estimatedLengthMinutes?: number;
  evidenceClusters?: Array<{
    label: string;
    sourceKinds: string[];
    evidenceCount: number;
  }>;
  blockedReasons?: string[];
  suggestedArtifact?:
    | 'speaker_notes'
    | 'slides_outline'
    | 'ringcentral_post'
    | 'docs_brief';
}
```

会前准备 UI 中的注入位置建议：

1. 放在 meeting prep 摘要和 cue cards 之间，作为一个小条幅，而不是新的大卡片。
2. 折叠态只显示 `为什么值得生成`、`素材数`、`生成按钮`、`不需要`。
3. 点击 `生成` 后打开 `memory-exploring.html#/storylines/draft?source=today_meeting_prep&prepId=...&target=...`，由 Storyline draft 页面调用 `POST /api/v1/storylines/draft` 生成草稿。
4. 用户点 `不需要` 后，Video Home 先写入本地 `chrome.storage.local.storylineOpportunityDismissals`，key 由 `prepId + sourceHash + eventExternalId` 组成，默认 30 天不再展示同一条提示。P0 不复用 Day Pilot card feedback，因为这里不是 mission/card 级反馈。
5. Storyline draft P0 不持久化、不自动写回 Slides / Docs / RingCentral，只提供可人工复核和复制的 speaker notes、Slides 提纲、Docs 简报或分享帖草稿。

当前 P0 的实现边界：

- `storylineOpportunity` 存在于 `today_meeting_preps.llm_usage_json.storylineOpportunity`，并在 `TodayPilotMeetingPrepRecord` 与 `ContextAssistResponse` 中以 typed field 暴露。
- `POST /api/v1/storylines/draft` 只支持 `sourceKind='today_meeting_prep'`，根据已存在的 meeting prep、evidence refs 和 context pack 生成 3-6 段 Storyline。
- `memory-exploring` 的 `/storylines/draft` 是深链页面，不是独立 Storyline 管理中心；刷新同一页面时用 `sessionStorage` 缓存当前 `prepId/sourceHash/target` 的草稿，避免重复生成。
- Compose Assist、Slides Analyzer、Memory Lens 暂不显示 Storyline 入口，等 Today Pilot 入口验证后再扩展同一 `StorylineOpportunity` 判定模型。

### 3. Meeting Pilot Handoff

当 Video Home 命中预生成 meeting prep 后，会自动写入本地 handoff。

Meeting Pilot 在进入会议时读取这份 handoff，并在会中展示会前目标、cue cards 和证据。这个过程不需要用户手动“发送到 Meeting Pilot”。

Video Home 初始加载仍只读取已经准备好的 meeting prep；如果用户点击“刷新会前准备”，页面会先触发 Today Pilot 为当前日期做一次 meeting prep backfill，再用同一条缓存读取路径写入 handoff。这样缺少 nightly/pre-generated 缓存时不会卡在“暂无准备”，但仍不要求用户输入本次目标或手动发送给 Meeting Pilot。

Handoff 是低打扰的本地缓存，不是全局状态覆盖。Video Home 会保留最近少量会议的候选 handoff，并清理过期项；Meeting Pilot 优先用 RingCentral meeting id 精确匹配，只有在没有 meeting id 时才用会议标题兜底，而且标题兜底必须落在该日历事件的时间窗口附近。这样用户在 Video Home 连续浏览多个会议，或遇到同名 recurring meeting 时，不会轻易把旧会议准备错带进当前会议。

### 3.1 Rehearsal 预演提示

Today Pilot 会扫描 active Rehearsal，把今天可能要带入的预演提示生成 `rehearsal_prompt` card。它不是事实卡，也不是任务卡；它的语义是“如果今天遇到这个人、会议、issue 或项目，请记得这条预演脚本”。

进入主列表需要满足至少一个强场景线索：

- 今天或近期日历参会人、会议标题、会议 ID 命中。
- 近期消息会话的人、群组、项目或 issue 命中。
- 明确有效期落在今天附近。

过期或长期未触发的 Rehearsal 默认不主动弹出；只有精确人/会议/issue 命中时作为弱提示保留。面对面场景目前没有实时投射能力，因此 Today Pilot 只能提前提醒，不承诺现场触发。

### 4. Chrome Popup Top 3

扩展 popup 会展示 Today Pilot 当前最重要的 3 个 mission。

- meeting card 可引导用户打开 Video Home 或复制 context pack。
- 非 meeting card 点击进入 Today Pilot 首页。
- popup 折叠态同样展示 `你要做` 和 `为什么出现` 两条信息，避免只看到标题或优先级。
- popup 折叠态还展示简短证据数和信心值，帮助用户判断是否值得打开详情。
- popup 可直接把 card 标记完成、稍后 6 小时或复制 context pack；反馈失败时必须恢复卡片并提示。
- API 不可用时显示 degraded empty state，不回退假数据。

首页顶部会展示一条轻量 `筛选口径`：候选信号总量、通过行动性筛选的数量、被降噪的低行动/重复信号数量，以及本次会不会占用提醒预算。用户不用展开每张卡也能知道 Today Pilot 不是把所有同步结果都推上首页。

### 5. Context Pack

每个 mission 可以生成 context pack，用于带到 Codex、ChatGPT、Claude、豆包或通用 AI 工具。

P0/P1 阶段 context pack 只基于真实证据 deterministic 拼装，不自动把私有内容发送给外部 AI。

如果 context pack 生成失败，首页不会把卡片摘要伪装成完整上下文包并提示复制成功；用户会看到失败提示并可以稍后重试。

复制成功时，首页和 popup 会给出一条简短 receipt，说明目标 AI、证据条数、是否默认脱敏，以及正文是否因 token 预算被截断。被截断的 context pack 仍可复制，但 UI 和 API 都必须明确提示用户它不是完整证据全文。

## 业内参考

当前设计参考了几个相近方向，但保留 Personal AI 的本地记忆、显式证据和低打扰边界：

- ChatGPT Pulse / Gemini Daily Brief：都依赖记忆或 Workspace/Calendar/Gmail 等个人上下文，并提供每日主动摘要、反馈和来源查看能力；Context Pack 复制路径延续同样的“可扫描、可展开、可确认来源”原则。
- Microsoft 365 Copilot Plan My Day / meeting prep：强调 top priorities、等待用户决策、会议准备、直接链接和可快速扫描的日程/任务摘要。
- Gemini Daily Brief：把 Gmail、Calendar 和 Gemini chats 组织成早晨一次性的优先级快照，并要求用户在 Personal Intelligence / Memory 范围内启用来源；这支持 Today Pilot 保留来源开关、证据入口和每日低频刷新。
- Microsoft Research Viva Daily Briefing 研究：AI reminder 更适合提醒协作承诺、请求和未闭环事项，而不是把所有信息流都推给用户。
- 通知 batching / adaptive notification 研究：低打扰和可预测投递比即时打断更符合注意力管理，因此 Today Pilot 保留提醒预算、静默和稍后路径。

## 数据来源

Today Pilot 主要读取：

- `messages_raw`
- `calendar_events`
- `notification_records`
- `proposed_actions`
- `reflection_threads`
- `rehearsals`
- `personal_skills`
- `relationships / chunks`

生成结果是派生层，可以安全重建，不直接污染长期记忆。

### 数据生成与排序

P0/P1 生成逻辑以 deterministic rules 为主，不依赖 LLM 聚类。当前流程：

1. 扫描原始信号：过去 72 小时消息、未来 14 天日历、近期高价值通知、queued/failed actions、active reflections、active/stale rehearsals、skill suggestions、relationship radar。
2. 按 meeting series、消息 topic terms、project/entity、notification topic、action source、reflection topic 等 key 聚类。
3. 过滤低可操作性信号：heartbeat/fact follow-up 噪音、过期普通通知、无 follow-up 语义的关系雷达、无法生成具体动作的聚类；stale Rehearsal 只有精确命中今天的人、会议、issue 或项目时才保留为弱提示。
4. 对 mission 打分：urgency、open-loop pressure、user relevance、source importance、source diversity、evidence confidence、novelty、recurring noise、feedback fatigue、privacy risk、staleness。问号本身只是语言形态，不是 open-loop pressure；必须和具体行动词或阻塞语义一起出现。
5. 生成 3-7 张首页 card。
6. 把 sourceStats 和 attentionBudget 展示成可扫描的筛选摘要，说明多少候选通过、多少被降噪、哪些会打断。
7. 每张 card 提供 context pack，但只从真实证据 deterministic 拼装。

生成后用户反馈会影响下一次排序：

- `done`：今日不再显示。
- `later`：snooze 到期前不再显示；当前首页和 popup 按钮使用 6 小时稍后。后端会为缺少 `snoozeUntil` 的 `later` 请求补默认 6 小时，避免旧客户端让“稍后”立即失效。
- `mute`：同类 source hash 静默。
- `wrong/useful`：影响后续 rank penalty/boost。

反馈、静默和 context pack 生成都必须限定在当前用户自己的 brief/mission/card 内。即使前端拿到旧 card id 或 mission id，后端也不能跨用户读取、写入或返回上下文包。

同类系统通知会先聚合再排序，避免占满首页：

- generic truth-conflict 通知聚合为一张“待核对的记忆事实冲突”，证据保留在 card evidence 中。
- OpenClaw 缺少能力/配置完成后重试类通知聚合为一张能力补齐 mission。
- 同名“新的认知冲突需要决策”通知按标题聚合。

## 后端入口

Canonical API：

- `GET /api/v1/today-pilot/today`
- `POST /api/v1/today-pilot/refresh`
- `POST /api/v1/today-pilot/meeting-prep/prepare`
- `POST /api/v1/today-pilot/meeting-prep/resolve`

兼容 API：

- `/api/v1/day-pilot/*`

`Day Pilot` 只作为旧代码和旧 API 兼容名保留，产品名使用 `Today Pilot / 今日领航`。

## 与 Compose Assist 的关系

Today Pilot 负责：

- 今天要注意什么。
- 哪些会议已经提前准备好。
- 如何把 mission 上下文交给其他 AI 或 Meeting Pilot。

Compose Assist 负责：

- 当前输入框怎么写。
- 消息回复、Jira comment、AI prompt、文档输入辅助。

会前准备属于 Today Pilot，不属于 Compose Assist。

## UX 原则

- 默认自动准备，减少用户现场操作。
- 优先展示具体事情，不展示分类汇总。
- 折叠态必须能回答“我要做什么”和“为什么给我看这个”。
- 每条建议必须能追溯证据。
- 过滤低可操作性的系统 heartbeat、巡检、重复事实跟进通知。
- 对旧证据保守降权，避免 Today Pilot 变成历史通知收件箱。
- 不自动替用户发送消息、创建动作或把私有内容发给外部 AI。
- 首页反馈可以先做乐观隐藏，但写入失败必须恢复卡片并提示用户。
- 首页是导航和提醒层，强状态处理留给对应子页面。
