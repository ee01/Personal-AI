# Relationship Radar / 关系记忆雷达

*最后更新: 2026-07-12*

## 是什么

Relationship Radar 是 Personal AI 的人物关系上下文能力，入口位于 `memory-exploring.html#/entity/Person`。它把 Memory Service 里已经识别到的 Person、消息、会议、项目、关系边和确认项，整理成可查看、可确认、可复制给其他 AI 的人物上下文。

它不是销售 CRM，也不是联系人管理器。它的目标是在用户准备沟通、开会、写 follow-up 或让 AI 起草内容前，回答一个更具体的问题：

> 我和这个人最近有哪些真实上下文、未闭环事项、稳定协作事实和需要谨慎确认的推断？

## 大白话运行逻辑

Relationship Radar 会把“和某个人有关的记忆”整理成人物上下文卡：最近互动、未闭环事项、已确认事实、关系提示、当前建议和证据。它的重点不是联系方式管理，而是帮助用户在沟通前知道哪些话题、承诺或边界要注意，以及下一步最应该先确认什么。

这个功能保持独立文档，而不是并入 `memory_system.md`。原因是它已经是一组完整的人物关系能力：有自己的 UI、API、后台整理、存储表、人工确认队列、会议简报和回复助手；`memory_system.md` 只负责解释它在整个记忆系统里的位置，并链接到本文。

结果主要受这些因素影响：

1. 人物实体合并质量：同一个人如果有多个名字、邮箱或别名，合并质量直接影响雷达准确度。
2. 互动证据：最近消息、会议、项目和关系边越多，人物状态越可靠。
3. 确认程度：已确认事实优先于推断事实；敏感上下文默认不进入外发卡片。
4. Open loops：未闭环事项会显著影响 meeting brief、assistant draft 和人物优先级。
5. 调用 surface 和 token budget：不同场景会生成不同长度和敏感度的 context card。

## 数据生成链路

Relationship Radar 不是等用户点开页面才“凭空生成”。它采用 hybrid projection：

1. **Lazy fallback**：页面或 API 第一次读取人物时，直接从 `entities`、`messages_raw`、`entity_properties` 和 `relationships` 即时计算候选人物、分数、状态和基础上下文。优点是没有后台结果时也能展示，缺点是质量偏索引级。
2. **后台整理**：每日 `ProactiveScheduler` 在 normal daily consolidation 之后调用 `RelationshipRadarService.consolidatePeople()`，只整理高频人物，把更稳定的 context card、open loop、relationship event 写入专用表。
3. **人工确认**：review item 被用户 confirm 后写入 `entity_properties.relationship_context`，之后该人物的 `dataQuality` 升级为 `confirmed`，优先反哺会议、回复和检索。

因此页面里会明确显示 `dataQuality` / `projectionSource`：

| 字段 | 含义 |
| ---- | ---- |
| `indexed` + `lazy` | 只来自索引即时计算，可作为 fallback，不应当当成稳定事实 |
| `generated` + `background` | 后台整理过，质量高于 lazy，但仍需保留证据边界 |
| `confirmed` + `user_confirmed` | 用户确认过的人物事实，可进入更稳定的画像/检索提示 |
| `stale` | 后台整理后又出现更新互动，需要下一轮刷新 |

后台整理会覆盖同一个人的 lazy projection；这不是丢数据，而是把即时索引结果升级成更高质量的关系上下文。

## 当前能力

### 人物雷达

`RelationshipRadarService` 会从 Person 实体、消息证据、关系边和已确认属性里生成人物投影：

