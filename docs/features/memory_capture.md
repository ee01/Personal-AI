# Memory Capture / 记忆捕捉

_最后更新: 2026-07-14_

## 是什么

Memory Capture 是 Personal AI 的低打扰资料入库层。它负责把用户真正关注的网页、选中文本、用户对外输入、会议资料、AI 工具资料等捕捉成可追溯的长期记忆。

用户看到的简单表达是：

> 重要内容自动记住；不确定但可能重要的内容给一个很小的 `+`；用户主动选中内容时可以一键记住。

### `记住` 按钮视觉契约（长期约束）

网页右侧的 `记住` 按钮，包括选中文字、整页资料和视觉证据入口，可见内容与顺序固定为：**前置 `+` icon + `记住` + 末尾 Personal AI icon**。

- 默认、hover 和 focus 状态都不得在按钮内新增、替换或展开其他说明文字；不要把 `未写入 · 先复核`、候选原因、资料类型、页面快照、触发依据、保存范围或写入回执塞进按钮。
- 视觉证据可以用轻微的颜色或样式差异表达，但不能改变上述三个可见元素，也不能追加“视觉证据”等文案。
- 无障碍名称可以准确说明这是 `记住` 操作，但不能改变按钮的可见组成；不要用 hover tooltip 承载长篇信任说明。
- 这个视觉契约不改变各入口原有的点击行为：选区与整页入口仍先打开复核面板、确认前不写入，视觉证据仍沿用既有的保存与预览链路。保存对象、触发依据、写入范围和未写入边界等详细说明统一放在复核面板及后续 toast / 详情回执中，不依靠加长按钮表达。
- 这是该入口的稳定 UI contract；后续实现、重构和验证都应守住这三个可见元素，不以增加“信任说明”为理由把按钮改成长文案 chip。

当前 P0 已落地的是 **选中文字保存**、**整页资料保存**、**Jira owner comment 自动捕捉** 和 **source memory 召回**：

