# Today Pilot / 今日领航

_最后更新: 2026-06-29_

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

展开态还展示 `排序回执`：它把这张卡为什么是 `计划打断`、`首页展示` 或 `静默展示` 说清楚，同时列出排序分数、优先级/状态、证据来源、置信度、隐私风险、陈旧证据和敏感证据数量。这个回执只解释 Today Pilot 的排序和提醒预算，不代表自动批准、自动发送或自动执行。

外部执行确认卡有单独边界：如果证据来自 `delegate_openclaw` / `openclaw_delegation`，Today Pilot 首页不会展示 Codex、ChatGPT、Claude、豆包等 context pack 目标选择器，因为这些按钮容易被误读成“选择谁来执行”。这类卡片只展示 `OpenClaw 外部执行` 通道说明和跳转按钮；批准、拒绝或拍板必须回到动作队列 / 决策中心完成，真正的外部执行也只由 OpenClaw 接管。

如果 mission 的证据来自动作队列，首页返回缓存 brief 时也会重新核对源 action 的当前状态。只有 `queued` / `failed` 的 action 仍会展示；源 action 已 `succeeded`、`cancelled`、`dead_letter`、`running` 或已不存在时，即使当天 brief 没有重新生成，这张 card 也会从首页结果中消失。这样用户在动作队列完成处理后，不需要等隔天才从 Today Pilot 清理掉。

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
- 已在动作队列完成、取消、进入 dead letter、运行中或已经不存在的 action 派生 card。
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
- AI 工具新闻、模型发布、release notes 或“仅供参考 / no action needed”类消息不会因为提到 OpenAI、Codex、Claude、Cursor、MCP 等关键词就变成 `ai_tool_shift` mission；只有出现配置、评估、quota、owner、risk、迁移、回复、准备材料、复用说明等具体工作流语义时才会进入排序。

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

会前准备注入只允许在 RingCentral `/video/home` 路由生效。RingCentral PWA 从 Video Home 切到 `/messages/...`、聊天 composer、`#` 群组选择列表或其他消息页面时，Today Pilot 必须移除本地 host、清空当前路由态，并且不能继续用聊天标题、群组弹层或历史消息文本匹配会议。这样不会把聊天会话容器刷新成空白会前准备页。

Video Home 会在会议信息下方显示一条 `会前准备回执`，把准备模式、可见高置信证据数、基础背景数和边界说明拆开展示。日历-only 或 fallback meeting prep 仍可带入 Meeting Pilot 作为会议背景，但页面必须明确说明“高置信记忆 0 条”或“规则 fallback”，不能把基础准备误写成完整记忆召回，也不能把有效的基础准备展示成纯空状态。

当同一份 prep 同时包含高置信记忆和日历/低信号背景时，首屏回执要直接说明“高置信几条、基础背景几条”，并保留 `会中核对 owner / 下一步 / 风险` 的使用边界。日历来源即使标题或描述里出现 dependency、risk、owner 等工作词，也只计为基础背景，不能被展示成高置信记忆来源。这样用户能把它当作会前线索和 Meeting Pilot 背景，而不是完整事实审计或自动执行授权。

Video Home 写入 Meeting Pilot handoff 时，回执还要说明这是本机上下文缓存：只带入本场关注、cue cards 和证据背景，不会加入会议、录音、发消息、审批，也不会写回日历或外部系统。

用户点击刷新会前准备后，Video Home 会显示 `刷新会前准备回执`：它说明本次本机会议同步、Today Pilot backfill 的准备/跳过/失败数量，以及最终是读取预生成缓存、生成新准备、使用规则 fallback 还是暂无可用准备。这个回执只代表本地展示和 Meeting Pilot handoff 缓存更新，不会加入会议、开启录音、发送消息、创建任务、审批或写回日历/外部系统。

#### 2.1 Storyline 生成提示

部分会议不是只需要会前摘要，而是可能需要用户准备一段可讲述材料，例如分享、汇报、复盘、培训、workshop、项目 review 或对外解释。Today Pilot 在生成 meeting prep 的同一轮 LLM 判断里附带产出 typed `storylineOpportunity`，用于决定是否在会前准备卡片里展示 `生成故事线草稿` 按钮。