- `core` / `active` / `rising` / `dormant` / `watch` 等 radar state。
- interaction count、active days、recent interaction、confirmed facts 等信号。
- 达到阈值的人物进入主列表，低频候选可以在页面里单独查看。
- projection 会记录 `dataQuality` 和 `projectionSource`，避免把 lazy/generated/confirmed 状态混成同一类事实。
- 人物搜索支持姓名、描述、别名和邮箱别名；页面会显示当前搜索 / 状态 / 候选筛选范围，空结果时可以直接清空筛选或打开低频候选。搜索、刷新、状态筛选、候选、清空筛选和人物卡点击都有 hover / 读屏边界：这些控制只重新读取或切换当前页面快照，不确认关系事实、不写人物画像、不发送消息、不创建跟进或同步外部系统。
- 首屏在人物卡片前显示 `雷达路线回执`：说明当前筛选范围、优先推荐人物的原因、当前列表的数据质量构成和待确认事实数量；同时明确查看、搜索、筛选和复制准备都是只读，`后台整理` / `强制刷新` 只更新关系雷达投影和上下文卡，不写人物画像、不发送消息、不创建跟进，也不同步外部系统。画像写入只来自 Review Queue 的显式确认。对应按钮本身也带相同边界，区分“刷新只读快照”和“整理投影/上下文卡”。
- 首屏 spotlight 卡片内还会显示 `行动前回执`：在用户点击 `查看完整 brief`、`强制刷新此人` 或 `复制给 AI` 前，直接说明为什么推荐这个人、第一步应该先查看/刷新/复核什么、复制按钮是否已具备上下文卡条件，以及这些按钮不会确认关系事实、写入人物画像、发送消息、创建跟进或同步外部系统。人物卡点击会切换当前 brief、读取该人物 context card，并清空上一位人物的会议简报、回复草稿和复制回执；这个重置后果同样写入人物卡按钮边界。

这块的当前产品参考是 Microsoft Dynamics 365 relationship intelligence 的 relationship health / who-knows-whom 路线、Affinity 的 recency/frequency relationship strength 与 follow-up 触发、Salesforce Einstein Relationship Insights 的页面内关系证据和 CRM 更新入口。研究侧参考 AI-mediated communication、LLM transparency 和算法回复对人际感知的影响：关系型 AI 应该把排序依据、证据质量、AI 介入边界和写入权限放在用户行动前，而不是让用户从卡片细节里反推。

### 人物详情与证据

单个人物详情会展示：

- 最近互动时间线。
- open loops / 未闭环事项。
- 稳定关系边和相关人物。
- 已确认事实、推断事实和待确认 review item。
- 可跳转回记忆系统的 `exploreLink` 证据。
- 证据按钮只接受安全的内部 `#/...` 路由和 `http(s)` 外部链接；导入数据里携带的危险 URL 会被拦截并给出提示。
- 如果搜索、筛选或刷新间接切换了当前人物，页面会清空上一位人物的会议简报、回复草稿和复制回执，并显示“人物切换回执”；这些生成结果必须重新生成后才会用于当前人物，避免把旧人的上下文误带进新的 brief。

证据需要能追溯到 message、entity property 或 relationship，不把无证据推断直接包装成事实。

### Context Card

`POST /api/v1/relationships/context-card` 生成单个人物上下文卡：

- 支持按 `personId` 或 `personName` 查找。
- 支持 `surface` 和 `tokenBudget`。
- 默认不包含敏感信息，除非调用方显式传入 `includeSensitive`；默认卡片会过滤邮箱/电话/密钥类别名、事实、证据、open loop 和检索 boost，并返回 `privacySummary` 说明隐藏数量。
- 输出 `contextMd`、bullets、action suggestions、known facts、relationship hints、open loops、do-not-assume 和 evidence refs。

`actionSuggestions` 是 Context Card 的总结层，不只是证据重排。它会把 open loop、关系边、已确认/待确认事实压成“现在建议”，例如先闭环某个 owner / next step、沟通前确认关联对象边界、或先把推断升级成可用事实。每条建议都带 `tone`、`reason` 和可选 `evidenceRef`；UI 会把这块放在事实和关系证据之前，复制出去的 `contextMd` 也会包含 `## 现在建议`。如果读取到旧的 stored context card 没有该字段，service / UI 都会用现有 open loops、关系边和事实即时补齐兜底建议。

Context Card 适合被 Meeting Pilot、Compose Assist、Quick Ask 或外部 AI context package 复用。UI 默认显示“敏感上下文未纳入”的状态，并只展示隐藏类型计数（例如别名、事实、证据、跟进、检索），让用户不必揭开敏感内容也能判断是否需要临时包含。用户需要显式点“临时包含敏感上下文”才会重新拉取可外发前复核的完整卡片；此时复制按钮会标成“复制含敏感上下文”，复制成功提示也会提醒外发前复核。详情 brief 里的“复制当前上下文”始终复制当前选中人物的 context card；即使首屏 spotlight 仍然指向另一个更高优先级人物，用户也能把正在查看的人物上下文直接交给外部 AI 或聊天草稿使用。

