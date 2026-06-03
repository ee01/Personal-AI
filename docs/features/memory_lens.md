# Memory Lens

*最后更新: 2026-06-03（含 Scene Memory Autopilot、Expanded Card 反馈失败可见化、站点控制冲突消解、资料记忆反馈闭环、来源链接兜底、Rehearsal 预演提醒反馈、浮窗信息层级重设计、划词记忆检索、弱相关缓存重显、真实召回质量观察）*

## 概述

Memory Lens 是 Personal AI 的注入式关联记忆提示能力。它不新增独立页面，不自动把网页写入长期记忆库，也不生成或插入回复；它在用户当前页面、消息会话、Jira、会议相关 surface 中，用低打扰方式提示“当前场景有哪些真正相关的已有记忆或 Rehearsal 预演提醒”。选中文本的主动检索归属同一功能文档，但产品语义单独命名为 **划词记忆检索（Selection Memory Search）**。

当前线上主链路是：

- `src/contentScriptWebIntelligence.ts`
- `src/composer-guard/siteContextAdapters.ts`
- `src/background.ts`
- `src/services/MemoryServiceClient.ts`
- `memory-service/src/routes/contextRecall.ts`
- `memory-service/src/core/ContextRecallService.ts`

旧的 `webpage_memory_detection` 是 Memory Lens 的网页/右下角轻量态历史名称。后续以本文作为 source of truth。

交互 demo 可查看 [`docs/demo/memory-lens.html`](../demo/memory-lens.html)。

## 大白话运行逻辑

Memory Lens 的逻辑是“当前页面像什么，就去记忆库里找你以前见过的强相关内容”。它只负责提示关联记忆，不写入网页、不生成回复，也不把记忆塞进输入框。

结果主要受这些因素影响：

1. 当前页面/选中文本的具体度：标题、正文、Jira key、会议 ID、群组 ID、具体项目名越明确，召回越准。
2. 场景锚点：同群、同会话、同会议、同 issue 的来源锚点会明显提高相关性。
3. 记忆本身质量：有明确摘要、实体、来源和时间的记忆更容易展示；低信息标题或泛泛会议记录会被压低。
4. 敏感页面和输入状态：密码、支付、账号、隐私输入等场景不会显示。
5. 与 Compose Assist 的互斥：用户正在输入框附近写回复时，Compose Assist 优先，Memory Lens 右下角入口会隐藏。

## 产品边界

Memory Lens 负责：

- 根据当前页面、RingCentral 消息会话、Jira issue、会议上下文或划选文本调用 `/context-recall`。
- 展示少量高相关记忆或 Rehearsal 预演提醒，按"为什么相关 → 它说了什么 / 预演内容是什么 → 我能做什么"三层组织卡片内容。
- 提供正/负反馈 icon 和站点/页面级静默控制；控制类操作默认折叠，不占据卡片主体。
- 在用户选中文本后提供 **划词记忆检索（Selection Memory Search）**：先静默召回，命中强相关才显示轻量 `icon48.png` 入口。

Memory Lens 不负责：

- 不自动保存完整 DOM、网页正文、截图、密码/支付/登录表单或私密输入。
- 不因为用户打开网页就强化长期记忆的 `access_count`。
- 不做“插入回复”“生成可发送文本”“改写草稿”；这些属于 [`compose_assist.md`](./compose_assist.md)。即使命中 Rehearsal，Memory Lens 也只展示“预演提醒”，不生成回复。
- 不在 `v.ringcentral.com/conf/on/*` 上显示通用右下角 bubble；会议页由 Meeting Pilot 接管。
- 不和 RingCentral Glip 输入框旁的 Compose Assist icon 同时占位；当 Compose Assist 已显示时，Memory Lens 右下角 Rest / Hover Peek / Expanded Card 自动隐藏。

## 交互形态

### Rest