- 用户在非敏感网页选中文字。
- 内容脚本先用现有 Selection Memory Search 查关联记忆，同时调用 Memory Capture 候选评分。Memory Capture 有独立的选区信息量判断，不再被 Memory Lens 的只读展示门槛拦掉。
- 如果选区有足够信息量且不含 secret/token/password 等风险，页面最右侧、与选区同高度吸附显示一个半露出的 `记住` 按钮；多行选区以最后一行的高度为准。按钮始终按“前置 `+` icon、`记住`、末尾 Personal AI icon”显示，hover / focus 不展开额外文字。点击只打开复核面板，不会直接保存、外发或同步；这个记忆入口和整页 / 视觉入库共用同一套右侧半露出样式。
- 划词关联记忆的 Personal AI icon 仍跟随选区旁，只负责打开 Memory Lens 结果；记住入口是独立挂在页面右侧边缘的元素，与它分离，避免两个能力挤进同一个 button bar 互相抢注意力。
- 点击 `+ 记住` 后打开页内复核面板，显示选中文本预览、保存范围回执、选区快照回执、候选原因和可选备注；保存范围会说明这是选区资料、来源 host、写入的记忆范围，以及会落到资料记忆和 `web` 检索信号。选区快照回执会说明保存的是面板打开时预览里的那段文字，备注只补充保存原因，不会重新抓取页面或改成新的选区；如果页面或选区已变化，需要取消后重新选择。确认后保存为 `source_memory_capsule`。如果在复核面板按取消，不会保存，入口会保留。保存成功、发现重复保存或重复保存时刷新了备注，toast 都提供 `查看`，直接进入该 capsule 的详情页。
- 页面有复制、深度滚动或足够停留等用户意图信号时，页面接近右上角显示同样的右侧半露出 `记住` 按钮。按钮只显示前置 `+` icon、`记住` 和末尾 Personal AI icon，hover / focus 不增加说明文字。点击只打开复核面板，不会直接保存、外发或同步；复核面板会显示页面快照基准和触发依据：保存的是当前提取的页面正文快照，触发来自本机复制、停留、滚动和候选评分信号，不代表系统确认页面事实。面板还会展示页面标题、正文预览、候选原因、保存范围回执和可选备注；保存范围会说明这是当前页面资料、来源 host、写入的记忆范围，以及会落到资料记忆和 `web` 检索信号。确认后保存整页正文为 `webpage` capsule，取消则不保存且入口保留。如果同一资料已经入库但用户在本次复核里补了备注，系统会更新原 capsule 的 summary、metadata 和关联 `web` 检索信号，而不是丢弃这条备注。
- 页面中识别到图表、表格、canvas、SVG、figure 或高信息量 DOM 区域时，不新增独立“视觉记忆”入口，仍复用当前网页右侧 `记住` 按钮；视觉证据可以用轻微不同的样式区分，但按钮仍只显示前置 `+` icon、`记住` 和末尾 Personal AI icon，不在 hover / focus 时追加“视觉证据”等文字。点击后先保存为 `sourceKind='visual_memory'` 的 source-memory capsule，再在成功提示里提供 `预览`；用户打开预览后可以在同一右侧窗体查看已入库信息并补备注。表格会在 `metadata.visualMemory.table` 中保存 headers、rows、rowCount、columnCount 和 truncated 状态；SVG 会在安全净化后保存 `metadata.visualMemory.svg.markup` 作为图形快照；source-memory 详情页负责按结构化表格或 SVG 预览展示。
- 当整页候选达到更高置信度时会自动入库：例如复制页面内容且阅读到较深位置、浏览时间较久且阅读较深、或浏览时间非常久。自动入库不弹确认框；保存请求发出后先显示 `页面资料入库提交中`，说明本机请求尚未确认创建 capsule 或写入 `web` 检索信号，并带上本次页面快照与自动触发依据。成功后右上角显示 5 秒轻提示，默认只显示 Personal AI logo 和 `已存入记忆`，hover / focus 后展开显示原因、页面快照、保存范围、`查看` 和 `撤销` 按钮，长回执会换行展示而不是被截断。`查看` 会打开 source-memory 详情页，让用户先核对系统保存了什么；`撤销` 成功后会展示资料召回已关闭的 `writeReceipt`，说明关联 `web` 检索信号已移除，后续 Ask、Memory Lens 和时间轴不再使用这条资料。用户 hover / focus 在提示上时暂停消失计时，移开或失焦后重新开始 5 秒倒计时。如果自动写入失败，系统会显示带页面快照的 `页面资料未写入` 回执，明确没有创建资料记忆或网页检索信号，右侧入口仍可重试。
- 选区、整页或视觉证据的手动保存如果失败，包括保存前页面 / 选区上下文已经变化，面板 / toast 会明确说本次没有创建资料记忆，也没有写入 `web` 或视觉证据检索信号；原入口仍保留，用户可以重新选择、直接重试或稍后再保存。
- 保存、详情、备注和撤销 API 都会随 capsule 返回 `writeReceipt`。它明确区分：资料 capsule 已写入且关联 `web` / 视觉检索信号已启用；资料仍保存但关联检索信号缺失；或资料已撤销、关联信号已移除且不会再进入 Ask、Memory Lens 或时间轴召回。前端成功 toast 优先展示这份回执，而不是只说“已保存”。capsule 还会返回 `actionReceipt`，从最近一次用户可感知事件生成，说明本次是新保存、重复命中、重复保存刷新备注、补备注、撤销，还是撤销后重新保存；详情页会显示这条 `最近操作回执`，避免用户离开 toast 后不知道最后一次动作到底有没有新建或更新资料。创建保存被阻断或校验失败时，API 返回 `noWriteReceipt`，说明没有创建 source-memory capsule、没有写入 `web` / 视觉检索信号，也没有外发、插入或同步。
- 候选评分和保存 API 会先阻断带凭据的来源 URL，包括 userinfo、`token` / `session` / `password` / `passcode`、OAuth code、signed URL signature 等 query 或 hash 参数；这类输入不会创建 source-memory capsule、不会写 `web` 检索信号，也不会把原始 URL 写入 daily/source markdown snapshot。详情页和召回卡仍保留来源链接安全隐藏逻辑，用来防御历史数据或外部返回的敏感来源链接。
- 资料详情读取失败时，详情页会显示 `详情读取失败回执`：本次只是详情读取失败，不代表创建、撤销、更新备注、写入 `web` 检索信号或同步外部系统；失败态只保留重试和返回入口，不显示打开来源、查看关联记忆或撤销按钮。
- 保存、重复保存刷新备注、补备注后，后端会在同一个 source-memory capsule 上生成 P0 蒸馏层：`metadata.distillation` 包含 `status`、`schemaVersion`、`oneLineCue`、`compactMemo`、`policyReceipt` 和 `inputHash`；已有 draft takeaways 会升级为 ready / partial / blocked，trigger matcher 会补 scene anchors、展示预算和 suppress rules，`source_memory_links` 会写 source host / entity hint 的低副作用连接，`source_memory_events` 会记录 `distillation_started` 与 `distillation_ready|partial|blocked`。资料详情页可直接补备注并刷新这份 source pack；提交中会先显示备注、关联 `web` 检索信号和蒸馏尚未确认的回执。这一步只整理资料证据，不自动写 confirmed profile、创建任务、创建 skill 或同步外部系统。
- 已有 Jira owner-authored learning 信号会继续写入原 ingest，同时自动生成 `jira_comment` capsule，作为用户对外输入的资料记忆。
- 后端同时写入 `messages_raw.source_type='web'` 和 `chunks.source_type='web'`，让 Coverage Map、搜索和后续召回能看见这条网页记忆信号。
- `/context-recall` 支持 `sourceTypes: ['source_memory']`，返回专门的 `source_memory` 资料记忆卡。卡片会先说明这是用户已保存的资料证据，并展示资料类型（整页、选区、视觉证据等）和保存方式（主动、建议、自动）；如果 capsule 有 ready distillation，卡片优先展示 `oneLineCue` 和“蒸馏提示”，否则退回命中的关键词或来源标题。Expanded Card 会显示 `资料回执`，集中说明资料类型 / 保存方式、当前蒸馏状态、资料详情复核入口、原始来源是否安全可打开，以及本卡只读、不新增或撤销资料记忆、不写画像 / 任务、不插入或发送的边界。点击 `在记忆中查看` 进入 Memory Exploring 的 capsule 详情页查看保存原因、证据锚点、蒸馏要点、未来触发线索和关联 web 记忆信号；这个详情按钮和安全原始来源链接的 hover / 读屏文案都会重复说明本次点击只是新标签复核，不会新增/撤销资料记忆、写画像/任务、插入输入框、发送内容或确认事实。卡片和资料详情页只渲染安全的 `http(s)` 来源链接；如果保存来源带账号密码、OAuth code、token、session 等敏感 URL 参数，原始来源会显示为已隐藏，不提供 `打开来源`，但仍保留资料详情复核入口。资料详情页会展示召回边界：saved capsule 有真实 linked `web` 记忆信号时才显示 `查看关联记忆`；dismissed capsule 会说明关联 `web` 信号已移除，后续 Ask、Memory Lens 和时间轴召回不再使用这条资料。