Context Card 顶部会显示“上下文卡回执”：说明这张卡来自索引即时计算、后台整理还是人工确认画像，当前适用场景和 token 预算，可引用的证据/事实/跟进/建议数量，以及敏感上下文是否默认隐藏或被临时包含。复制出的 `contextMd` 也保留这段回执，明确复制不会写入画像、发送消息或自动刷新其他场景；如果卡片是 `stale` 或包含敏感上下文，回执会提示先刷新或外发前复核。

复制成功后，页面会保留 `上下文复制回执`，说明剪贴板写入的是当前卡片还是刷新失败后保留的上次快照、默认隐藏还是含敏感上下文版本、证据/事实/跟进/建议数量，以及复制不会发送消息、写入人物画像、创建跟进、刷新其他场景或临时纳入隐藏敏感项。

详情页的 Context Card 控制点也会在点击前说明边界：复制按钮区分当前卡片 / 失败后保留的上次快照、默认隐藏 / 含敏感上下文，以及只写本机剪贴板；`临时包含敏感上下文` / `恢复默认隐藏` 只重新请求该人物卡片，返回前不替换当前内容且复制保持禁用；“查看依据”和 open loop 证据按钮只打开安全证据来源，不确认关系事实、不写人物画像、不发送消息、不创建跟进，也不刷新上下文卡。建议卡、已知事实、关系提示、检索增强提示和“不要假设”条目本身也带 hover / 读屏边界，说明它们只是复制前复核线索，不会确认、写入、发送、创建跟进、重跑检索或同步外部系统。

同一个人物的 Context Card 正在刷新或切换敏感范围时，UI 会显示 `上下文卡请求回执`：说明请求的是默认隐藏还是含敏感上下文版本、当前仍显示哪一版上次快照、结果尚未替换当前内容，并在返回前禁用复制，避免把请求中的隐私范围误读为已确认。

如果 Context Card 刷新失败，但页面还有同一个人的上次成功卡片，UI 不会把卡片直接清空。它会显示 `上下文卡刷新失败回执`，说明当前状态未确认、页面保留的是上次快照、失败原因、请求范围和当前显示范围，并重申这次失败没有写入人物画像、发送消息、创建跟进任务或外发上下文。用户请求“临时包含敏感上下文”失败时，按钮状态会退回到上次实际显示的隐私范围，避免 UI 暗示敏感上下文已经成功纳入；复制这类保留卡片时 toast 会标明复制的是上次快照。

已保存的 Context Card 只是后台整理快照，不会把旧来源状态永久带到后续场景。读取 stored card 时，服务端会先用当前人物投影重建 `dataQuality` / `projectionSource` 和回执：如果用户后来确认了 `relationship_context`，会跳过旧卡并即时重建，让确认事实进入卡片和复制文本；如果后台整理后又出现新互动，仍可复用旧卡，但回执会标成“有新互动待刷新”，提示外发前先刷新或核对最新证据。

这块的产品参考是 Salesforce Einstein Relationship Insights 的 evidence-backed recommendation、Clay contact card 的 relationship timeline / network strength、Microsoft Dynamics 365 Copilot record summary 的嵌入式摘要；研究参考主要来自 mixed-initiative context 和 user-centered XAI。共同结论是：人物上下文应该是可解释、可调范围、可复核的对象，而不是默认把所有私密证据打包给下游 AI。

### Meeting Brief

`POST /api/v1/relationships/meeting-brief` 会根据会议标题、时间和 attendees 生成会前人物摘要：