页面右下角只显示 44px 圆形 `icon48.png`。只有后端返回 `displayPriority=p1` 或带有可解释 `whyRelevant` 锚点的 `p2` 时才显示；`hidden` 或缺少解释锚点的弱匹配不显示。Rest 态不显示百分比分数，避免让用户误以为这是模型置信度。

RingCentral Glip 下有一个额外互斥规则：如果页面已经生成 `.pai-composer-guard-icon-button`，说明用户当前更可能需要 Compose Assist 的输入框辅助，Memory Lens 不再显示右下角悬浮 icon；Compose Assist 移除后，Lens 可以重新按正常召回规则出现。

### Hover Peek

用户 hover 或键盘 focus 右下角 icon 约 200ms 后出现不可交互的小预览：

- 第一行：`Memory Lens` + `强相关` 或 `可能相关`。
- 第二行：`因为` + 少量 why chips，优先解释来源、匹配类型、证据角色或明确的 `whyMatched`。
- 第三行：记忆标题，单行截断。
- 第四行：优先展示 `uiSummary`，最多两行；没有 `uiSummary` 才用 `snippet`。
- Footer：来源、记录时间和可读来源标题，例如 `RingCentral 消息 · 5/21 · 2026 Hackathon Project`。

Hover Peek 不包含按钮，不进入 tab 顺序，不抢焦点，鼠标离开后消失。`p1` 强相关可以使用 fresh 动效提示新结果；`p2` 只静默显示 Rest icon，用户主动 hover/focus 时才看到 `可能相关` Peek。即使同页 hash 刷新或焦点恢复复用了本地缓存的 `p2` 结果，也不能升级成 fresh 动效。完整操作必须点击 icon 打开 Expanded Card。

### Expanded Card

点击 icon 或按 Enter/Space 打开完整卡片。卡片按 **5 层结构**组织，每层占 1-2 行，整张卡高度 ≤ 240px，任何层在数据缺失时自动折叠：

| 层 | 内容 | 实现要点 |
|---|---|---|
| 1 Header | Memory Lens 品牌 + 关系强度标签 | 右侧：`↗` 跳转记忆原文、`⋯` 折叠破坏性操作 |
| 2 Why-row | `因为：` + 可解释 chips（最多 3 个） | 无 chips 就不渲染，整张卡降为 `weak` 不弹出 |
| 3 Title + Summary | 记忆标题（2 行）+ 摘要（2-3 行） | 优先用 `metadata.summary`；不用 raw snippet 或 `uiSummary` 当标题 |
| 4 Evidence | 行动项 / 回复建议 / 高价值链接 | 取 `metadata.actions[]` 第一条，多条显示"待办 N"可展开 |
| 5 Meta + Foot | 群名可点链接 / 时间 / 反馈 / 翻页 | Thumb up/down icon + `1/N` 翻页器，始终仅占 1 行 |

控制类操作分级：
- **正/负反馈**（有用 / 不相关）：底部仍只保留低饱和 thumb icon。正反馈一键写入；负反馈入口显示为 compact thumb-down，点击后在卡片内打开轻量原因面板，而不是把“不是这个意思”做成大按钮。
- **负反馈原因面板**：面板只在用户点 thumb-down 后出现，包含“只是主题相似 / 群组或项目不对 / 空页面误触发”三类原因，选择后立即写入；备注 textarea 仅在用户主动展开“补充原因”后出现，不要求提交按钮。点击面板外侧、关闭按钮或 Escape 会收起面板，不改变当前提示。
- **反馈失败可见化**：如果有用/不相关反馈没有成功写入 memory-service，卡片不能继续显示成“已学习成功”。正向反馈会解除本次按钮锁定并提示失败；负向反馈仍本地隐藏 30 分钟，但 toast 明确说明只是本页隐藏，并提供“重新显示”恢复刚才的卡片。
- **站点/页面级静默和屏蔽**（今天不提示 / 此页面永久不提示 / 永久不提示此站点 / 允许此站点）：收进 `⋯` popover，避免误触永久屏蔽。
- **跳转记忆原文**（在记忆中查看）：右上角 `↗` link-out icon，对应 `exploreLink`。