## 产品边界

Memory Capture 负责：

- 判断网页/选区/外部输入是否值得入库。
- 执行自动入库、建议入库和用户主动入库。
- 保存 source capsule、source anchors、takeaways、future triggers 和行为事件。
- 在入库后把已保存资料蒸馏成可预算、可复核、带来源的上下文单元，供 source-memory 详情、Context Recall、Reflection 和 Dream 消费。
- 把已保存资料写成 `web` 来源记忆信号，保持 Memory Service 现有搜索、覆盖地图和召回链路可用。
- 网页/外部输入入库时由 `injectionScreen` 标记信任级别与注入嫌疑（见下）。

### 注入防护（P0-2）

`web` / 外部 AI 等来源是不可信内容，可能在正文里藏对 AI 的指令。入库时 `IngestionPipeline` 调用 `core/injectionScreen.ts`：按来源判定 `trust_class`（web → `untrusted`），用正则识别注入模式写入 `injection_flags_json`，并在 `/ingest` 回执的 `decision.trustClass` / `sanitization` / `injectionFlags` 中返回。原文不删改，只打标。召回时 `/ask` 会把 untrusted 来源内容包进中性数据框，使其作为「数据」而非「指令」进入模型。完整机制与边界见 [记忆系统 · 记忆注入防护](./memory_system.md) 与 `docs/progressing/memory-injection-defense-plan.md`。

Memory Capture 不负责：

- 不展示“你以前见过什么”。这是 [Memory Lens](./memory_lens.md) 的职责。
- 不把普通浏览历史全量保存。
- 不把“看过网页”直接推断成用户偏好或 confirmed profile。
- 不做校准平台。保存、忽略、打开、引用等行为可以被 Ambient Calibration 消费，但校准层是横切反馈层。

## Source Memory 与 Timeline 的边界

`source-memory` 和 `timeline` 不是按“网页 / 消息”分，也不是互相替代关系。它们的边界是：这条来源是不是用户主动保存成一份资料证据。

`source-memory` 是用户主动保存的资料证据 capsule。它强调“这份资料从哪里来、为什么保存、保存了哪段证据、以后什么场景应该想起”。典型对象包括网页全文、选区、视觉证据、表格证据、Jira 页面资料、用户明确保存的外部 AI 资料等。详情页应展示来源 URL、页面标题、capture reason、备注、证据锚点、视觉/表格预览、takeaways 和 future triggers。

`timeline` 是普通原始记忆的时间线定位和上下文回放。它强调“这件事什么时候发生、前后还有什么、当时谁说了什么或系统记录了什么”。典型对象包括 `messages_raw`、`chunks`、meeting 转写片段、Glip 消息、Jira 活动、普通网页记忆信号等。时间轴适合查看附近消息、会议上下文和同一时间窗口内的其他记忆。

跳转规则：

- 如果召回结果引用的是用户主动保存过的资料证据，优先跳 `memory-exploring.html#/source-memory/:id`。
- 如果召回结果引用的是普通 message / chunk / meeting / glip / jira 等原始记忆，优先跳 `memory-exploring.html#/timeline?...focus=...`。
- 如果一个 source-memory capsule 同时写入了兼容搜索用的 `web` 记忆信号，source-memory 详情页可以展示“关联 timeline 记忆信号”，但主入口仍是 capsule 详情页。
- 如果用户问“这份资料原文是什么、来源在哪、当时为什么保存”，走 source-memory；如果用户问“当时发生了什么、前后上下文是什么”，走 timeline。

例子：

| 场景 | 应该打开 | 原因 |
| --- | --- | --- |
| 用户在 RingCentral wiki 的 China ScrumMasters Org 页面点 `+ 记住` 保存表格 | `#/source-memory/:id` | 这是用户主动保存的表格证据，需要展示来源、保存原因、表格预览和备注 |
| 用户在 Glip 里收到“明天 scrum master meeting 改到 3 点” | `#/timeline?...focus=message:<id>` | 这是普通消息记忆，用户更需要查看前后聊天上下文 |
| 会议转写里有人说 “Nova Native Channel 现在 7.5 人” | `#/timeline?...focus=chunk:<id>` | 这是会议原始片段，重点是当时谁说、前后讨论了什么 |
| 用户在 Jira issue 页面点 `+ 记住` 保存需求描述 | `#/source-memory/:id` | Jira 页面被用户主动保存成资料证据，详情页应保留 issue 来源和证据锚点 |
| AI 回答引用“你之前保存过 China ScrumMasters Org 表格” | `#/source-memory/:id` | 用户要核对的是被保存的资料证据，而不是某个时间点附近的普通记忆 |
| AI 回答引用“你上周和某人聊过这个” | `#/timeline?...focus=...` | 用户要回看的是当时的消息或会议上下文 |

## 授权分层

| 层级     | 用户体验                                                                                                                      | 当前状态                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 自动入库 | 可信来源 + 强意图行为时后台保存，不弹大面板；右上角 5 秒 compact toast 默认只显示 logo + `已存入记忆`，hover 后显示原因和撤销 | P0 已用于 Jira owner comment 和高置信整页网页 |
| 建议入库 | 强信号但不确定时显示很小的右侧半露出 `+ 记住`                                                                                 | P0 已用于选中文本和整页资料                   |
| 主动入库 | 用户选中文本或当前页面后点击右侧半露出 `+ 记住`，可加备注保存                                                                 | P0 已实现                                     |

## 入库触发逻辑

选中文本不会每次都出现入库入口。当前必须同时满足这些条件：