Today Pilot 只负责“要不要在会前准备里提示”。完整 Storyline 生成、Draft API、页面结构和边界由 [memory_storyline_builder.md](./memory_storyline_builder.md) 维护。

会前准备侧的落地规则：

1. 判断不是独立关键词匹配；最终展示必须由 meeting prep LLM 基于会议目标、召回证据规模、表达意图、受众和风险边界判断。
2. 条幅放在 meeting prep 摘要和 cue cards 之间，作为小型提示，不新增大型独立卡片。
3. `storylineOpportunity.available=true`、本地未 dismiss、prep 仍有效时才展示。
4. 点击 `生成` 后打开 `memory-exploring.html#/storylines/draft?source=today_meeting_prep&prepId=...&target=...`，点击后才调用 draft API。
5. 用户点 `不需要` 后写入 `chrome.storage.local.storylineOpportunityDismissals`，key 由 `prepId + sourceHash + eventExternalId` 组成，默认 30 天不再展示同一条提示。页面会留下 `Storyline 提示已隐藏` 回执，说明这只是本机 suppression，不删除会前准备、证据、Draft 草稿或 Meeting Pilot handoff，也不会写回 Slides / Docs / RingCentral。
6. P0 不复用 Day Pilot card feedback，不自动生成 Storyline，不自动写回 Slides / Docs / RingCentral。
7. 条幅必须写明它只会打开草稿页；用户仍需在 Draft 页复核证据后手动复制，不会自动写回外部平台。
8. 条幅内展示 `Storyline 入口回执`：输出格式、素材组数量、可讲述证据条数、来源类型、受众/预计时长，以及“点击后才调用 Draft API；Draft 页会重新核对 evidence refs、缺口和风险”。如果 LLM 上报的素材数量和实际 `prep.evidenceRefs` 不一致，回执会同时展示“素材估计”和“实际 refs”，并说明以 Draft 页证据复核为准。这样用户在打开草稿前就能判断为什么这场会值得生成故事线，而不会把入口误读成已经生成或已准备外发。
9. 条幅还会显示 `外发复核`：实际私有素材数量、会前准备里的脱敏提示数和风险/未闭环数。它只说明打开 Draft 前需要复核的范围，不会阻止用户进入草稿页，但会明确当前只是素材入口，不是外发就绪稿。

服务端会在 LLM 输出后再做一次轻量校验：实际 `evidenceRefs` 少于 3 条、模型上报的素材 cluster 少于 3 条、或会前准备只有日历标题/描述这类单一来源时，会把 `storylineOpportunity` 降级为不可展示并保留 `blockedReasons`。这样普通会议不会因为模型过度乐观或夸大素材数量而出现生成按钮。

### 3. Meeting Pilot Handoff

当 Video Home 命中预生成 meeting prep 后，会自动写入本地 handoff。

Meeting Pilot 在进入会议时读取这份 handoff，并在会中展示会前目标、cue cards 和证据。这个过程不需要用户手动“发送到 Meeting Pilot”。

Video Home 初始加载仍只读取已经准备好的 meeting prep；如果用户点击“刷新会前准备”，页面会先触发 Today Pilot 为当前日期做一次 meeting prep backfill，再用同一条缓存读取路径写入 handoff。这样缺少 nightly/pre-generated 缓存时不会卡在“暂无准备”，但仍不要求用户输入本次目标或手动发送给 Meeting Pilot。

Handoff 是低打扰的本地缓存，不是全局状态覆盖。Video Home 会保留最近少量会议的候选 handoff，并清理过期项；Meeting Pilot 优先用 RingCentral meeting id 精确匹配，只有在没有 meeting id 时才用会议标题兜底，而且标题兜底必须落在该日历事件的时间窗口附近。这样用户在 Video Home 连续浏览多个会议，或遇到同名 recurring meeting 时，不会轻易把旧会议准备错带进当前会议。