卡片支持 Escape 收起、Tab 进入操作区、窄屏不越界，并尊重 `prefers-reduced-motion`。

### 划词记忆检索（Selection Memory Search）

用户在任意非敏感网页选中文本时，Selection Memory Search 会先静默调用 `/context-recall` 做 `selected_text` 匹配。请求中 `primaryText` 只放用户选中的文本；页面标题、附近段落、所在容器文本等只作为 `secondaryTexts` 的 background context。只有候选同时满足 `displayPriority=p1`、存在 `whyRelevant` / concrete matched anchors，并且命中点能回到“选中文本”本身时，才在选区旁显示一个小的 `icon48.png` 入口。

这个模块不新增独立搜索页，也不展示右下角 Rest / Hover Peek 流程。它复用 Lens 的浮窗壳、分页、反馈、跳转记忆原文和 `icon48.png`，但文案、标题、why row、空态和阈值语义都围绕“选中的文本”，不写成“当前页面相关”。

- 被动 Lens：页面稳定后自动召回，命中强相关时显示右下角 Rest icon，hover 出 Peek，点击后展开 Card。
- Selection Memory Search：用户选中文本后先静默召回，命中强相关才显示选区旁小 icon，点击后直接打开 `selectionSearch` variant 浮窗。
- `selectionSearch` variant 的 Header 使用 `划词记忆检索` / `Selection Memory Search`，内容层级为 `选中的内容 → 找到的相关记忆 → 为什么匹配 → 证据 → 操作`。
- Why row 文案使用 `为什么匹配` / `匹配到`，chips 优先展示 `选中文本命中：xxx`、`主题：xxx`、`项目：xxx`；不使用全页面 Lens 的“同页面 / 网页上下文”语义。
- 划词 Card 打开期间，普通页面 passive recall 不应立刻覆盖或清掉当前 `selected_text` 结果，避免用户看到卡片一闪而过。

如果没有匹配到高相关记忆，不显示划词入口，也不弹出“没有找到高相关记忆”这类空结果提示。`p2`、`hidden`、纯语义相似、只有页面背景命中但没有选中文本命中的结果都不展示入口。只有 `Codex`、`AI`、`RingCentral` 这类宽泛主题词命中时，也不能展示入口；需要命中 `续约`、`300万`、票号、项目名、人名、行动项等更具体的选中文本锚点。

每次选区变化都会立即清除上一条划词入口、取消上一条 pending recall，并重新发起 `selected_text` 匹配。Selection Memory Search 不读取上一轮划词缓存，避免用户快速多次选择文本时把旧结果误展示在新选区旁。

划词是用户主动发起的查询入口，不受被动右下角 Lens 的站点白名单、临时静默或站点屏蔽限制；敏感页面、敏感表单和低信息/密钥类选区仍然被拦截。划词结果卡片也不展示“此网站今天不提示 / 永久不提示此站点 / 白名单”这类被动站点控制，避免用户误以为这些控制会禁用主动划词检索。

以下情况不显示划词入口：

- 选区太短或缺少信息量。
- 选区位于 `input`、`textarea`、`contenteditable`。
- 选区位于 Memory Lens 自己的 bubble、peek、card、toast 或划词入口里，避免用户复制/查看来源时二次触发 Lens。
- 选区明显像 API key、access token、client secret、私钥或信用卡号。
- 当前 URL 或页面存在登录、密码、支付、账单、OAuth、token、OTP 等敏感信号。

响应返回前会再次检查当前 URL、敏感表单和已隐藏状态。如果页面在请求期间切换到敏感状态，结果会被丢弃，不展示划词入口或 Expanded Card。

滚动或窗口尺寸变化会清除当前划词入口，避免入口漂在已经移位或不可见的选区旁边。

## 召回质量

`/context-recall` 是 passive recall fast path：

