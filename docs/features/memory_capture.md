# Memory Capture / 记忆捕捉

_最后更新: 2026-06-15_

## 是什么

Memory Capture 是 Personal AI 的低打扰资料入库层。它负责把用户真正关注的网页、选中文本、用户对外输入、会议资料、AI 工具资料等捕捉成可追溯的长期记忆。

用户看到的简单表达是：

> 重要内容自动记住；不确定但可能重要的内容给一个很小的 `+`；用户主动选中内容时可以一键记住。

当前 P0 已落地的是 **选中文字保存**、**整页资料保存**、**Jira owner comment 自动捕捉** 和 **source memory 召回**：

- 用户在非敏感网页选中文字。
- 内容脚本先用现有 Selection Memory Search 查关联记忆，同时调用 Memory Capture 候选评分。Memory Capture 有独立的选区信息量判断，不再被 Memory Lens 的只读展示门槛拦掉。
- 如果选区有足够信息量且不含 secret/token/password 等风险，页面最右侧、与选区同高度吸附显示一个半露出的 `+`；多行选区以最后一行的高度为准。hover / focus 后展开为 `+ 记住`，右侧带 Personal AI logo。这个记忆入口和整页 / 视觉入库共用同一套右侧半露出样式，只是文案统一为“记住”。
- 划词关联记忆的 Personal AI icon 仍跟随选区旁，只负责打开 Memory Lens 结果；记住入口是独立挂在页面右侧边缘的元素，与它分离，避免两个能力挤进同一个 button bar 互相抢注意力。
- 点击 `+ 记住` 后打开页内复核面板，显示选中文本预览、保存范围回执、候选原因和可选备注；保存范围会说明这是选区资料、来源 host、写入的记忆范围，以及会落到资料记忆和 `web` 检索信号。确认后保存为 `source_memory_capsule`。如果在复核面板按取消，不会保存，入口会保留。保存成功、发现重复保存或重复保存时刷新了备注，toast 都提供 `查看`，直接进入该 capsule 的详情页。
- 页面有复制、深度滚动或足够停留等用户意图信号时，页面接近右上角显示同样的右侧半露出 `+ 记住`。点击后打开页内复核面板，展示页面标题、正文预览、候选原因、保存范围回执和可选备注；保存范围会说明这是当前页面资料、来源 host、写入的记忆范围，以及会落到资料记忆和 `web` 检索信号。确认后保存整页正文为 `webpage` capsule，取消则不保存且入口保留。如果同一资料已经入库但用户在本次复核里补了备注，系统会更新原 capsule 的 summary、metadata 和关联 `web` 检索信号，而不是丢弃这条备注。
- 页面中识别到图表、表格、canvas、SVG、figure 或高信息量 DOM 区域时，不新增独立“视觉记忆”入口，仍复用当前网页右侧 `+ 记住` 入口（视觉证据用轻微不同的样式区分）；hover / focus 时会标明是视觉证据。点击后先保存为 `sourceKind='visual_memory'` 的 source-memory capsule，再在成功提示里提供 `预览`；用户打开预览后可以在同一右侧窗体查看已入库信息并补备注。表格会在 `metadata.visualMemory.table` 中保存 headers、rows、rowCount、columnCount 和 truncated 状态；SVG 会在安全净化后保存 `metadata.visualMemory.svg.markup` 作为图形快照；source-memory 详情页负责按结构化表格或 SVG 预览展示。
- 当整页候选达到更高置信度时会自动入库：例如复制页面内容且阅读到较深位置、浏览时间较久且阅读较深、或浏览时间非常久。自动入库不弹确认框，只在右上角显示 5 秒轻提示；默认只显示 Personal AI logo 和 `已存入记忆`，hover / focus 后展开显示原因、保存范围和 `撤销` 按钮。用户 hover / focus 在提示上时暂停消失计时，移开或失焦后重新开始 5 秒倒计时。
- 选区、整页或视觉证据的手动保存如果失败，包括保存前页面 / 选区上下文已经变化，面板 / toast 会明确说本次没有创建资料记忆，也没有写入 `web` 或视觉证据检索信号；原入口仍保留，用户可以重新选择、直接重试或稍后再保存。
- 已有 Jira owner-authored learning 信号会继续写入原 ingest，同时自动生成 `jira_comment` capsule，作为用户对外输入的资料记忆。
- 后端同时写入 `messages_raw.source_type='web'` 和 `chunks.source_type='web'`，让 Coverage Map、搜索和后续召回能看见这条网页记忆信号。
- `/context-recall` 支持 `sourceTypes: ['source_memory']`，返回专门的 `source_memory` 资料记忆卡。卡片会先说明这是用户已保存的资料证据，并展示资料类型（整页、选区、视觉证据等）和保存方式（主动、建议、自动），再给出命中的关键词或来源标题；点击 `在记忆中查看` 进入 Memory Exploring 的 capsule 详情页查看保存原因、证据锚点、草稿要点、未来触发线索和关联 web 记忆信号。卡片和资料详情页只渲染安全的 `http(s)` 来源链接；如果保存来源带账号密码、OAuth code、token、session 等敏感 URL 参数，原始来源会显示为已隐藏，不提供 `打开来源`，但仍保留资料详情复核入口。资料详情页会展示召回边界：saved capsule 有真实 linked `web` 记忆信号时才显示 `查看关联记忆`；dismissed capsule 会说明关联 `web` 信号已移除，后续 Ask、Memory Lens 和时间轴召回不再使用这条资料。

