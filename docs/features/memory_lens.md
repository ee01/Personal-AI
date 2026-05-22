# Memory Lens

*最后更新: 2026-05-22（含浮窗信息层级重设计、划词记忆检索、真实召回质量观察）*

## 概述

Memory Lens 是 Personal AI 的注入式关联记忆提示能力。它不新增独立页面，不自动把网页写入长期记忆库，也不生成或插入回复；它在用户当前页面、消息会话、Jira、会议相关 surface 中，用低打扰方式提示“当前场景有哪些真正相关的已有记忆”。选中文本的主动检索归属同一功能文档，但产品语义单独命名为 **划词记忆检索（Selection Memory Search）**。

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
- 展示少量高相关记忆，按"为什么相关 → 它说了什么 → 我能做什么"三层组织卡片内容。
- 提供正/负反馈 icon 和站点/页面级静默控制；控制类操作默认折叠，不占据卡片主体。
- 在用户选中文本后提供 **划词记忆检索（Selection Memory Search）**：先静默召回，命中强相关才显示轻量 `icon48.png` 入口。

Memory Lens 不负责：

- 不自动保存完整 DOM、网页正文、截图、密码/支付/登录表单或私密输入。
- 不因为用户打开网页就强化长期记忆的 `access_count`。
- 不做“插入回复”“生成可发送文本”“改写草稿”；这些属于 [`compose_assist.md`](./compose_assist.md)。
- 不在 `v.ringcentral.com/conf/on/*` 上显示通用右下角 bubble；会议页由 Meeting Pilot 接管。
- 不和 RingCentral Glip 输入框旁的 Compose Assist icon 同时占位；当 Compose Assist 已显示时，Memory Lens 右下角 Rest / Hover Peek / Expanded Card 自动隐藏。

## 交互形态

### Rest

页面右下角只显示 44px 圆形 `icon48.png`。只有后端返回 `displayPriority=p1` 或可解释的 `p2` 时才显示；`hidden` 不显示。Rest 态不显示百分比分数，避免让用户误以为这是模型置信度。

RingCentral Glip 下有一个额外互斥规则：如果页面已经生成 `.pai-composer-guard-icon-button`，说明用户当前更可能需要 Compose Assist 的输入框辅助，Memory Lens 不再显示右下角悬浮 icon；Compose Assist 移除后，Lens 可以重新按正常召回规则出现。

### Hover Peek

用户 hover 或键盘 focus 右下角 icon 约 200ms 后出现不可交互的小预览：

- 第一行：`Memory Lens` + `强相关` 或 `可能相关`。
- 第二行：`因为` + 少量 why chips，优先解释来源、匹配类型、证据角色或明确的 `whyMatched`。
- 第三行：记忆标题，单行截断。
- 第四行：优先展示 `uiSummary`，最多两行；没有 `uiSummary` 才用 `snippet`。
- Footer：来源、记录时间和可读来源标题，例如 `RingCentral 消息 · 5/21 · 2026 Hackathon Project`。

Hover Peek 不包含按钮，不进入 tab 顺序，不抢焦点，鼠标离开后消失。完整操作必须点击 icon 打开 Expanded Card。

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
- **正/负反馈**（有用 / 不相关）：底部低饱和 thumb icon，直接可点。
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

划词是用户主动发起的查询入口，不受被动右下角 Lens 的站点白名单、临时静默或站点屏蔽限制；敏感页面、敏感表单和低信息/密钥类选区仍然被拦截。

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
- 负反馈会以 `recall_quality` 进入 memory-service，后续同目标或低质量同源结果会被排除或降权。

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

## 召回结果客户端二次过滤

后端当前对所有语义分数较高的候选统一返回 `displayPriority=p1`，导致跨群、无关主题的噪声记忆也会自动展示（实测 3 组对话各 5 条候选全部 p1，其中约 60% 与当前页面 0 重叠）。在后端 `relevanceTier` 字段落地之前，前端需要在 `selectPrimaryContextRecallMatch()` 后增加 `overlapAudit(scene, match)` 客户端审计：

```ts
function overlapAudit(scene: SceneSignature, match: ContextRecallMatch): 'strong' | 'possible' | 'hidden' {
  const matchPeople  = match.metadata?.entities?.people?.map(p => p.name) ?? [];
  const matchTopics  = match.metadata?.entities?.topics?.map(t => t.name) ?? [];
  const matchGroupId = String(match.metadata?.groupId ?? '');

  const sameGroup = matchGroupId && matchGroupId === scene.groupId;
  const personHit = scene.visiblePeople.some(p => matchPeople.some(mp => mp.includes(p) || p.includes(mp)));
  const topicHit  = scene.visibleTopics.some(t => matchTopics.some(mt =>
    mt.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(mt.toLowerCase())
  ));

  if (sameGroup && (personHit || topicHit)) return 'strong';
  if (personHit && topicHit)               return 'possible';
  if (sameGroup || personHit || topicHit)  return 'possible';
  return 'hidden';                          // 无任何重叠，不展示
}
```

- `strong`：自动展示 Hover Peek + Rest icon 红点。
- `possible`：右下角 icon 不显红点；只有用户主动点击 icon 后才以 `可能相关` 标签出现。
- `hidden`：前端过滤，不进入浮窗候选列表。

Why-row chips 直接从 overlap 结果里取：命中同群则加 `同群`，命中人名则加对应人名，命中主题则加主题词（最多 3 个）。

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
- 右下角 icon hover 出 Hover Peek，mouseleave 后消失，click 后打开 Expanded Card。
- Hover Peek 和 Expanded Card 都不展示 `100%/87%` 这类百分比分数。
- Expanded Card 标题使用 `metadata.summary` 语义描述，不使用 `"@xxx wrote:"` / `"3. 行动指南"` 这类 raw snippet。
- 划词后先静默发起 `selected_text` 召回；只有命中高相关候选才显示轻量 icon。
- `selected_text` 没有高相关候选时不显示划词 icon，也不弹空结果 toast。
- 点击划词 icon 后直接打开 Expanded Card，并保持当前 `selected_text` 结果，不被随后完成的页面 passive recall 立刻替换或清除。
- 选中 Lens 自身卡片文本、明显密钥/卡号文本、或响应前切到敏感表单时不展示划词结果。
- Hackathon/Codex/MCP/setup 上下文不召回 Gary travel itinerary。
- 空 RingCentral meeting shell 不召回 Colin/AVA 或其他 glip 记忆。
- 有具体工单、动作、决策、风险的 RingCentral Video/meeting 记忆仍可召回。
- HR Open Day / Everyone AI Campaign 广播通告等跨群无锚点记忆，在 `overlapAudit` 后降为 `hidden`，不进入自动弹出候选。
- 跨群无重叠的候选即使 score=1.00 也不展示 Rest icon 红点；仅在用户主动点击 icon 后以 `可能相关` 出现。
- 当所有候选 `overlapAudit` 均为 `hidden` 时，Rest icon 不显示红点，Hover Peek 不弹，Expanded Card 主动打开才展示"暂无强相关"空态。
- 反馈 thumb down 后，`recall_quality: negative` 事件携带 `scene_anchor_signature` 和 `match.metadata.groupId + sender`，用于后续同场景降权。