- 只使用 `vector + fts`，不走 LLM。
- 请求 `limit` 默认按 surface 控制，网页轻量态请求 3 条候选，前端按 `displayPriority + score` 选主提示。
- `RecallEngine.recall(..., { reinforceAccess: false })`，被动提示不强化访问计数。
- 请求包含 `sourceContext` 和 `exclude`，用于排除当前 URL、当前 conversation/group/meeting、当前消息 self echo。
- 后端会 over-fetch、过滤、合并同源 cluster、rerank，再返回 `uiSummary`、`reasonType`、`evidenceRole`、`displayPriority`、`exploreLink`。
- 对短句或指代性上下文会先做 `MemoryContextMatchService` 话题锁定：用当前页面/会话 hint、`conversation_context_frames`、近期高频消息、source anchors、角色词和互动信号判断用户可能在问哪个项目或 thread。例如用户只说“那个 BE ready 了吗”或“那个新 design 定了吗”时，服务会先尝试锁定到最近最强的话题；如果候选接近，Context Recall 应降级或保持静默，不强弹确定结论。
- 当 `sourceTypes` 包含 `rehearsal` 时，`/context-recall` 可以返回 `type='rehearsal'`、`evidenceRole='rehearsal_cue'`、`reasonType='prospective_cue'` 的预演提醒。Lens 需要把它显示成“预演提醒”，解释命中的人物、会议、issue、URL 或 topic，而不是当普通事实记忆渲染。
- Rehearsal 卡片使用“为什么此刻相关 / 预演内容 / 我能做什么”的文案，`↗` 跳到 `memory-exploring.html#/rehearsals?rehearsalId=...`，有用/不相关反馈写回对应 Rehearsal activation。
- 普通记忆和 `source_memory` 资料记忆反馈会以 `recall_quality` 进入 memory-service；资料记忆负反馈按 capsule id 记录，后续 source memory 召回会排除该 capsule。Rehearsal 负反馈走 `/rehearsals/:id/feedback` 并记录为 `irrelevant`，后续同目标或低质量同源结果会被排除或降权。

质量门控重点：

- 空 RingCentral Video / `You're the only one here` / invite UI shell 不触发会议关联提示。
- `RingCentral Video`、calendar invite、join link、participants 等壳信息没有项目、票号、动作、风险、决定、依赖等具体锚点时不展示。
- Codex/MCP/skill/setup 等工具上下文必须和候选记忆存在足够主题交集；不能因为日期或泛化 project 词召回 Gary trip 这类旅行记忆。
- 有具体 work signal 的会议、Jira、消息和 AI tool cost/budget/process 记忆仍可保留。

## 隐私与控制

Memory Lens 默认把“用户可以看见记忆”和“可以把记忆外发给其他 AI”分开。Lens 只在当前页面展示已有记忆，不自动复制、不注入输入框、不外发给第三方 AI。需要生成回复或把上下文交给外部 AI 时，应进入 Compose Assist / Context Passport / egress firewall 等后续能力。

站点控制存在扩展本地 storage：

- `pai-context-muted-sites-v1`
- `pai-context-blocked-sites-v1`
- `pai-context-blocked-page-prefixes-v1`
- `pai-context-allowed-sites-v1`
- `pai-context-site-allowlist-mode-v1`

Options 页提供“网页记忆提示控制”管理入口，用于恢复临时静默、永久屏蔽站点、永久屏蔽页面路径和允许站点白名单。

这些控制只约束 **被动网页处理**：右下角 Lens、页面级 `/context-recall` 和旧的网页智能分析都会在临时静默、永久屏蔽、路径屏蔽或白名单未命中时停止；用户主动划词检索仍可使用，但继续受敏感页面、敏感表单和低信息/密钥选区拦截。Options 中的修改会通过 `chrome.storage.onChanged` 实时同步到已打开页面，不需要刷新当前页才生效。