- 每个 attendee 尝试匹配 Person 实体。
- 支持 `Name <email>`、邮箱-only、常见日历 attendee object，并优先用显示名、别名、邮箱别名匹配 Person。
- 返回 `coverage` 汇总和每个 attendee 的 `matchedBy`、`matchReason`、`matchConfidence`、`coverageState`。
- 弱匹配（例如只靠邮箱前缀命中别名）会额外标成 `identityCheckRequired`，覆盖统计、会前准备状态、页面卡片和复制简报都会显示“身份待核对”；在身份核对前，API 会暂缓展开该人物的历史证据、open loop 和上下文摘要，只保留核对问题，避免把可能错人的关系记忆直接带进会前 brief。
- 简报会显示“简报来源回执”，说明本次来自日历事件还是手动输入、实际分析了多少参会人、匹配策略、证据边界，以及默认不外发敏感人物上下文；复制简报也会保留这段回执。
- 如果调用方传了日历事件 id 但事件已经找不到，回执会明确显示“日历事件未找到，已改用手动输入”；如果传入日历事件的同时又手动覆盖了标题、时间或参会人，回执会显示“日历事件 + 手动覆盖”，避免复制出去的简报看起来像完全来自原始日历。
- 有匹配时展示最近上下文、未闭环事项、建议问法和可引用证据入口。
- 无匹配时保持低承诺提示，明确标出需要会中确认角色或补充人物别名，不伪造关系信息。
- 大会议默认只展开前 16 位参会人的人物上下文；如果日历或手动输入超过上限，API、页面和复制简报都会显示已分析/未分析人数，并列出未展开参会人，避免覆盖统计看起来比实际更完整。
- 页面内手动生成简报时，如果用户还没有改过默认会议标题/参会人，切换人物会自动把默认参会人同步到当前人物；一旦用户手动编辑，就保留用户输入。
- 手动点击生成后会先显示“生成请求”回执：列出本次标题、参会人数、前 16 位分析上限、参会预览和旧简报快照状态；后端返回前，旧简报不会被暗示成新结果，失败时也会说明旧简报未被替换，且本次没有写入人物画像、发送消息、创建跟进或同步外部系统。
- 生成成功后如果用户继续修改会议标题或参会人，页面会显示“简报输入变更回执”：旧简报仍可查看作为上次快照，但复制按钮会锁定成“先重新生成”，避免把旧参会人、旧身份匹配或旧 open loop 当成当前会议结果外发。
- 生成结果会额外给出 `readiness`：把参会人覆盖、证据数量、open loop、未匹配和未展开名单压成“准备就绪 / 部分就绪 / 需要补齐 / 缺少参会人”，并列出下一步和成功标准；页面和复制简报都保留这段会前检查。
- 生成结果还会给出 `focus` / “会前焦点”：把弱匹配身份、未闭环事项、未匹配/未展开参会人、证据复核和会后沉淀压成进入会议前先看的 3-4 条动作。每条焦点都带边界说明，明确只是会前提醒，不会发送、写入人物画像或自动创建任务；复制简报会保留同样的焦点和边界。