写入 handoff 时，Today Pilot 会从会前准备里的 action cue、建议问题、摘要或 brief cue 中提炼一条短的 `本场关注`。这条不是用户新输入的目标，也不是自动授权；它只是把“这场会最该确认什么 / 成功条件是什么”随 evidence 和 cue cards 一起带进 Meeting Pilot，避免会中面板只展示资料列表却没有会议意图。

Meeting Pilot 读到 handoff 后会显示 `Handoff 匹配回执`，说明本次是 Meeting ID 精确命中、标题 + 时间窗口兜底，还是标题关键词弱兜底，并展示本机缓存年龄和剩余有效期。这个回执只解释本机 handoff 如何被选中，不会加入会议、开启录音、发消息、创建或完成行动项，也不会写回日历或外部系统。

### 3.1 Rehearsal 预演提示

Today Pilot 会扫描 active Rehearsal，把今天可能要带入的预演提示生成 `rehearsal_prompt` card。它不是事实卡，也不是任务卡；它的语义是“如果今天遇到这个人、会议、issue 或项目，请记得这条预演脚本”。

展开预演卡时，首页会显示一条 `预演回执`：它把命中的线索、Rehearsal 当前状态、要复习的脚本和“不自动发言 / 不自动发消息 / 不执行外部动作”的边界放在同一处。这样用户不用先跳进管理页，也能判断这条提示是否适合今天使用、更新、暂停或标记不相关。

进入主列表需要满足至少一个强场景线索：

- 今天或近期日历参会人、会议标题、会议 ID 命中。
- 近期消息会话的人、群组、项目或 issue 命中。
- 明确有效期落在今天附近。

过期或长期未触发的 Rehearsal 默认不主动弹出；只有精确人/会议/issue 命中时作为弱提示保留。面对面场景目前没有实时投射能力，因此 Today Pilot 只能提前提醒，不承诺现场触发。

如果 `SCENE_REHEARSAL_DISPLAY_ENABLED=false` 或 Context Assist 被关闭，Today Pilot 首页会把 `rehearsal_prompt` 当作不可见卡片处理：不展示卡片，不把它计入顶部 mission 数、预演来源标签、筛选摘要或提醒预算。这样用户不会看到“0 件事”却同时出现“1 mission / 1 个计划打断”的幽灵统计。

### 4. Chrome Popup Top 3

扩展 popup 会展示 Today Pilot 当前最重要的 3 个 mission。

- meeting card 可引导用户打开 Video Home 或复制 context pack。
- 非 meeting card 点击进入 Today Pilot 首页。
- popup 折叠态同样展示 `你要做` 和 `为什么出现` 两条信息，避免只看到标题或优先级。
- popup 折叠态还展示简短证据数和信心值，帮助用户判断是否值得打开详情。
- popup 标题下方展示 `筛选口径`：本次显示几张 / 总共几张 mission、扫描信号数、候选数、入选证据数、候选未入选数、前置降噪数、提醒预算使用量，以及“Top 3 快照，不会自动执行”的边界。这个回执还展示 `快照基准`：本次是服务端新生成还是读取已有 brief、brief 生成时间/相对年龄和 ready/stale/draft 状态，并说明 popup 只读取 Today Pilot brief，不会重新扫描来源、写反馈、发送消息或执行动作。这样用户不用打开首页也能知道 popup 不是所有同步内容、不是执行授权，也不是没有新鲜度边界的实时流。
- popup 可直接把 card 标记完成、稍后 6 小时或复制 context pack；提交 `完成` / `稍后` 后先显示 `正在提交反馈` 回执，原 card 保持可见并锁住反馈按钮，等 Memory Service 确认后才刷新 Top 3。成功回执必须说明这只更新 Today Pilot 展示/排序，不代表来源任务完成、消息已读、排程变更或外部系统同步；即使最后一张 card 被移除后列表变空，成功回执也要保留可见。反馈失败时原卡仍显示，并说明尚未写入 Today Pilot、也没有修改来源系统。
- 初次 API 不可用时显示 degraded empty state，不回退假数据；如果用户在已有 Top 3 后手动刷新失败，popup 会保留上次快照并把首屏回执改成 `刷新失败 · 仍显示上次 Top 3 快照`，说明还没确认当前 Memory Service 最新状态，也没有写反馈、发送消息或执行动作。