- 页面不是 incognito、敏感 URL，也没有可见的 password / token / MFA / 支付等敏感输入控件。
- 选区不在输入框、textarea、contenteditable 或 Personal AI 自己的浮层里。
- 选中文本通过本地信息量判断：去掉空白和 UI 壳文本后，至少约 28 个有效字符或 10 个中文字符；不能像 Memory Lens 自己的展示卡片；不能包含 secret、token、password、银行卡号等敏感模式。
- 文本还要有明确语义：命中具体项目 / 任务 / 技术 / 数字等信号，或至少 5 个有意义 token，或中文信息量足够。
- 后端候选评分必须达到建议阈值。评分会叠加来源 URL、标题、来源类型、文本长度、选中、复制、停留、滚动、重复访问、用户对外输入、实体线索等；命中敏感 URL 或 secret 会直接 blocked。

是否必须点 `+`：

- 选中文本：当前必须点选区同高度、最右侧吸附的右侧半露出 `+ 记住`（多行选区以最后一行为准），不会因为划词自动写入。
- 整页网页：不一定必须点 `+`。普通强信号只显示右侧半露出的 `记住` 按钮，其可见内容固定为前置 `+` icon、`记住` 和末尾 Personal AI icon；点击只打开复核面板，由面板说明 `未写入 · 先复核`，确认前不写入。达到自动阈值时直接保存，并在右上角显示 compact 轻提示。默认态只显示 logo + `已存入记忆`；hover / focus 后展开“因为 xxx，本网页信息已自动存入记忆库”、保存范围、`查看` 和 `撤销`。`查看` 打开这条 source-memory 详情页；撤销会把 capsule 标记为 dismissed，并显示关联检索信号已关闭的回执。提示在 hover / focus 期间不会消失，移开后再等 5 秒消失。
- Jira owner comment：已有 owner-authored learning 信号会自动写入 `jira_comment` capsule，不需要点 `+`。
- 后端评分已经能返回 `auto_save`、`suggest`、`ignore`、`blocked`。P0 前端对选区仍采用“强信号才提示、用户确认才保存”；整页网页只有达到更高置信度时才自动保存，避免把普通浏览史或误选文本静默入库。

整页自动入库的前端阈值：

- 页面正文至少约 `260` 词。短页面、目录页、搜索结果页即使被后端评为高分候选，也不会整页自动入库。
- `copiedText = true` 且 `dwellMs >= 90s` 且 `scrollDepth >= 0.85` 且候选分 `score >= 0.78`：复制过页面内容、停留较久并读到很深位置。
- `dwellMs >= 240s` 且 `scrollDepth >= 0.90` 且候选分 `score >= 0.78`：浏览时间很久且阅读到页面深处。
- `dwellMs >= 480s` 且 `scrollDepth >= 0.75` 且候选分 `score >= 0.78`：在当前页面停留非常久。

后端 `auto_save` 只表示候选评分高，不会单独触发整页自动入库；前端仍必须满足上面的正文长度、停留时间和阅读深度门槛。这样保留“无打扰保存”的能力，但把普通浏览、快速复制、浅滚动这类信号降为右侧 `+ 记住` 建议或完全安静。

候选评分 API 会返回 `policyReceipt`：把 `suggest` / `auto_save` / `ignore` / `blocked` 统一翻译成可展示的状态、证据和下一步。前端用它决定是否显示 `记住` 入口，并在复核面板中展示对应回执；不能把回执正文塞进 `记住` 按钮。被忽略或阻断时也能记录清楚原因，不把“没有出现入口”误读成系统失效。

存储层区分主动和自动：

- `source_memory_capsules.capture_mode` 保存 `manual` / `auto` / `suggested`，并有 `idx_source_memory_capsules_capture_mode_saved` 索引，后续可以直接统计自动入库占比。
- `source_memory_events.metadata_json.captureMode` 记录每次 save / resave / duplicate / dismiss 事件的来源模式。
- 主动入库的 `messages_raw.importance` / `memory_metadata.importance` 高于自动入库。当前权重：`manual = 0.72`，`suggested = 0.64`，`auto = 0.58`；chunk 权重在 message 权重基础上略低。
- 重复入库按 source fingerprint 去重；如果本次重复入库带了非空备注，会沿用原 capsule / message id，同时刷新 summary、`metadata.userNote`、`messages_raw` 和 chunks，让后续召回能读到最新“为什么保存”。如果没有新备注，只记录 `duplicate_save` 事件并提示已有资料；toast 会明确说明本次没有新建第二条资料，也没有更新备注或正文，只保持已有 capsule 和关联检索信号可复核。
- 如果用户撤销自动入库后又手动保存同一资料，系统沿用原 capsule，但会刷新 summary、content preview、capture mode、metadata 和对应 `web` 记忆信号，避免详情页继续展示撤销前的旧备注。
- 视觉证据当前走同一套 `source_memory_capsules` / `messages_raw` / `chunks` 写入链路，不单独创建 `visual_memory_*` 表或独立 API。视觉识别结果保存在 capsule metadata；source-memory 详情页读取 metadata 展示视觉区域信息、结构化表格预览和已保存的 SVG 图形快照。这样保存、备注、撤销、重复保存、搜索和 source 跳转都沿用现有 Memory Capture 语义。

候选评分会参考：

- 来源 URL、标题、来源类型。
- 文本长度和信息量。
- 是否选中、复制、停留、滚动、重复访问。
- 是否是用户对外输入。
- 是否有实体线索。
- 是否命中敏感 URL 或 secret/token/password。
- URL 本身是否携带凭据、OAuth code、session、signed-access 参数或 userinfo；命中时直接阻断，不进入保存链路。