这块的产品参考包括 [Microsoft Copilot for Sales meeting preparation card](https://learn.microsoft.com/en-us/microsoft-sales-copilot/meeting-prep) 的 high-value highlights / risks / talking points、[Copilot for Sales enhanced pre-meeting card](https://learn.microsoft.com/en-us/copilot/release-plan/2025wave1/copilot-sales/improve-seller-efficiency-through-digest-recent-meetings-action-shortcuts) 的 recent communications / strategic insights / action shortcuts，以及 [Salesforce Einstein Relationship Insights](https://www.salesforce.com/news/stories/salesforces-new-ai-agent-identifies-business-connections-to-build-relationships-for-salespeople/) 的 relationship evidence 和 meeting-prep 定位。研究参考包括会话结构驱动的会议摘要（Georgia Tech EMNLP 2020 meeting-notes research）和长期记忆个人助手风险讨论。共同结论是：会前简报不能只列人物资料，还应该直接告诉用户“这场会还缺什么、先确认什么、会后要沉淀什么”，并把身份、来源、敏感范围和写入边界放在动作旁边。

### Assistant Draft

`POST /api/v1/relationships/assistant/draft` 为给某个人的沟通场景生成草稿上下文：

- 使用当前人物的 redacted relationship context，默认不把敏感人物上下文写进草稿。
- 草稿会优先带入用户目标、第一条 open loop、当前建议和可确认事实；上下文很薄时，只生成轻量确认语气。
- 返回 `safetyReview`，说明证据数、未闭环数、待确认关系事实、默认隐藏的敏感上下文数量，以及 `ready / review_first / thin_context` 状态。
- 返回 `contextBasis` 和 `suggestedChecks`，让 UI 在复制前展示这版草稿用了什么依据、还要人工扫哪几项。
- 用户点击生成后会先显示“草稿生成请求回执”：说明本次目标人物、用户目标、旧草稿是否仍在页面上、默认隐藏敏感上下文，以及返回前不会替换当前草稿、不会发送消息、写入画像、创建跟进或临时包含敏感上下文；生成中复制按钮保持锁定，避免把旧草稿误当成当前请求结果。
- 草稿正文上方会显示“草稿生成回执”：说明人物上下文来自索引即时计算、后台整理还是人工确认画像，这版草稿用了多少证据 / open loop / 建议 / 确认事实，默认隐藏了多少敏感上下文，以及没有发送消息、写入画像或创建跟进任务。
- 如果草稿生成后用户又修改“你要达成什么”，页面会在旧草稿正文前显示“草稿目标变更回执”，列出当前输入和旧草稿依据，并把复制按钮锁成“先重新生成”。旧草稿仍保留供对照，但重新生成前不会复制旧草稿、发送消息、写入画像、创建跟进或临时放开敏感上下文。
- 生成和复制按钮本身也带 hover / 读屏边界：生成按钮说明只读取默认隐藏敏感上下文的人物关系卡、返回前不替换旧草稿、不会发送/写画像/建跟进/同步外部系统；复制按钮区分生成中锁定、目标已变更锁定和可复制三种状态，并说明只写入本机剪贴板。
- API 只接受 `personId/personName`、`scenario` 和 `userGoal`，不会通过 `includeSensitive` 之类的额外字段临时放开敏感上下文。
- 用户点击复制草稿后，页面会保留“草稿复制回执”：说明剪贴板里只有草稿正文，没有发送消息、写入人物画像或创建跟进任务，并重申默认隐藏的敏感上下文和待确认关系事实仍需发送前复核。
- 当前只产出上下文和草稿建议，不自动发送消息；复制前用户仍要复核语气、事实和边界。

这块的产品参考是 Outlook Copilot / Gmail Gemini / Salesforce Einstein 这类上下文驱动写作入口；研究参考包括 Smart Reply、AI-mediated communication 和 mixed-initiative writing assistant。共同结论是：关系型回复草稿应当提高起草效率，但必须让用户看到证据边界、敏感隐藏和人工复核点，避免把 AI 生成文本伪装成已确认的人际事实。

### Review Queue

`GET /api/v1/relationships/review-items` 和 `POST /api/v1/relationships/review-items/:id/:action` 提供关系事实校准：

- 用户可以 confirm / reject / snooze 待确认项。
- confirm 可写入用户编辑后的值。
- snooze 会延后再次提示；到期后会重新进入“待确认”，不会永久藏在“稍后”筛选里。
- confirm / snooze / reject 后会返回并展示“校准回执”：确认说明写入了哪个人物画像字段，稍后说明何时回到队列，驳回说明没有写入画像；回执同时保留证据数量和复核备注状态，避免用户只看到卡片消失。
- snooze 成功后还会展示“稍后回队列凭证”：明确回队列时间、当前状态、编辑草稿/备注/证据是否保留，以及本次只更新 Review Queue 的稍后状态，没有写入人物画像、确认或驳回候选事实、发送消息、创建跟进或同步外部系统；右侧紧凑回执也保留这条回队列摘要。
- review item 保留 evidence refs、confidence、priority 和用户备注。
- UI 的确认队列始终使用独立的待确认列表，不会被“已确认 / 已驳回 / 全部”等筛选误导。
- 人工确认卡会展示人物、写入字段、优先级、置信度、证据入口、可编辑写入内容和复核备注，避免用户在缺少上下文时 rubber-stamp 关系事实。
- 每张完整人工确认卡都会显示“校准影响预览”：确认会写入哪个人物画像字段，稍后只延后复核且不写画像，驳回不会写入、发送、创建跟进或删除原始证据。
- 完整人工确认卡还会显示“草稿回执”：编辑建议写入内容或复核备注只会先留在本页；确认才提交写入画像，稍后会保留草稿和备注但不写画像，驳回只保存备注并保留不写入边界。
- 完整卡的 `确认` / `稍后 7 天` / `驳回` 按钮会把同一份后果写进 hover 和读屏边界：确认会写入人物画像并影响后续 Context Card / Meeting Brief / Assistant Draft；稍后只保留候选、草稿、备注和证据并约 7 天后回队列；驳回只标记候选并保留原始证据，不删除来源、不发送消息、不创建跟进。
- 如果确认 / 稍后 / 驳回请求失败，页面会显示“校准失败回执”，说明人物画像没有写入、队列没有被移出或候选没有被驳回，并保留本页草稿让用户修正后重试。
- 当待确认、稍后、已确认、已驳回或全部筛选返回 0 条时，页面显示“空筛选回执”：说明本次读取成功、当前筛选范围、待确认是否仍有剩余，以及空态不会写入人物画像、自动确认、驳回、删除证据或同步外部系统；用户可以回到待确认、查看全部状态或重新读取队列。
- 右侧 `确认队列` 只作为摘要和分流入口：侧栏不再提供一键确认写入，必须点击 `进入复核` 打开完整卡后，才能从带证据、字段和可编辑内容的 Review Queue 执行确认。`进入复核` 按钮本身说明它只是打开完整卡，不会写入、确认、驳回或稍后。侧栏仍可快速 `稍后 7 天`，因为它不会写入人物画像；按钮旁和按钮 hover / 读屏边界都会说明这只延后 Review Queue 状态、约 7 天后回队列，不确认、不驳回、不删除证据、不发送消息或创建跟进；需要改写入内容或补备注时应先进入复核。

这块的产品参考是 Google Contacts 的“Merge & fix”建议式合并、Salesforce Einstein Relationship Insights 的 evidence-backed relationship recommendation、HubSpot task queue 和 Covve relationship reminders；研究参考主要来自 mixed-initiative UI、AI suggestion review bias、task reminders 和 notification snooze/deferral。共同结论是：系统可以提出候选关系事实，但写入前必须保留证据、用户可编辑权和明确的稍后/驳回路径。

### Relationship Graph

`GET /api/v1/relationships/graph` 生成轻量人物关系图：

- node 来自高频 Person 和其强关系对象。
- edge 来自 `relationships`，保留 relation type、strength 和目标实体。
- dynamics 会标出 rising、dormant、review_needed 等可行动变化。

这不是完整知识图谱编辑器，而是给用户快速判断“最近哪些人关系升温、沉默或需要确认”的工作视图。

## 数据模型

迁移 `memory-service/src/storage/migrations/020_relationship_radar.sql` 维护四类表：

| 表 | 用途 |
|---|---|
| `relationship_radar_people` | 人物雷达投影、状态、分数、证据和生成时间 |
| `relationship_context_cards` | 已生成的人物上下文卡和 source hash |
| `relationship_event_index` | 关系事件索引，例如 open loop 或重要互动 |
| `relationship_review_items` | 待确认关系事实、推断或校准项 |

### 兼容性注意

`020_relationship_radar.sql` 曾在早期版本只创建了较少字段。长期运行的个人数据库如果已经 applied 早期 020，后续修改 `CREATE TABLE IF NOT EXISTS` 不会自动补列。为避免远端旧库出现 `table relationship_radar_people has no column named data_quality` 这类问题：

- `Database.ensureSchemaCompatibility()` 会在启动迁移后补齐 `relationship_radar_people` 的 legacy 缺失列。
- `032_relationship_radar_compat.sql` 会确保 `relationship_context_cards` 和 `relationship_event_index` 等后续表存在。
- 如果页面显示 0 人且 Network 返回 500，应先查 `/api/v1/relationships/people` 的错误，而不是直接判断“没有人物数据”。

### 没有数据时怎么排查

1. 调 `GET /api/v1/relationships/people?limit=10`，确认不是 500 或 timeout。
2. 如果报缺 column/table，说明旧库 schema drift，运行最新迁移或 compatibility pass。
3. 如果 `totalCandidates=0`，检查 `entities` 里是否有 `type='Person' AND status='active'`。
4. 如果有候选但 `items=[]`，打开页面“候选”筛选或传 `includeBelowThreshold=true`，判断是否只是未达到高频阈值。
5. 如果人物存在但上下文弱，检查消息的 `entities_json`、sender/name/alias、`relationships` 和 `entity_properties` 是否能关联到同一 Person。

## 代码入口

- UI: `src/modals/components/RelationshipRadarPage.vue`
- API routes: `memory-service/src/routes/relationships.ts`
- Core service: `memory-service/src/core/RelationshipRadarService.ts`
- Migration: `memory-service/src/storage/migrations/020_relationship_radar.sql`

## 边界

- 不自动替用户发消息。
- 不把关系打成绝对好坏分数。
- 不把未确认推断当作事实。
- 不默认把敏感人物上下文外发给其他 AI。
- 不打开未经安全检查的证据链接。
- 不替代 `memory_system.md` 里的自我反思、决策中心、主动询问和通知链路；Relationship Radar 消费这些链路产出的证据。

## 验证建议

改动 Relationship Radar 时优先运行相关 memory-service 测试，并补充最小 UI/E2E 验证：

```bash
npm run verify:relationship-radar
npm start
npm run verify:relationship-radar:e2e
```

`npm start` 是 webpack watch，需要等首次 successful compile 后停止。