首页顶部会展示一条轻量 `筛选口径`：原始信号总量、进入候选池的数量、当前可见首页 mission 的证据数量、进入候选池但没入选首页的数量、以及前置规则直接降噪的数量。前置降噪会附带来源拆分，例如 `消息 2、预演 1`，让用户能判断今天主要是消息噪声、会议噪声、系统提醒还是预演提示被挡掉，而不是只看到一个不可解释的总数。这个口径会跟随 `完成`、`稍后 6 小时`、`不再提醒同类`、动作源完成和本机隐藏卡片一起更新；用户不用展开每张卡，也能知道 Today Pilot 现在还剩多少真实可见事项，并区分是候选排序没选上，还是低行动/重复/旧信号一开始就没进候选池。只要本轮写入过 Today Pilot 展示/排序反馈，筛选摘要旁会直接标明这是 `反馈后的可见快照`：顶部数量只代表仍可见 mission，不代表来源任务完成、消息已读、排程变更或外部系统已同步。

首页 API 不可用时必须显示 degraded 状态和重试入口，不能把请求失败展示成“今天没有高优先级事项”；Today Pilot 派生的处理计数也要清零，避免旧 brief 让用户误以为仍有当前待办。

### 5. Context Pack

每个 mission 可以生成 context pack，用于带到 Codex、ChatGPT、Claude、豆包或通用 AI 工具。

P0/P1 阶段 context pack 只基于真实证据 deterministic 拼装，不自动把私有内容发送给外部 AI。

首页展开卡片后，provider 选择器和 `包含敏感原文` 开关前会先展示 `上下文包范围` 回执：当前目标 AI、证据条数、默认脱敏/包含敏感原文状态，以及生成/复制只读取当前 mission 证据并写入本机剪贴板，不会发送给外部 AI、批准/执行或写回来源系统。这样用户在切换敏感模式或点击复制前就能看到真实作用范围。

Context Pack 是“给外部 AI 阅读的上下文”，不是执行授权。涉及 `delegate_openclaw` / `openclaw_delegation` 或 OpenClaw action 证据的执行确认卡，首页和 popup 都不显示 context pack 目标平台选择器，也不提供一键复制 context pack；popup 只给出进入处理页的动作，避免用户误以为 Codex / ChatGPT / Claude / 豆包会接手外部系统操作。

如果 context pack 生成失败，首页不会把卡片摘要伪装成完整上下文包并提示复制成功；用户会看到失败提示并可以稍后重试。

复制成功时，首页和 popup 会给出一条简短 receipt，说明目标 AI、证据条数、是否默认脱敏，以及正文是否因 token 预算被截断。被截断的 context pack 仍可复制，但 UI 和 API 都必须明确提示用户它不是完整证据全文。

Context Pack 还会给出 `sourceSummary` 覆盖回执：总共选中多少条证据、复制正文实际包含多少条、多少条因 token 预算没有进入正文，以及各来源类型的数量。首页展开预览和 popup 复制回执都要展示这条范围信息，避免用户把截断后的正文误认为完整证据包。

复制成功还会写入一条 `today_pilot / copied_context` 无感校准 trace：只记录 mission、目标 provider、证据引用、正文 hash/长度、脱敏和截断状态，不保存 context pack 正文。这个信号用于后续判断哪些 mission/context handoff 真正有用，不新增用户审核队列。

Context Pack 正文必须明确写出交接边界：它是给外部 AI 阅读的背景，不是授权 Codex、ChatGPT、Claude、豆包或其他工具执行外部动作。外部发送、审批、破坏性修改和 OpenClaw 执行仍必须回到对应处理路径。

### 6. 睡眠期预计算与补课/收尾 (Sleep-time Compute, P1-7)

把 meeting prep 已验证的「夜间预计算」推广成通用的睡眠期计算，并补上两个时间场景。