## 产品边界

Memory Capture 负责：

- 判断网页/选区/外部输入是否值得入库。
- 执行自动入库、建议入库和用户主动入库。
- 保存 source capsule、source anchors、takeaways、future triggers 和行为事件。
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
- 整页网页：不一定必须点 `+`。普通强信号只显示右侧半露出 `+ 记住`；达到自动阈值时直接保存，并在右上角显示 compact 轻提示。默认态只显示 logo + `已存入记忆`；hover / focus 后展开“因为 xxx，本网页信息已自动存入记忆库”、保存范围和 `撤销`，撤销会把 capsule 标记为 dismissed。提示在 hover / focus 期间不会消失，移开后再等 5 秒消失。
- Jira owner comment：已有 owner-authored learning 信号会自动写入 `jira_comment` capsule，不需要点 `+`。
- 后端评分已经能返回 `auto_save`、`suggest`、`ignore`、`blocked`。P0 前端对选区仍采用“强信号才提示、用户确认才保存”；整页网页只有达到更高置信度时才自动保存，避免把普通浏览史或误选文本静默入库。

整页自动入库的前端阈值：

- 页面正文至少约 `260` 词。短页面、目录页、搜索结果页即使被后端评为高分候选，也不会整页自动入库。
- `copiedText = true` 且 `dwellMs >= 90s` 且 `scrollDepth >= 0.85` 且候选分 `score >= 0.78`：复制过页面内容、停留较久并读到很深位置。
- `dwellMs >= 240s` 且 `scrollDepth >= 0.90` 且候选分 `score >= 0.78`：浏览时间很久且阅读到页面深处。
- `dwellMs >= 480s` 且 `scrollDepth >= 0.75` 且候选分 `score >= 0.78`：在当前页面停留非常久。

后端 `auto_save` 只表示候选评分高，不会单独触发整页自动入库；前端仍必须满足上面的正文长度、停留时间和阅读深度门槛。这样保留“无打扰保存”的能力，但把普通浏览、快速复制、浅滚动这类信号降为右侧 `+ 记住` 建议或完全安静。

候选评分 API 会返回 `policyReceipt`：把 `suggest` / `auto_save` / `ignore` / `blocked` 统一翻译成可展示的状态、证据和下一步。前端展示 `+ 记住` 或复核面板时优先使用这个回执；被忽略或阻断时也能记录清楚原因，不把“没有出现入口”误读成系统失效。

存储层区分主动和自动：

- `source_memory_capsules.capture_mode` 保存 `manual` / `auto` / `suggested`，并有 `idx_source_memory_capsules_capture_mode_saved` 索引，后续可以直接统计自动入库占比。
- `source_memory_events.metadata_json.captureMode` 记录每次 save / resave / duplicate / dismiss 事件的来源模式。
- 主动入库的 `messages_raw.importance` / `memory_metadata.importance` 高于自动入库。当前权重：`manual = 0.72`，`suggested = 0.64`，`auto = 0.58`；chunk 权重在 message 权重基础上略低。
- 重复入库按 source fingerprint 去重；如果本次重复入库带了非空备注，会沿用原 capsule / message id，同时刷新 summary、`metadata.userNote`、`messages_raw` 和 chunks，让后续召回能读到最新“为什么保存”。如果没有新备注，只记录 `duplicate_save` 事件并提示已有资料。
- 如果用户撤销自动入库后又手动保存同一资料，系统沿用原 capsule，但会刷新 summary、content preview、capture mode、metadata 和对应 `web` 记忆信号，避免详情页继续展示撤销前的旧备注。
- 视觉证据当前走同一套 `source_memory_capsules` / `messages_raw` / `chunks` 写入链路，不单独创建 `visual_memory_*` 表或独立 API。视觉识别结果保存在 capsule metadata；source-memory 详情页读取 metadata 展示视觉区域信息、结构化表格预览和已保存的 SVG 图形快照。这样保存、备注、撤销、重复保存、搜索和 source 跳转都沿用现有 Memory Capture 语义。