## Source Memory 蒸馏层

Source Memory Distiller 是 Memory Capture 的入库后 source-specific distillation 层。它回答的是“这份已保存资料以后应该怎样被 Personal AI 消费”，而不是“这份资料要不要入库”。入库时仍先写 capsule、anchor、summary、draft takeaways、draft trigger 和 linked `web` signal；蒸馏层只在 capsule 已保存后，把同一份资料整理成可预算、可复核、带来源的 context unit。

当前 P0 使用 deterministic distillation：保存、重复保存刷新备注、补备注后，后端会基于 capsule 原文、摘要、备注、证据锚点和 entity hints 生成 `oneLineCue`、`compactMemo`、`policyReceipt`、`sourceReliability` 和 `downstreamUse`，并用 `inputHash` 避免同一输入重复蒸馏。source-memory 详情页的补备注入口会复用同一 API，提交中先说明当前页面仍是旧快照，成功后用后端 `actionReceipt` 和刷新后的蒸馏状态替换，失败时说明没有确认更新备注、刷新检索信号或重新生成蒸馏。后续真正的后台 worker、LLM 深蒸馏、open questions、skill candidate 和跨 capsule 聚合仍属于下一阶段。

与其他记忆整理层的边界：

- **不是入库路径**：它不决定是否保存网页、选区、视觉证据或 owner-authored comment；这些仍由候选评分、用户确认和 Memory Capture 写入链路决定。
- **不是 Self Reflection**：它只围绕单个 source-memory capsule 生成 source pack，不围绕长期主题推理，不产出动作、确认请求或 OpenClaw delegation。Reflection 可以消费 ready source pack 作为证据，再决定是否形成开放问题或下一步。
- **不是 Dream Replay**：它不做全局联想、不生成低置信关系或梦境洞察。Dream 可以读取更干净的 source evidence，但 dream 结果仍按生成式低置信线索处理。
- **不是画像写入器**：ready takeaway 仍是 source-local evidence，不等于 confirmed profile、偏好、事实或技能。是否升格到 User Profile、Rehearsal、Skill Foundry 或外部动作，必须经过对应能力自己的 gate。
- **不是用户审查队列**：`partial` / `blocked` 只是这条资料的蒸馏状态，默认不创建新的 review item；详情页和召回卡只展示边界和复核入口。

## 数据模型

| 表                        | 用途                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `source_memory_capsules`  | 资料记忆主对象，保存来源、标题、fingerprint、状态、摘要、capture reason |
| `source_memory_anchors`   | 原文证据锚点，当前 P0 是 text selection/page excerpt                    |
| `source_memory_takeaways` | 从证据中提取的 takeaways；保存时先 draft，蒸馏后标为 ready / partial / blocked，不等于 confirmed fact |
| `source_memory_triggers`  | 未来触发线索，例如 host、实体、标题搜索；蒸馏后 matcher 会补 scene anchors、展示预算和 suppress rules |
| `source_memory_links`     | 用于连接 source host、entity hint、project/message/meeting/skill 等对象，P0 只写低副作用 `distilled_anchor` |
| `source_memory_events`    | 保存、重复保存、dismiss、distillation_started / ready / partial / blocked 等行为事件，可供无感校准层消费 |
| `messages_raw` / `chunks` | 兼容现有 Memory Service 的 `web` 来源检索和覆盖信号                     |

DB 是运行时真源；Markdown 只作为 daily/source snapshot。

`source_memory_capsules.metadata_json.distillation` 是蒸馏层真源。P0 字段包括：`status`、`schemaVersion`、`oneLineCue`、`compactMemo`、`policyReceipt`、`sourceReliability`、`downstreamUse`、`generatedAt`、`sourceAsOf`、`inputHash`、`evidenceAnchorIds`、`takeawayCount` 和 `triggerCount`。资料详情页会把这份 `policyReceipt` 作为首屏 `资料蒸馏回执` 展示：用户能看到 ready / partial / blocked 状态、证据数量、一行提示、compact memo、来源可信度、蒸馏生成时间、来源快照时间、短输入指纹、允许作为哪些下游证据，以及不会自动写画像、建任务或外部同步。

## API

| API                                               | 用途                                              |
| ------------------------------------------------- | ------------------------------------------------- |
| `POST /api/v1/source-memory/candidates/score`     | 通用候选评分，返回建议动作和 `policyReceipt`      |
| `POST /api/v1/source-memory/candidates/selection` | 选中文本候选评分，默认带 selectedText 信号和回执  |
| `POST /api/v1/source-memory/capsules`             | 保存 source memory capsule，并写入 `web` 记忆信号 |
| `GET /api/v1/source-memory/capsules/:id`          | 读取资料记忆详情                                  |
| `POST /api/v1/source-memory/capsules/:id/note`    | 保存后补充或更新备注，并刷新关联 `web` 记忆信号   |
| `POST /api/v1/source-memory/capsules/:id/dismiss` | 标记资料记忆为 dismissed                          |