- **预计算（Anticipation）** `core/AnticipationService.ts`（夜间巩固 Phase 6.5）：从**确定性信号**（未来 36h 的日历事件 + 未闭环 reflection thread 的主题，不猜意图）选出明天可能被问到的主题，每晚 ≤8 条，LLM 预答存 `anticipation_briefs` 表（migration `044`，`valid_until` 次日过期、`consumed_at` 消费一次）。**它是缓存不是事实层**——过期即作废。
- **/ask prior 消费**：`/ask` 组装上下文时用 `parsedIntent` 的实体/项目名 + cleanedQuery 调 `AnticipationService.findPrior()`，命中就把预答注入 memory context（短路全链路检索+综合），并 mark consumed。无命中是零成本 no-op。
- **高压后补课（Catch-up）** `core/CatchUpService.ts` + `GET /day-pilot/catch-up?sinceTs=|awayMinutes=`：对「离开窗口」内新摄入的记忆按 importance+salience 排序，返回 highPriority + waiting（含 `?`/`@`/「等你回」等待信号）的**只读** brief。Today Pilot 首页在 Mission 下方读取最近 90 分钟快照，只在读取中、失败或确实有新增信号时展示 `刚才错过了什么` 区块；回执必须说明它不会标已读、代回复、改排序或写回来源系统。若同一条新信号同时属于 `高优变化` 和 `等你回`，首页只展示一次，并在补课回执里说明重叠数量，避免用户把同一来源误读成两条待办。读取失败只显示补课不可用，不能被解释成“最近没有新事项”。forgotten/archive_only 记忆被排除。
- **验证**：`anticipation.test.ts`（3：确定性主题收集、生成+findPrior 消费一次、过期不返回+清理）、`catchUp.test.ts`（2：窗口排序+等待识别、排除归档）。
- **仍在推进**：晚间收尾（Day Close）brief 的 cron 档与 Today Pilot 收尾区块、guardrail 失败复盘蒸馏（Phase 6.6）、quick-ask 桌面卡片前端。

## 业内参考

当前设计参考了几个相近方向，但保留 Personal AI 的本地记忆、显式证据和低打扰边界：