候选评分会参考：

- 来源 URL、标题、来源类型。
- 文本长度和信息量。
- 是否选中、复制、停留、滚动、重复访问。
- 是否是用户对外输入。
- 是否有实体线索。
- 是否命中敏感 URL 或 secret/token/password。

## 数据模型

| 表                        | 用途                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `source_memory_capsules`  | 资料记忆主对象，保存来源、标题、fingerprint、状态、摘要、capture reason |
| `source_memory_anchors`   | 原文证据锚点，当前 P0 是 text selection/page excerpt                    |
| `source_memory_takeaways` | 从证据中提取的初始 takeaways，默认 draft，不等于 confirmed fact         |
| `source_memory_triggers`  | 未来触发线索，例如 host、实体、标题搜索                                 |
| `source_memory_links`     | 未来用于连接 project/message/meeting/skill 等对象                       |
| `source_memory_events`    | 保存、重复保存、dismiss 等行为事件，可供无感校准层消费                  |
| `messages_raw` / `chunks` | 兼容现有 Memory Service 的 `web` 来源检索和覆盖信号                     |

DB 是运行时真源；Markdown 只作为 daily/source snapshot。

## API

| API                                               | 用途                                              |
| ------------------------------------------------- | ------------------------------------------------- |
| `POST /api/v1/source-memory/candidates/score`     | 通用候选评分，返回建议动作和 `policyReceipt`      |
| `POST /api/v1/source-memory/candidates/selection` | 选中文本候选评分，默认带 selectedText 信号和回执  |
| `POST /api/v1/source-memory/capsules`             | 保存 source memory capsule，并写入 `web` 记忆信号 |
| `GET /api/v1/source-memory/capsules/:id`          | 读取资料记忆详情                                  |
| `POST /api/v1/source-memory/capsules/:id/note`    | 保存后补充或更新备注，并刷新关联 `web` 记忆信号   |
| `POST /api/v1/source-memory/capsules/:id/dismiss` | 标记资料记忆为 dismissed                          |

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
4. 深度蒸馏：后台异步补全实体链接、open questions、skill candidate、future triggers。
5. Coverage Map 增强：展示 capsule 数、自动/主动入库比例、最近保存来源和阻断原因。

## 参考与产品判断

- [Notion Web Clipper](https://www.notion.com/en-US/web-clipper)、[Readwise Reader extension](https://docs.readwise.io/reader/docs/saving-content)、[Obsidian Web Clipper](https://obsidian.md/help/web-clipper)、[Raindrop Highlights](https://help.raindrop.io/highlights/)、[Zotero Connector](https://www.zotero.org/support/adding_items_to_zotero) 和 [Hypothesis](https://web.hypothes.is/) 都把网页保存、划词高亮/注释做成明确的用户动作，并保留来源、快照、备注或私有/群组语境；Memory Capture 的 `+` 应保持同样的“确认才写入”语义，自动入库只用于强意图、低风险场景。
- PIM 研究（[Keeping Found Things Found on the Web](https://www.microsoft.com/en-us/research/publication/keeping-found-things-found-web/)、[Personal Information Management](https://arxiv.org/abs/2107.03291)）强调用户保存网页资料时通常需要保留“当时为什么重要”的上下文。备注是这个上下文的一部分，所以取消复核面板应被视为取消保存，而不是静默保存空备注。
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

## 验证建议

```bash
npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts src/__tests__/api-coverage.test.ts
npm --prefix memory-service run build
npm run verify:webpage-memory-detection
npm start
node tools/verify-source-memory-capsule-e2e.mjs
```

`npm start` 是 webpack watch，需要等首次 successful compile 后停止。