`capsule.writeReceipt` 是前端展示保存结果的统一回执：`saved_with_recall_signal` 表示 capsule 和关联检索/召回信号都可用；`saved_without_recall_signal` 表示 capsule 仍在但 linked `messages_raw` 信号缺失，后续召回不会依赖这条缺失信号；`dismissed_no_recall` 表示撤销后只保留复核记录，关联 `web` 检索信号已移除。回执还会带资料类型、保存方式、范围和检索信号状态，并声明不会自动外发、插入输入框或同步到其他平台。`capsule.actionReceipt` 则只描述最近一次用户可感知操作，跳过 `distillation_*` 这类内部事件；它用于解释“这次是否新建、是否只是重复命中、是否刷新备注、是否撤销/重存”。撤销 API 是幂等的：如果 capsule 已经是 dismissed，再次撤销只返回当前已关闭召回状态，不追加第二条撤销事件、不刷新 `updated_at`，也不会把重试误报成新的资料变更。`capsule.metadata.distillation.policyReceipt` 说明本条资料的蒸馏状态和下游边界。`POST /source-memory/capsules` 如果因为敏感来源、签名 URL、低信息量文本等原因拒绝保存，会在错误响应里带 `noWriteReceipt`：`blocked_no_write` 表示安全门禁阻断，`invalid_no_write` 表示没有达到创建门槛；两者都明确 capsule 未创建、关联检索信号未写入、不会外发 / 插入 / 同步。

## 代码入口

- Backend service: `memory-service/src/core/SourceMemoryCaptureService.ts`
- Backend route: `memory-service/src/routes/sourceMemory.ts`
- Migration: `memory-service/src/storage/migrations/029_memory_capture.sql`
- Extension client: `src/services/MemoryServiceClient.ts`
- Background bridge: `src/background.ts`
- Selection UI: `src/contentScriptWebIntelligence.ts`
- Context Recall source card: `memory-service/src/core/ContextRecallService.ts`
- Memory Exploring capsule detail: `memory-exploring.html#/source-memory/:id`

## 后续实现顺序

1. 页级自动捕捉：当前已接入停留时间、滚动深度、复制信号和低打扰建议保存；后续再接 active tab、重复访问、白名单来源和设置项控制的强兴趣自动保存。
2. 用户对外输入自动入库：Jira owner comment 已接入；RingCentral reply、Web AI prompt 等 owner-authored 内容待统一归入 Memory Capture。
3. Context Recall source memory：基础 source memory card 和 Memory Exploring capsule 深链详情页已实现；后续可补 capsule 列表与批量整理。
4. 深度蒸馏：P0 已在保存 / 备注更新后生成 deterministic ready distillation，并复用现有 tables；后续再接后台 worker、open questions、skill candidate 和跨 capsule 聚合。
5. Coverage Map 增强：展示 capsule 数、自动/主动入库比例、最近保存来源和阻断原因。

## 参考与产品判断