- ChatGPT Pulse / Gemini Daily Brief：都依赖记忆或 Workspace/Calendar/Gmail 等个人上下文，并提供每日主动摘要、反馈和来源查看能力；当前 ChatGPT Pulse Help Center 已提示 Pulse 将退场并建议转向 scheduled tasks 做 daily briefing，所以 Today Pilot 保留有限快照和手动刷新失败边界，不把每日摘要伪装成持续实时流。
- Microsoft 365 Copilot Plan My Day / meeting prep：强调 top priorities、等待用户决策、会议准备、直接链接和可快速扫描的日程/任务摘要；Outlook meeting prep 也把准备内容放在会议事件上方，支持展开查看更多 insight。
- Microsoft Sales Copilot meeting preparation card：会把准备内容和会议要求、数据匹配、fallback 场景、限制和 retention 写清楚；这支持 Today Pilot 在刷新后把 backfill 与缓存命中结果直接展示出来，而不是只显示最终摘要。
- Gemini Daily Brief：把 Gmail、Calendar 和 Gemini chats 组织成早晨一次性的优先级快照，并要求用户在 Personal Intelligence / Memory 范围内启用来源；这支持 Today Pilot 保留来源开关、证据入口和每日低频刷新。
- Google Meet / Gemini 与 Zoom AI Companion 的会中摘要、catch-up、action item 类能力通常需要会议内启用或 host/admin 控制，并会把 notes/summary 作为独立产物分享或附到 Calendar/meeting recap；这强化了 Today Pilot 必须把“会前本机 handoff”和“会中/会后自动记录或分享”分开。
- Microsoft Research Viva Daily Briefing 研究：AI reminder 更适合提醒协作承诺、请求和未闭环事项，而不是把所有信息流都推给用户。
- proactive agent 与通知 batching / adaptive notification 研究：主动代理需要避免过度承诺，低打扰和可预测投递也比即时打断更符合注意力管理；因此 Today Pilot popup 在刷新失败时保留可用的上次快照，但必须显性说明它不是当前最新状态。
- RAG / context engineering 研究：外部 AI handoff 不应只堆文本；需要目标、边界、证据列表、未知问题、截断提示和来源摘要，降低错误使用或把上下文误读成授权的概率。
- Context engineering 近期讨论还强调 relevance、sufficiency、isolation、economy 和 provenance；Context Pack 的预操作回执把目标 AI、证据规模、敏感模式和不外发/不执行边界提前到点击前。
- AI meeting assistant 和 AI trust 研究都提醒，准备摘要要校准信任：有来源和权限时才展示为证据，只有日历或 fallback 时要显性说明局限，避免用户把自动摘要误读成完整事实审计；meeting assistant governance 讨论还把 passive summary 和 autonomous proxy/acting agent 分开，要求 consent、transparency、accountability 和 audit 贯穿设计。

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
3. 过滤低可操作性信号：heartbeat/fact follow-up 噪音、过期普通通知、无 follow-up 语义的关系雷达、被动 AI 工具新闻/发布说明、无法生成具体动作的聚类；stale Rehearsal 只有精确命中今天的人、会议、issue 或项目时才保留为弱提示。
4. 对 mission 打分：urgency、open-loop pressure、user relevance、source importance、source diversity、evidence confidence、novelty、recurring noise、feedback fatigue、privacy risk、staleness。问号本身只是语言形态，不是 open-loop pressure；必须和具体行动词或阻塞语义一起出现。
5. 生成 3-7 张首页 card。
6. 把 sourceStats 和 attentionBudget 展示成可扫描的筛选摘要，区分原始总量、候选池、当前可见 mission 的证据、候选未入选和前置降噪；前置降噪按来源展示 top breakdown，首页和 popup 使用同一套 sourceStats 口径。反馈、snooze、mute、源 action 完成或本机隐藏后，selected 计数以当前返回/可见卡片重新计算，并在发生过本轮反馈后显示 `反馈后的可见快照` 边界，避免把可见数量变化误读成来源系统已处理。
7. 每张 card 展示自己的 `排序回执`，解释 attention lane、分数、证据/置信/隐私风险，以及为什么会打断、只留在首页或保持静默。
8. 每张 card 提供 context pack，但只从真实证据 deterministic 拼装。

生成后用户反馈会影响下一次排序：

- `done`：今日不再显示。
- `later`：snooze 到期前不再显示；当前首页和 popup 按钮使用 6 小时稍后。后端会为缺少 `snoozeUntil` 的 `later` 请求补默认 6 小时，避免旧客户端让“稍后”立即失效。
- `mute`：同类 source hash 静默。
- `wrong/useful`：影响后续 rank penalty/boost。

用户在首页点击 `完成`、`稍后 6 小时`、`不再提醒同类`、`有用` 或 `不准确` 后，页面会先留下 `正在提交反馈` 回执：Memory Service 确认前 mission 仍保留当前状态，反馈按钮临时锁定，避免把待写入误读成已经完成、静默或排序成功。确认成功后才显示 `Mission 反馈回执` 并移除/更新卡片。回执必须说明这次只写入 Today Pilot 的今日展示/排序反馈：`完成` 不等于来源任务、动作队列、决策、消息或外部系统已完成；`稍后` 不改来源排程、日历或动作执行时间；`不再提醒同类` 不删除原始记忆、证据或来源消息。反馈写入失败时卡片保持可见，并说明没有修改来源系统。

反馈、静默和 context pack 生成都必须限定在当前用户自己的 brief/mission/card 内。即使前端拿到旧 card id 或 mission id，后端也不能跨用户读取、写入或返回上下文包。

同类系统通知会先聚合再排序，避免占满首页：

- generic truth-conflict 通知聚合为一张“待核对的记忆事实冲突”，证据保留在 card evidence 中。
- OpenClaw 缺少能力/配置完成后重试类通知聚合为一张能力补齐 mission。
- 同名“新的认知冲突需要决策”通知按标题聚合。

## 后端入口

Canonical API：

- `GET /api/v1/today-pilot/today`
- `POST /api/v1/today-pilot/refresh`
- `POST /api/v1/today-pilot/missions/:id/context-pack`
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