白名单是全局模式，不是单站点的“解除屏蔽”。因此卡片菜单在白名单关闭时显示为“开启白名单并允许此站点”，避免用户误以为只是恢复当前站点。

当用户显式“允许”某个站点时，Options 页和卡片快捷入口会移除覆盖该站点的父域/子域临时静默或永久屏蔽规则，避免出现“已允许 docs.example.com，但 example.com 的父域屏蔽仍让 Lens 不出现”的假成功。反过来，用户显式“永久屏蔽”站点时会清掉覆盖范围内的允许/静默冲突记录，让设置页只保留当前真正生效的控制语义。

## 业内参考与启发

- Chrome extension `activeTab` 的官方设计强调“用户手势后临时访问当前 tab”，比长期全站访问更符合最小权限预期；Memory Lens 的站点控制应尽量让用户能形成“这里会不会被动读取页面”的清晰模型。
- Microsoft Edge 的 Copilot page context policy 把“Copilot 能否访问页面内容”做成可动态刷新的 profile-level 控制；站点控制变更实时作用于已打开页，沿用同样的可预期性。
- ChatGPT Memory 和 Notion Enterprise Search 都把记忆/连接源控制、权限过滤和删除/断开后的不可用语义作为用户信任基础；Memory Lens 的静默/屏蔽不应只隐藏 UI，而应阻止对应被动处理。
- ChatGPT Memory Sources、Notion Enterprise Search citations 和 RAG trust/transparency 研究都指向同一个 UI 原则：用户看到关联记忆时，应能直接追到来源，而不是只看到模型摘要或分数。因此 Expanded Card 即使只拿到 `sourceUrl`，也要展示可点击来源链接。
- Slack AI Search / Notion Enterprise Search 都强调搜索答案来自用户已有权限范围，并可追溯来源；对 Hover Peek 来说，弱相关 `p2` 不能像强提醒一样打断用户，只能在有明确解释锚点时作为低打扰入口出现。
- context-aware recommender explanation 与 notification/peripheral-display 研究都指出，解释会提升信任但也带来理解成本；因此 Hover Peek 只展示 1 条低负担解释，`可能相关` 不使用 fresh 动效。
- SOUPS 2021 对浏览器扩展权限理解的研究指出，用户偏好能建立清晰心智模型的权限描述；Contextual Integrity 相关 AI assistant 论文也强调信息流应符合当前场景预期。因此这里优先做明确文案、实时反馈、冲突消解和被动处理边界，而不是增加复杂配置层级。

## 卡片标题与摘要取值规则

`uiSummary` 字段经常是 raw snippet 的第一句（如 `"@Esone Qiu wrote:"` 或 `"3. 行动指南 (Action Plan)"`），直接用作标题毫无信息量。前端按以下优先级合成标题和摘要：

**标题**（`lens-title`，最多 2 行）
1. 从 `metadata.summary` 提取语义化的一句描述（LLM 总结），例如 `"Sophia 在敏捷教练群确认 Yearly summary 模板"`。
2. 若 `metadata.summary` 为空，截取 `metadata.contextMessages[0].content` 前 60 字符。
3. 最后才用 `uiSummary`，且必须过滤掉纯结构性前缀（如 `"- 01:28:40 ["`, `"@xxx wrote:"`, `"3. "`）。

**摘要**（`lens-summary`，2-3 行）
1. `metadata.summary`（完整 LLM 摘要）。
2. `uiSummary`。
3. `snippet`，最多 120 字符。

**行动项**（`evidence-block`）
- 遍历 `metadata.actions[]`，取第一条非空 `description`，格式：`assignee · description · deadline`。
- 若存在多条，显示"待办 N"，点击展开。
- 若 `metadata.replyAdvice` 非空且没有 actions，用 `replyAdvice` 替代。