- [Notion Web Clipper](https://www.notion.com/en-US/web-clipper)、[Readwise Reader extension](https://docs.readwise.io/reader/docs/saving-content)、[Obsidian Web Clipper](https://obsidian.md/help/web-clipper)、[Raindrop Highlights](https://help.raindrop.io/highlights/)、[Zotero Connector](https://www.zotero.org/support/adding_items_to_zotero) 和 [Hypothesis](https://web.hypothes.is/) 都把网页保存、划词高亮/注释做成明确的用户动作，并保留来源、快照、备注或私有/群组语境；Memory Capture 的 `+` 应保持同样的“确认才写入”语义，自动入库只用于强意图、低风险场景。
- PIM 研究（[Keeping Found Things Found on the Web](https://www.microsoft.com/en-us/research/publication/keeping-found-things-found-web/)、[Personal Information Management](https://arxiv.org/abs/2107.03291)）强调用户保存网页资料时通常需要保留“当时为什么重要”的上下文。备注是这个上下文的一部分，所以取消复核面板应被视为取消保存，而不是静默保存空备注。
- 2026-07-04 复查 [NotebookLM sources](https://support.google.com/notebooklm/answer/16215270)、[Readwise web highlight capture](https://docs.readwise.io/readwise/docs/importing-highlights/other-sources)、[IBM CHI 2025 RAG trust/transparency](https://research.ibm.com/publications/exploring-trust-and-transparency-in-retrieval-augmented-generation-for-domain-experts) 和 [RAG trustworthiness survey](https://arxiv.org/html/2409.10102v1) 后，Memory Capture API 的失败态也要保持 source / control / traceability 可见：保存拒绝不能只返回裸错误字符串，而要明确“没有写入什么”和“下一步如何重试”。
- 2026-05-26 检查结果：本机 Reminders 没有 `Personal AI` 列表，本轮没有 Reminder 条目可合并或完成。
- 2026-05-28 检查结果：Context Recall 的 `source_memory` 卡片已改为优先进入 `#/source-memory/:id`，详情页保留来源链接、保存/更新时间、撤销入口和关联 timeline 记忆信号。这个路径对齐 Web Clipper / Reader / Hypothesis 的产品心智：保存不是终点，用户之后还要能重新查看“当时为什么保存”和原始证据。
- 2026-05-29 检查结果：手动保存或重复保存后的轻提示已补 `查看` 动作；撤销后重新保存同一 capsule 会同步刷新详情和检索信号，避免用户按新备注保存后仍看到旧上下文。
- 2026-05-30 检查结果：选中文本入库不再调用浏览器原生 prompt，而是在页面内打开轻量复核面板；取消只关闭面板并保留右侧 `+ 记住`，保存失败会停留在面板内显示错误。
- 2026-06-05 检查结果：整页资料保存也不再调用浏览器原生 prompt，改为同一套页内复核面板；取消不写入，保存时会禁用提交按钮避免重复写入，成功 toast 继续提供 `查看` 进入 source-memory 详情页。
- 2026-06-06 检查结果：重复保存同一资料时，如果用户在复核面板写了新备注，后端会刷新原 capsule 与关联 `web` 记忆信号；toast 改为提示备注已更新，避免用户以为备注保存成功但后续召回仍使用旧上下文。视觉证据 chip 也补上专用样式、aria-label 和 hover 文案，避免和普通整页入库混淆。
- 2026-06-07 检查结果：`source_memory` 召回卡片补上“已保存资料”回执、资料类型和保存方式，并统一跳 `#/source-memory/:id`；这样用户能区分保存过的资料证据和普通 timeline 记忆，不需要从泛化的 Memory Lens 文案里猜来源。
- 2026-06-08 检查结果：候选评分 API 新增 `policyReceipt`，让建议、自动候选、低信号忽略和敏感阻断都有统一的状态 / 证据 / 下一步；前端 `+ 记住` chip 和复核面板优先展示这个回执，避免只暴露零散打分原因。
- 2026-06-08 二次检查结果：整页资料保存的复核面板和自动入库展开态补上保存范围回执，明确来源 host、工作记忆范围，以及写入 source-memory capsule 与 `web` 检索信号；这对齐 Web Clipper / Reader 和 PIM 研究里“保存目的地、原始来源和为什么保存”要可回看确认的心智。
- 2026-06-10 检查结果：`source_memory` 召回卡片的来源链接过滤与页面 URL 隐私规则对齐。带 userinfo 或敏感 query 参数的保存来源不会作为卡片链接渲染，卡片改显示“原始来源已隐藏”，同时保留 `资料详情可复核`，避免把 token URL 误展示成可信可点击来源。
- 2026-06-11 检查结果：划词记住入口从“跟随选区的动作条按钮”改回独立的右侧半露出 `+`。它不再和 Memory Lens 的 Personal AI icon 挤在同一个 toolbar，而是用与整页 / 视觉入库一致的右侧吸附样式（`.pai-memory-capture-selection-dock`），与选区同高度、多行选区取最后一行的高度；文案统一为“记住”（整页、视觉入口同步改为“记住”，视觉仍保留轻微样式区分）。这样划词检索（跟随选区）和划词记忆（吸附右侧边缘）回到两条互不抢注意力的入口，和 Web Clipper / Reader 把“高亮/检索”与“保存”分开的心智一致。`webpage-memory-detection-check.mjs` 的划词断言同步改为校验独立 dock、右侧吸附位置和“记住”文案。
- 2026-06-13 检查结果：选中文本复核面板补上和整页一致的保存范围回执，保存前就能看到会写入选区资料、来源 host、工作记忆范围，以及资料记忆 + `web` 检索信号。选区、整页和视觉证据的手动保存失败也改为 `未写入` 回执，明确没有创建 capsule 或检索信号，入口仍保留可重试。
- 2026-06-15 检查结果：选区或整页复核面板在保存前发现页面上下文变化时，也会复用 `未写入` 回执：说明需要重新选择要保存的资料，并明确没有创建资料记忆或网页检索信号，避免用户误以为发生了部分写入。
- 2026-06-15 二次检查结果：资料记忆详情页复用搜索 / 时间轴的来源链接安全判断。带 userinfo、OAuth code、token、session、passcode 等敏感来源参数的 capsule 不再展示完整 URL，也不提供 `打开来源`；页面只保留来源 host、`原始来源已隐藏` 和可复核已保存内容的边界回执。
- 2026-06-18 检查结果：撤销资料记忆后，API 只有在 linked `messages_raw` 仍真实存在且 capsule 仍是 saved 时才返回 `messageId`。详情页同步新增 `资料召回已启用 / 已关闭` 回执；dismissed 资料不再显示 `查看关联记忆`，避免用户点到已删除的 timeline 信号或误以为撤销后仍会被召回。
- 2026-06-19 检查结果：Memory Capture API 新增 `writeReceipt`，保存成功、重复保存、详情、补备注和撤销都会返回同一套写入 / 召回信号状态。选区、整页、自动整页和视觉证据保存成功 toast 改为展示该 API 回执，明确已写入资料 capsule 和关联检索信号，或说明信号缺失 / 已撤销，并保留“不自动外发、插入或同步”的操作边界。
- 2026-06-21 检查结果：自动整页入库失败不再静默返回；前端会展示结构化 `未写入` 回执，说明没有创建 source-memory capsule 或网页检索信号，并保留入口重试。自动保存轻提示的 hover / focus 详情改为可换行展开，避免保存原因、写入范围和不外发/不同步边界被单行截断。
- 2026-06-23 检查结果：自动整页入库成功轻提示补上 `查看`，与 `撤销` 并列。用户可以先打开 source-memory 详情页核对实际保存内容；撤销成功后轻提示展示 API 返回的 `dismissed_no_recall` 回执，明确关联 `web` 检索信号已移除，后续 Ask、Memory Lens 和时间轴不再召回这条资料。
- 2026-06-24 检查结果：source-memory 详情页首屏新增 `资料蒸馏回执`。它直接消费 capsule metadata 里的 distillation policy receipt，展示一行提示、compact memo、证据锚点 / 要点 / 触发线索 / 低副作用链接计数、来源可信度、允许作为资料详情 / Context Recall / Reflection / Dream 证据，以及禁止自动写画像、自动建任务或外部写入同步的边界。旧 capsule 如果没有 distillation，会明确显示未生成，不把草稿要点误当 ready source pack。
- 2026-06-25 检查结果：选区、整页和视觉证据重复保存时，如果本次没有补备注，toast 改为重复入库专用回执：已有资料和关联检索信号保持启用，但本次没有新建第二条资料，也没有更新备注或正文；如果本次带了新备注，则说明更新的是同一条 capsule / summary / 关联检索信号，而不是创建重复资料。
- 2026-06-27 检查结果：Memory Capture API 新增 `actionReceipt`。`getCapsule()` 会从 `source_memory_events` 读取最近一次非 `distillation_*` 用户操作，返回新保存、重复命中、重复备注刷新、补备注、撤销或撤销后重存的简短回执；source-memory 详情页首屏显示 `最近操作回执`，让用户离开保存 toast 后仍能确认最后一次动作没有误建第二条资料、没有静默外发，也没有把内部蒸馏事件误当成用户操作。
- 2026-06-27 二次检查结果：source-memory 详情读取失败态补上 `详情读取失败回执`。如果 `GET /source-memory/capsules/:id` 暂不可用，页面会明确说明这只是读取失败，没有创建、撤销、更新备注、写入 `web` 检索信号或同步外部系统，并且不显示打开来源、查看关联记忆或撤销按钮。
- 2026-06-28 检查结果：普通整页 `+ 记住` 建议入口新增 `未写入 · 先复核` 回执。入口出现时不会创建 source-memory capsule；hover / focus、title 和 aria-label 都说明当前只是建议候选，点击后先打开复核面板，确认前不会直接保存、外发或同步。
- 2026-06-30 检查结果：source-memory 详情页的 `资料蒸馏回执` 新增 `来源快照` 和短 `输入指纹`。两者直接来自已有 distillation metadata，帮助用户确认 compact memo 基于哪一版保存资料 / 备注生成；只显示短 hash，不暴露原文，也不改变蒸馏、召回或外部写入行为。
- 2026-07-01 检查结果：选区右侧 `+ 记住` 入口补上和整页建议入口一致的 `未写入 · 先复核` 前置回执。点击前不会创建 source-memory capsule 或 `web` 检索信号；点击只打开页内复核面板，取消、失败和确认保存仍沿用既有写入回执。
- 2026-07-02 检查结果：撤销资料记忆 API 补上幂等边界。已经 dismissed 的 capsule 再次收到撤销请求时直接返回当前 `dismissed_no_recall` 状态，不追加新的 `dismissed` 事件、不刷新 `updated_at`、不删除额外数据；这样网络重试、双击或旧 toast 重放不会被用户误读成又发生了一次资料变更。
- 2026-07-03 检查结果：Memory Capture API 补上敏感来源 URL 写入门禁。候选评分和保存前会阻断带 `token`、session、passcode、OAuth code、signed URL signature 或 userinfo 的来源 URL，避免 source-memory capsule、关联 `web` 检索信号和 markdown snapshot 保存原始凭据；历史数据或召回结果仍由详情页 / 卡片的来源链接安全隐藏兜底。
- 2026-07-04 检查结果：Memory Capture 创建 API 补上保存失败 `noWriteReceipt`。当创建请求被敏感来源门禁或低信号校验拦截时，错误响应会带 `blocked_no_write` / `invalid_no_write` 回执，列出资料类型、保存方式、范围、来源、未创建 capsule、未写入检索信号，并说明本次不会外发、插入、同步或写入长期记忆。
- 2026-07-06 检查结果：source-memory 详情页新增补备注并刷新蒸馏入口。提交后先显示 `备注刷新提交中`，说明当前仍是上一次资料详情快照，备注、关联 `web` 检索信号和资料蒸馏回执尚未确认刷新；成功后展示后端 `最近操作：备注已更新` 与 refreshed distillation 状态，失败时保留 `备注刷新未确认`，避免把失败请求误读成 source pack 已更新。
- 2026-07-07 检查结果：整页自动入库发起保存请求时新增 `页面资料入库提交中` 轻提示，明确这只是本机请求已提交，尚未确认创建 source-memory capsule 或写入 `web` 检索信号；成功/失败仍由最终回执替换，提交中不会外发、插入输入框、同步其他平台、写 confirmed profile 或创建任务。
- 2026-07-09 检查结果：选中文字保存复核面板新增 `选区快照` 回执。它明确保存对象是面板打开时预览里的那段选中文字，备注只补充保存原因，不会重新抓取页面或改成当前新的选区；如果页面或选区已变化，用户需要取消后重新选择再点 `+ 记住`。这只是保存前的可见边界，不改变候选评分、保存 API、写入权重或后续召回链路。
- 2026-07-11 检查结果：`source_memory` 召回卡片的 `在记忆中查看` 与安全原始来源链接补上按钮级 hover / 读屏边界。详情按钮说明点击只是打开资料详情复核，不会新增或撤销资料记忆、不写画像/任务、不插入或发送；原始来源链接说明只打开新标签核对，不写记忆、不插入输入框、不发送内容、不确认事实。来源链接隐藏时仍只保留资料详情复核入口。
- 2026-07-14 检查结果：整页资料保存补上页面快照和触发依据回执。普通建议点击后的复核面板、自动入库提交中 / 成功 / 失败回执都会说明保存的是当前提取的页面正文快照，触发来自本机复制、停留、滚动和候选评分信号；这只是保存基准和本地行为依据，不确认页面事实，也不自动写画像、任务或外部系统。
- 2026-07-14 二次检查结果：`记住` 按钮的可见结构固定为前置 `+` icon、`记住` 和末尾 Personal AI icon。选区、整页与视觉证据入口在默认、hover、focus 状态都不再增加 `未写入 · 先复核`、候选原因、资料类型、页面快照、触发依据或其他长说明；这些内容统一放到点击后的复核面板及后续回执。历史记录里曾把部分边界放进 hover / focus，不再代表当前按钮视觉契约。

## 验证建议

```bash
npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts src/__tests__/api-coverage.test.ts
npm --prefix memory-service run build
npm run verify:webpage-memory-detection
npm start
node tools/verify-source-memory-capsule-e2e.mjs
```

`npm start` 是 webpack watch，需要等首次 successful compile 后停止。