**来源链接**（`source-link`）
- Expanded Card 优先把 `sourceUrl` 渲染成可点击来源，即使后端没有重复填充 `links[]`。
- 链接文案优先用 `sourceTitle`，没有时使用来源类型；同 URL 去重，最多展示 3 个来源入口。
- 只接受安全 `http(s)` URL；`javascript:`、`data:` 和其他非网页协议不进入卡片。

## Scene Memory Autopilot

后端 `/context-recall` 现在负责第一道场景过滤，不再把主要相关性判断留给浏览器端临时 `overlapAudit`。流程是：

1. `RecallEngine` 先 over-fetch 候选。
2. `ContextRecallService` 合并同一会议、群组、会话或来源 URL 的重复 chunk。
3. Scene Memory Autopilot 提取当前场景锚点，并根据人物、项目、主题、来源重叠调整分数和 `displayPriority`。
4. 低信息标题、空会议壳、广播/公告无锚点、跨域工具主题、弱语义-only 结果会降成 `hidden`。
5. 响应返回 `autopilot` 摘要，记录 `mode`、展示数、静默数、hidden 数、低信息数、来源排除数、重复合并数、场景锚点和 quiet reasons。

`mode` 的 UI 语义：

- `silent`：不展示 Lens；用于没有强场景锚点、只有弱语义相似或当前场景本身低信息的情况。
- `chip`：低打扰入口，用户主动 hover/focus 后可看到 `可能相关`。
- `card`：强相关 Lens 卡片；强展示必须有 `whyRelevant`，例如同群、同项目、同工单、同主题或同人物。
- `context_pack`：给 Compose Assist / Meeting Pilot / Today Pilot 使用的上下文证据，不按 Lens 右下角卡片展示。

前端仍保留 `isDisplayableContextRecallMatch` 防御过滤：如果后端或旧服务返回 `hidden`、低信息壳标题、没有摘要的空候选或缺少解释锚点的弱匹配，浏览器端不会展示。这个过滤现在是最后防线，不是主要排序策略。

## 真实召回质量观察（2026-05-21）

对三组真实 RingCentral 对话（敏捷教练-RC China / Nova CA - Brandy / Colin,Michael）跑了 `POST /api/v1/context-recall`，主要发现：

- **p1 虚高**：15 条候选全部 `displayPriority=p1`，但约 9 条与当前页面无人物/主题/群组重叠，核心问题是后端把纯语义相似度当做展示门槛。
- **uiSummary 信息量不足**：大量候选的 `uiSummary` 是 raw snippet 截断（`"@Esone Qiu wrote:"`, `"📅 时间：2026 年 4 月 27 日"`），而 `metadata.summary` 有完整 LLM 摘要，但前端未使用。
- **跨群噪声模式**：HR Open Day 通告、Everyone AI Campaign 活动邀请这类广播消息因为语义宽泛，在任何话题语境下都能打高分。需要在 `overlapAudit` 里额外排除"广播/公告类消息命中但无锚点重叠"的情形。
- **真正有价值的记忆被压后**：Nova 群当前场景最相关的 `Nova Product & Engineering Leads` 周会要点（Wayne 任务、SMS 时间线）原始 score 仅 1.00 排第 5，被 HR 通告和 meeting-pilot 任务挤到末尾；客户端重排后应置顶。
- **无强相关时的正确行为**：Colin/Michael 对话的核心主题（Cursor 2.5 / Codex plan / 组织禁用 / RingClaw 合规）在记忆库里暂无 entities 覆盖，正确行为是 Rest icon 不显红点，只在用户主动点击时展示 `可能相关` 的弱命中条目，并清楚标注"非同群"。


## 验证

核心验证入口：

- `npm run verify:webpage-memory-detection`
- `npm run verify:webpage-memory-detection:e2e`
- `npm --prefix memory-service test -- --run src/__tests__/api-context-recall.test.ts`
- `npm start` 到首次 successful compile 后停止

重点回归场景：

- `displayPriority=hidden` 不展示。
- `displayPriority=p2` 且带有 `whyRelevant` 时可显示 Rest icon 和 Hover Peek，但不使用 fresh/强相关动效；缺少解释锚点的 `p2` 不展示。
- 同页 hash 刷新、焦点恢复或缓存重显时，缓存里的 `p2` 结果仍保持 `可能相关` 低打扰状态，不重新触发召回或显示 fresh 动效。
- 右下角 icon hover 出 Hover Peek，mouseleave 后消失，click 后打开 Expanded Card。
- Hover Peek 和 Expanded Card 都不展示 `100%/87%` 这类百分比分数。
- Expanded Card 标题使用 `metadata.summary` 语义描述，不使用 `"@xxx wrote:"` / `"3. 行动指南"` 这类 raw snippet。
- 当返回结果含 `metadata.actions[]` 或 `replyAdvice` 时，卡片证据区优先展示可执行行动/建议，不退回低信息 raw snippet。
- 当召回结果只有 `sourceUrl`、没有 `links[]` 时，Expanded Card 仍展示安全来源链接，并按 URL 去重。
- `source_memory` Expanded Card 的有用/不相关反馈应真实写入 `/feedback`，target id 规范为 source memory capsule id，而不是只在前端显示 toast。
- 如果 Expanded Card 的反馈写入失败，应给出失败 toast；不相关反馈失败时只能说明“本页隐藏”，并允许用户重新显示刚才的卡片。
- 划词后先静默发起 `selected_text` 召回；只有命中高相关候选才显示轻量 icon。
- `selected_text` 没有高相关候选时不显示划词 icon，也不弹空结果 toast。
- 点击划词 icon 后直接打开 Expanded Card，并保持当前 `selected_text` 结果，不被随后完成的页面 passive recall 立刻替换或清除。
- 划词结果卡片的更多菜单只处理本次主动查询结果，不展示被动 Lens 的站点静默、站点屏蔽、页面屏蔽或白名单控制。
- 选中 Lens 自身卡片文本、明显密钥/卡号文本、或响应前切到敏感表单时不展示划词结果。
- 允许 `docs.example.com` 会移除覆盖它的 `example.com` 静默/屏蔽记录；随后白名单模式下打开该子域应能触发被动召回。
- 永久屏蔽一个站点会清掉覆盖范围内的允许/静默冲突记录，Options 页不应同时显示互相抵消的有效规则。
- Hackathon/Codex/MCP/setup 上下文不召回 Gary travel itinerary。
- 空 RingCentral meeting shell 不召回 Colin/AVA 或其他 glip 记忆。
- 有具体工单、动作、决策、风险的 RingCentral Video/meeting 记忆仍可召回。
- 命中 Rehearsal 时展示“预演提醒”与 `prospective_cue` why chips，不插入回复、不自动生成文本。
- HR Open Day / Everyone AI Campaign 广播通告等跨群无锚点记忆，在 `overlapAudit` 后降为 `hidden`，不进入自动弹出候选。
- 跨群无重叠的候选即使 score=1.00 也不展示 Rest icon 红点；仅在用户主动点击 icon 后以 `可能相关` 出现。
- 当所有候选 `overlapAudit` 均为 `hidden` 时，Rest icon 不显示红点，Hover Peek 不弹，Expanded Card 主动打开才展示"暂无强相关"空态。
- 反馈 thumb up/down 后，`detail` JSON 携带 `scene_anchor_signature`、host、target/source 类型、来源标题/URL，以及可用的 `match.metadata.groupId + sender`，用于后续同场景降权。thumb-down 原因面板还会写入 `interaction=memory_relevance_trainer`、`feedback_reason`、可选 `feedback_note` 和 `auto_applied=true`，让后端后续能区分“只是宽泛主题相似”“群组/项目错配”“空页面壳误触发”等训练信号。
- Options 里新增/移除站点静默、永久屏蔽、路径屏蔽或白名单规则后，已打开页面应立即停止或恢复被动 Lens；被控制站点也不应继续触发旧的网页智能分析。
