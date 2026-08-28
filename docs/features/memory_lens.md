# Memory Lens

*最后更新: 2026-08-29（含 Options `CONTEXT_LENS_ENABLED` 用户总开关、两层被动召回门禁、Lens 展示地图、关键简报自动生成、Options 语言同步链路、简报 > 变化脉络首屏优先级、Scene Memory Autopilot、Rest / Hover Peek / Expanded Card、Rehearsal、划词记忆检索、变化脉络、Compose Assist 互斥与 AR 数据边界）*

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

基础交互 demo 可查看 [`docs/demo/memory-lens.html`](../demo/memory-lens.html)；关键记忆简报的同入口替换、证据下钻和降级状态可查看 [`docs/demo/keystone-memory-briefs.html`](../demo/keystone-memory-briefs.html)。

## 大白话运行逻辑

Memory Lens 的逻辑是“当前页面像什么，就去记忆库里找你以前见过的强相关内容”。它只负责提示关联记忆，不写入网页、不生成回复，也不把记忆塞进输入框。

结果主要受这些因素影响：

1. 当前页面/选中文本的具体度：标题、正文、Jira key、会议 ID、群组 ID、具体项目名越明确，召回越准。
2. 场景锚点：同群、同会话、同会议、同 issue 的来源锚点会明显提高相关性。
3. 记忆本身质量：有明确摘要、实体、来源和时间的记忆更容易展示；低信息标题或泛泛会议记录会被压低。
4. 敏感页面和输入状态：密码、支付、账号、隐私输入等场景不会显示。
5. 用户总开关：Options「记忆提示控制」里的 `CONTEXT_LENS_ENABLED` 默认打开。关掉后，网页 / 消息会话 / 会议 / popup 不再发起被动 `/context-recall`，已打开页上的被动气泡会立刻清掉；写作护航和会前准备不受影响。主动划词检索仍可用。
6. 与 Compose Assist 的互斥：用户正在输入框附近写回复时，Compose Assist 优先，Memory Lens 右下角入口会隐藏。
7. 精准 cue：少数结构足够明确的场景会把相关记忆编译成一句可行动只读提示，例如用户在 RingCentral 群聊或 Jira comment 中讨论 MTR-148115 估算时提示“上次 original estimate 口径是人天”。这仍然只是展示旧记忆，不插入、不提交；如果同一句 cue 在同类场景被重复标成不相关，Outcome Loop 会让后续同类场景静默。
8. 关键简报：如果同一工作对象已有至少两条独立来源、非纯派生权威和可回溯的 claim，`/context-recall` 可以在不改变原始召回排序的前提下附带一份 `keystoneBrief`。符合 `ready` 的简报会替换 Expanded Card 首屏的零散记忆；原始记忆不会消失，而是移到“来源与原始记忆”里供复核。
9. [记忆主张归属](./memory_claim_attribution.md)：context recall 在展示前按句内 claim 移除假设/未知归属等 block 证据，并把 AI 建议或他人转述降为背景。普通 single-self 结果完全无新增 UI；只有后果变化时，Expanded Card metadata 才显示一个归属 chip，Rest / Hover Peek 保持不变。

## 产品边界

Memory Lens 负责：

- 根据当前页面、RingCentral 消息会话、Jira issue、会议上下文或划选文本调用 `/context-recall`。
- 展示少量高相关记忆或 Rehearsal 预演提醒，按"为什么相关 → 可提取信息 / 预演内容 → 建议动作 / 我能做什么"三层组织卡片内容。
- 当当前场景命中可信的多来源关键简报时，在同一枚 Rest icon、同一个 Hover Peek 和 Expanded Card 壳内优先展示简报，并保留来源图和原始关联记忆下钻。
- 提供正/负反馈 icon 和站点/页面级静默控制；控制类操作默认折叠，不占据卡片主体。
- mixed claim 的归属纠错复用 Expanded Card 既有反馈详情；它只写 Personal AI 派生 attribution revision，不改来源原文、不写回网页或外部系统，也不承担 Memory Capture 的 `+ 入库`。
- 在用户选中文本后提供 **划词记忆检索（Selection Memory Search）**：先静默召回，命中强相关才在选区动作条里显示 `icon48.png` 查记忆入口。

Memory Lens 不负责：

- 不自动保存完整 DOM、网页正文、截图、密码/支付/登录表单或私密输入。
- 不因为用户打开网页就强化长期记忆的 `access_count`。
- 不做“插入回复”“生成可发送文本”“改写草稿”；这些属于 [`assist.md`](./assist.md)。即使命中 Rehearsal 或 Cue Compiler，Memory Lens 也只展示只读提醒，不生成回复。
- 不为关键简报新增第二枚悬浮 icon、并列面板或新的日常维护页；简报只是现有被动 Lens 的高信号展示对象。
- 不做网页 DOM 替换、视觉 overlay 或用户定义的数据回填；这些属于 [Personal AI AR Data](./ar_data_overlay.md)。未来 AR 可以复用 Lens 的场景语义和相似文本匹配能力，但不能混淆 Lens 的只读提示边界。
- 不在 `v.ringcentral.com/conf/on/*` 上显示通用右下角 bubble；会议页由 Meeting Pilot 接管。
- 不和输入框旁的 Compose Assist icon 同时占位；当任意页面的 Compose Assist 已显示可插入建议时，Memory Lens 右下角 Rest / Hover Peek / Expanded Card 自动隐藏。主动划词检索不受这个被动互斥影响。

## 展示地图与首屏仲裁

Memory Lens 只有一枚悬浮 icon 和一个 Expanded Card。后端可以在同轮返回普通 `matches`、`keystoneBrief`、`changeProjections`、Context Cue 或 Rehearsal，但前端不会把它们并列堆在首屏，而是按以下规则选择一个主视图：

| 优先级 | 触发条件 | Lens 首屏 | 其他内容去向 |
|---|---|---|---|
| 专用交互 | 用户主动划词，或首条结果是 Rehearsal | Selection / Rehearsal 专用视图 | 不让简报或页面级变化链接管 |
| 1 关键简报 | `keystoneBrief` 为 `ready` 或 `partial` | **简报独占首屏**；`partial` 先显示冲突边界 | 来源图、普通记忆和变化脉络进入证据/原始记忆下钻 |
| 2 变化脉络 | 没有可展示简报，且 `changeProjections` 非空 | 变化脉络占首个候选槽位 | 普通记忆继续分页 |
| 3 编译提示 / 普通记忆 | 没有前两类高阶结果 | Context Cue 或最高相关普通记忆 | 其余候选继续分页 |
| 静默 | 没有通过展示门槛的内容 | 不显示 Lens | 不用空卡或内部候选打扰用户 |

`stale` 简报不占用结论首屏：Peek 说明存在旧简报，Expanded Card 回落变化脉络或普通记忆，并只把旧简报作为时效提醒。`candidate`、`blocked`、`hidden` 或缺失简报对用户不可见。这个仲裁顺序是 UI 契约：**简报 > 变化脉络 > 普通关联记忆**，不是后端返回数组的偶然顺序。

## 交互形态

### Rest

页面右下角只显示 44px 圆形 `icon48.png`。只有后端返回 `displayPriority=p1` 或带有可解释 `whyRelevant` 锚点的 `p2` 时才显示；`hidden` 或缺少解释锚点的弱匹配不显示。Rest 态不显示百分比分数，避免让用户误以为这是模型置信度。

Rest icon 的 `title` 和可访问名称会带一条 compact 原因回执：`Memory Lens / 强相关或可能相关 / 第一个 why chip / 顶部记忆标题 / 只读提示，不写入/插入/发送`。这让用户在还没打开 Hover Peek 或 Expanded Card 前，也能知道右下角气泡为什么出现、它不是写入或外发动作，同时继续避免展示百分比分数。

Rest icon 可以被拖拽到当前视口内的其他位置，用于避开网页自身的右下角按钮、客服入口或提交按钮。拖拽只影响当前页面上的这一枚 icon；位置不会写入 storage，也不会跨刷新、跨页面或跨会话记忆。拖动后 Hover Peek 和 Expanded Card 会跟随新的临时锚点展开，刷新页面后恢复默认右下角位置。

全页面互斥规则：如果页面已经生成 `.pai-composer-guard-icon-button`，说明 Personal AI 已经有可写入当前输入框的建议，Memory Lens 不再显示右下角悬浮 icon；Compose Assist 移除后，Lens 可以重新按正常召回规则出现。只有“命中记忆但无可插入草稿”的结果不会生成 Compose Assist icon，应由 Memory Lens 展示只读关联记忆。

### Hover Peek

用户 hover 或键盘 focus 右下角 icon 约 200ms 后出现不可交互的小预览：

- 第一行：`Memory Lens` + `强相关` 或 `可能相关`。
- 第二行：`因为` + 少量 why chips，优先解释来源、匹配类型、证据角色或明确的 `whyMatched`。
- 第三行：记忆标题，单行截断。
- 第四行：优先展示 `uiSummary`，最多两行；没有 `uiSummary` 才用 `snippet`。
- Footer：来源、记忆范围、记录时间、新鲜度复核提示和可读来源标题，例如 `RingCentral 消息 · 工作记忆 · 5/21 · 2026 Hackathon Project`；缺少标题时保留来源和时间，资料记忆可追加保存方式/资料类型，90 天以上的旧证据会在 Peek 内提示 `行动前复核`。前端统一通过 `buildContextRecallPeekFooterItems()` 生成这行，避免 Hover Peek、why chips 和 Expanded Card 元信息各自漂移。
- 可见切片：如果本轮有多条可展示候选，Hover Peek 会在 footer 下方显示 `当前预览第 1/N 条；点击后可翻页查看本轮其他候选`，避免用户把一条轻预览误读成全部结果；同一口径也会进入 Rest icon 的 `title` / 可访问名称。
- 召回口径：Footer 下方显示 `本轮召回 · 页面稳定后重新请求` 或 `本地缓存 · X 分钟前召回；未重新请求`。同页 hash 刷新、焦点恢复等复用本地缓存的场景不会伪装成刚查证过的新结果。
- 边界行：`只读提示 · 点击查看详情，不写入/插入/发送`。Peek 本身只说明为什么可能相关和来源新鲜度，不保存网页、不插入输入框、不发送消息，也不记录反馈；完整操作必须点击 icon 打开 Expanded Card。

Hover Peek 不包含按钮，不进入 tab 顺序，不抢焦点，鼠标离开后消失。`p1` 强相关可以使用 fresh 动效提示新结果；`p2` 只静默显示 Rest icon，用户主动 hover/focus 时才看到 `可能相关` Peek。即使同页 hash 刷新或焦点恢复复用了本地缓存的 `p2` 结果，也不能升级成 fresh 动效。完整操作必须点击 icon 打开 Expanded Card。

### Expanded Card

点击 icon 或按 Enter/Space 打开完整卡片。卡片按 **5 层结构**组织，每层占 1-2 行；正文区域在视口内滚动，反馈和分页 footer 固定在卡片底部，窄屏下不越界。任何层在数据缺失时自动折叠：

被动 Lens 的页面信号、候选切片、当前召回/缓存口径和只读边界只放在 Rest 的 `title` / 可访问名称与 Hover Peek 中。Expanded Card 不再重复渲染“页面召回回执”：用户打开卡片后应直接看到“为什么相关”和记忆内容，底部仍保留操作边界。Selection Memory Search 继续使用独立的划词范围回执。

| 层 | 内容 | 实现要点 |
|---|---|---|
| 1 Header | Memory Lens 品牌 + 关系强度标签 | 右侧：`↗` 跳转记忆原文、`⋯` 折叠破坏性操作 |
| 2 Why-row | `因为：` + 可解释 chips（最多 3 个） | 无 chips 就不渲染，整张卡降为 `weak` 不弹出 |
| 3 Title + Summary | 记忆标题（2 行）+ 摘要（2-3 行） | 优先用 `metadata.summary`；不用 raw snippet 或 `uiSummary` 当标题 |
| 4 Evidence | 行动项 / 回复建议 / 高价值链接 | 取 `metadata.actions[]` 第一条，多条显示"待办 N"可展开 |
| 5 Meta + Foot | 群名可点链接 / 时间 / 反馈 / 翻页 | Thumb up/down icon + `1/N` 翻页器，始终仅占 1 行 |

控制类操作分级：
- **正/负反馈**（有用 / 不相关）：底部仍只保留低饱和 thumb icon。两个 icon 的 hover / 读屏文案会在点击前说明将提交 `recall_quality` 反馈、服务确认前不会当作已学习、失败时负反馈只保留本页隐藏，以及不会插入、发送、删除原始记忆或确认事实。正反馈点击后，卡片 footer 先显示“正在记录 / 确认前不会当作已学习”，等 memory-service 确认成功才变成“已确认写入 / 后续类似提示会优先保留”；失败时卡片保留失败回执、按钮解锁并说明本次没有学习成功。负反馈入口显示为 compact thumb-down，点击后在卡片内打开轻量原因面板，而不是把“不是这个意思”做成大按钮。
- **操作边界回执**：Expanded Card footer 常驻显示只读边界。普通卡片说明不写入/插入/发送；划词卡片说明不保存/插入/外发；预演提醒说明不生成/插入/发送/执行，避免用户直接点击 Rest icon 打开卡片时错过 Hover Peek 的边界说明。普通被动 Lens 如果收到 `autopilot` 展示前过滤数据，footer 左侧优先显示低饱和短摘要，例如 `3 条可能相关，7 条静默`；hover、focus 或点击这枚摘要后再展开完整 `展示判断 / 过滤 / 场景锚点 / 边界 / 操作边界`，不再把整块绿色回执放在卡片首屏正文上方。
- **来源打开回执**：用户点击右上角 `↗` 记忆详情或正文里的原始来源链接后，卡片会留下 `来源打开回执`，说明打开的是资料详情、记忆详情还是原始来源，当前可复核状态，以及这只是新标签复核动作，不会写入记忆、插入输入框、发送内容或确认事实。原始来源链接本身也在 hover / 读屏文案里提前说明只打开新标签核对当前卡片摘要，不会重新召回、写入记忆、插入、发送或确认事实。这个回执复用 `opened_source` outcome，不新增后台写入语义。
- **Rehearsal 预演回执**：命中 Rehearsal 时，正文会额外显示 `预演回执`，列出触发线索、提示资格、管理页复核入口、只读预演边界和反馈影响。这个回执不新增操作，只让用户在标记有用/不相关前先确认它是未来场景脚本，而不是普通事实记忆。
- **负反馈原因面板**：面板只在用户点 thumb-down 后出现，包含“只是主题相似 / 群组或项目不对 / 空页面误触发”三类原因，选择后立即写入；备注 textarea 仅在用户主动展开“补充原因”后出现，不要求提交按钮。点击面板外侧、关闭按钮或 Escape 会收起面板，不改变当前提示。Rehearsal 卡片的面板标题使用“这条预演提醒不适合当前场景”，目标标签使用“误触发的预演提醒”，避免把 future-scene 脚本误称为普通记忆。
- **反馈失败可见化**：如果有用/不相关反馈没有成功写入 memory-service，卡片不能继续显示成“已学习成功”。正向反馈只有在服务端确认后才显示成功；失败时会解除本次按钮锁定并提示失败。负向反馈仍本地隐藏 30 分钟，但 toast 明确说明只是本页隐藏，并提供“重新显示”恢复刚才的卡片。
- **站点/页面级静默和屏蔽**（今天不提示 / 此页面永久不提示 / 永久不提示此站点 / 允许此站点）：收进 `⋯` popover，避免误触永久屏蔽。
- **跳转记忆原文**（在记忆中查看）：右上角 `↗` link-out icon，对应 `exploreLink`。

卡片支持 Escape 收起、Tab 进入操作区、窄屏不越界，并尊重 `prefers-reduced-motion`。

### 关键记忆简报（Keystone Memory Brief）

关键记忆简报复用现有 Rest → Hover Peek → Expanded Card 路径。它不是与零散关联记忆并列的第二入口：当简报达到可展示门槛时，它就是本轮被动 Lens 的首屏对象；零散记忆退到证据层。这样用户先拿到一个可复用结论，需要确认时再查看原始来源，而不是同时扫描两套同级内容。

用户不需要手动生成简报。独立于完整 Proactive Scheduler 的轻量 `KeystoneBriefComposerService` 维护循环会在 memory-service 启动时运行，此后默认每 15 分钟运行一次；它从活跃 Reflection Thread 发现稳定主题，在工作范围的 `messages_raw` 中查找近 180 天证据。至少两条独立来源且有一条非 reflection / derived 权威时，才确定性组成或刷新简报。每轮每位用户最多处理两份，重复来源签名跳过；用户隐藏或标记不准的简报受保护，不会被下一轮自动恢复。页面打开时的 `/context-recall` 只匹配已经准备好的简报，不调用 LLM、不等待生成，也不因浏览页面产生写入。

简报的用户可读语言服从 Options 页当前保存的语言，而不是代码默认值，也不以服务端画像条目反推当前设置。每次页面召回都会携带 `personalAiUiPreferences.language`；Lens 的状态、栏目、日期、按钮和操作回执直接使用本次请求语言。服务端只返回 `compositionVersion` 与本次请求语言一致的自动简报，旧语言简报未刷新完成时回退到普通关联记忆，不能把旧英文简报展示给已设置中文的用户。

Options 会把当前语言同步为 active `user_profile_items.language_preference`，该画像条目只负责约束 Composer 的生成语言，是 Options 设置的服务端投影，不是 UI 语言的权威来源。Options 页面打开时会自动核对并修复漂移；发生变化后立即请求后台刷新同一 `briefKey`，同时保留每 15 分钟维护循环作为兜底，不要求用户手动切换或生成。Composer 据此生成中文或 English 的标题、摘要、事实、待确认问题、时效原因和使用提示，并把语言写入 `compositionVersion`。人名、项目名、群组名、URL、Jira key、数字及来源标题/证据保持原文，便于复核。语言转换只允许等义转换既有字段，不能增加、删除或推断事实；转换失败时本轮不覆盖已有简报，等待后续维护重试。

#### Options 语言读取与后端同步链路

语言不存储在 `envConfig`。两类本地配置用途不同：

| Chrome 本地存储 | 内容 | 用途 |
|---|---|---|
| `personalAiUiPreferences.language` | `zh-CN` / `en-US` | Options 当前语言的唯一权威来源；控制 Lens 即时 UI 和请求语言 |
| `envConfig` | `MEMORY_SERVICE_BASE_URL`、API key、timeout 等 | 只用于连接 memory-service；不代表用户选择的语言 |

完整链路如下：

1. `useExtensionUiLanguage()` 通过 `readExtensionUiPreferences()` 读取 `personalAiUiPreferences.language`；下拉框变化通过 `writeExtensionUiLanguage()` 立即写回同一个独立 storage key。
2. `MemoryServiceClient.request()` 每次请求前重新读取该值，并写入 `X-Personal-AI-Language` 与 `Accept-Language`。memory-service 不会也不能直接读取浏览器的 Chrome storage。
3. `/context-recall` 用请求 header 选择本次召回语言，并过滤 `compositionVersion` 与请求语言不一致的自动简报。`src/background.ts` 同时把本地 `uiLanguage` 放进扩展消息响应，Lens 外壳直接按它渲染，不从简报正文或画像反推语言。
4. Options 页面使用 `envConfig` 中的连接信息创建 `MemoryServiceClient`，再把当前语言写成 active `user_profile_items.language_preference`。这里 `envConfig` 只是“如何连接后端”，不是“语言值从哪里来”。
5. `KeystoneBriefComposerService` 在 memory-service 内读取 `language_preference`，决定后台新生成/刷新的简报语言。若 Options 本地值与画像不一致，打开 Options 会自动修复画像及证据引用，并调用 `/keystone-briefs/refresh-language`；定时维护循环继续兜底。

因此读链路有两个明确时效层级：**当前页面展示以本次请求 header 为准，后台内容生成以同步后的画像投影为准**。画像同步失败时，已保存的 Options 语言和 Lens 外壳仍然生效；语言不一致的旧自动简报被过滤并回退普通记忆，不会错误展示。

`/context-recall` 在普通召回和 Evidence Cohesion Gate 完成后，尝试同步、确定性匹配一份简报。匹配失败或 Brief Service 异常必须 fail open：响应继续返回原有 `matches`，Lens 继续走普通卡片，不允许简报故障拖垮被动召回。

| 简报状态 | Rest / Hover Peek | Expanded Card 首屏 | 原始关联记忆 |
|---|---|---|---|
| `ready` | 同一枚 icon；Peek 预览简报标题、此刻相关原因、来源数和 `sourceAsOf` | 关键简报替换普通记忆卡，显示约束、事实、已有判断、易错点和来源时效 | 收进“来源与原始记忆”；点任一项进入原有记忆卡，并可“返回关键简报” |
| `partial` | 同一枚 icon；Peek 标成“有冲突” | 简报仍为首屏，但必须先显示冲突/时效警告；外发复制禁用 | 默认可展开，供用户核对冲突双方 |
| `stale` | 同一枚 icon；Peek 说明“有旧简报，当前展示原始记忆” | 不把旧摘要当当前事实；显示来源截至时间和过期原因后回落普通卡片 | 普通卡片仍是主内容 |
| `candidate` / `blocked` / `hidden` / 缺失 | 不泄露内部候选状态 | 完全沿用普通 Lens 卡片 | 不受简报影响 |

首屏简报的固定边界：

- `ready` 才允许“复制脱敏摘要”；复制内容经过 URL、token、邮箱、电话等外发脱敏。`partial` 的复制按钮必须禁用，不能用 warning 文案代替真实门禁。
- “有用”“不准”“隐藏”写入独立 `keystone_brief_events`，不能把整份简报的反馈冒充成某一条原始记忆的 `recall_quality`。`not_accurate` 会把简报置为待修复/blocked，`hidden` 会隐藏简报；两者点击后都立即清掉当前缓存里的 brief，并在同一个 Expanded Card 壳内回落原始记忆。
- 查看来源图、打开原始记忆、复制摘要和反馈都不会写入用户画像、创建任务、确认事实、插入输入框或发送到当前网页。来源详情仍沿用原有安全 URL 和只读打开边界。
- Selection Memory Search 和 Rehearsal 保持各自 variant。`selected_text`、`selection_memory_search` 或首条结果为 Rehearsal 时，Brief Service 不接管首屏，即使响应里误带 brief，renderer 也必须忽略。
- Brief 的 `shown`、`opened`、`evidence_opened`、`copied`、`useful`、`hidden`、`not_accurate`、`used_in_ask`、`used_by_compiler` 使用专用事件；普通 Lens 的分页、来源打开、Autopilot 和 recall feedback 语义保持不变。
- Options 选择中文时，简报壳和用户可读合成内容使用中文；选择 English 时使用 English。原始来源标题和证据不翻译，且语言切换必须刷新现有自动简报而不是等待新证据。

缓存重放必须同时保留 `keystoneBrief` 和原始 `matches`，这样同页恢复时仍能维持首屏层级；隐藏或标记不准后只移除 brief，不删除本轮原始召回结果。关键回归由 `memory-service/src/__tests__/keystone-brief-composer.test.ts`、`tools/verify-webpage-memory-detection.ts`、`desktop-app/scripts/webpage-memory-detection-check.mjs` 和 `keystone-memory-briefs` eval suite 覆盖。其中 E2E 必须构造同轮同时含 `keystoneBrief + changeProjections` 的响应，并断言简报独占首屏。

### 划词记忆检索（Selection Memory Search）

用户在任意非敏感网页选中文本时，Selection Memory Search 会先静默调用 `/context-recall` 做 `selected_text` 匹配。请求中 `primaryText` 只放用户选中的文本；页面标题、附近段落、所在容器文本等只作为 `secondaryTexts` 的 background context。只有候选同时满足 `displayPriority=p1`、存在 `whyRelevant` / concrete matched anchors，并且命中点能回到“选中文本”本身时，才在选区旁的动作条里显示 `icon48.png` 查记忆按钮。即使后端返回强相关，如果具体命中只来自附近段落或页面标题，而选中文字本身没有票号、项目名、人名、数字、行动项等锚点，也不会显示查记忆入口；选区适合保存时仍可显示独立的 `+ 入库`。

这个模块不新增独立搜索页，也不展示右下角 Rest / Hover Peek 流程。它复用 Lens 的浮窗壳、分页、反馈、跳转记忆原文和 `icon48.png`，但文案、标题、why row、空态和阈值语义都围绕“选中的文本”，不写成“当前页面相关”。

划词查记忆和选区入库可以在同一段选区上同时出现，但刻意分成两个入口：

- 命中强相关记忆时，选区旁只显示 `Personal AI icon`，代表“查已有关联记忆”；hover/focus 该 icon 会显示 `查已有记忆` tooltip，并明确它不保存、不插入、不发送、不调用外部 AI。
- 选区也适合保存时，`+ 入库` 以页面最右侧半露出的独立 dock 出现，点击后先打开确认面板，不自动保存。
- 没有强相关记忆但选区值得保存时，不显示查记忆 icon，只保留右侧半露出的 `+ 入库` dock。
- 这两个入口不会合并成一个按钮组，避免用户把“查已有记忆”和“保存新资料”误解成同一个动作。
- 如果选区靠近视口顶部，查记忆 icon 的 hover/focus tooltip 会自动改到 icon 下方，确保“不保存、不插入、不发送、不调用外部 AI”的边界说明不被浏览器顶部裁切。

- 被动 Lens：页面稳定后自动召回，命中强相关时显示右下角 Rest icon，hover 出 Peek，点击后展开 Card。
- Selection Memory Search：用户选中文本后先静默召回，命中强相关才显示选区动作条里的查记忆 icon，点击后直接打开 `selectionSearch` variant 浮窗。
- `selectionSearch` variant 的 Header 使用 `划词记忆检索` / `Selection Memory Search`，内容层级为 `选中的内容 → 找到的相关记忆 → 为什么匹配 → 证据 → 操作`。
- 划词结果卡片在“选中的内容”下方显示 `检索范围` 回执：`打开` 说明点击 icon 只是打开已命中的本轮划词结果，不二次召回、不保存、不插入、不发送、不调用外部 AI；`候选` 说明本轮强相关候选数量、当前第几条以及回到选中文字的锚点；`查询` 说明主检索文本只取选中文字，`背景` 说明页面标题/附近段落只是辅助上下文，`命中门槛` 说明只有选中文字本身有具体锚点才显示入口，`边界` 说明主动划词不受被动站点静默或屏蔽影响，`安全` 说明敏感页/密钥类选区仍拦截且不会自动入库、插入或发给外部 AI。
- Why row 文案使用 `为什么匹配` / `匹配到`，chips 优先展示 `选中文本命中：xxx`、`主题：xxx`、`项目：xxx`；不使用全页面 Lens 的“同页面 / 网页上下文”语义。
- 划词 Card 打开期间，普通页面 passive recall 不应立刻覆盖或清掉当前 `selected_text` 结果，避免用户看到卡片一闪而过。

如果没有匹配到高相关记忆，不显示划词入口，也不弹出“没有找到高相关记忆”这类空结果提示。`p2`、`hidden`、纯语义相似、只有页面背景命中但没有选中文本命中的结果都不展示入口。只有 `Codex`、`AI`、`RingCentral` 这类宽泛主题词命中时，也不能展示入口；需要命中 `续约`、`300万`、票号、项目名、人名、行动项等更具体的选中文本锚点。

每次选区变化都会立即清除上一条划词入口、取消上一条 pending recall，并重新发起 `selected_text` 匹配。Selection Memory Search 不读取上一轮划词缓存，background/session 的 completed-result cache 也必须绕过 `selected_text`；即使用户重复选择相同文本，这仍是一次显式用户动作，应重新读取当前记忆状态，避免把旧结果误展示在新选区旁。

同一页面如果多处出现相同选中文字，附近段落也会进入本次划词上下文签名；用户从第一处相同短语切到第二处时会重新发起 `selected_text` 召回，而不是只把第一处结果挪到新位置。

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
- 请求可以包含 `interactionScene`，用于说明用户此刻是在读 Jira、写 Jira comment、在 RingCentral 群聊讨论 estimate、回复 thread、划词查询，还是只是在普通网页阅读。前端只做确定性的页面/输入框/选区快照和轻量 admission gate，不在浏览器端调用 LLM；Memory Service 负责把这个 scene 和候选记忆结合，判断是否应该提示。
- `interactionScene.visibleFacts` 会携带当前页面已经能直接看到的结构化字段，例如 Jira 上的 `DEV Estimate New=0.4`。Cue Compiler 看到这类字段后，不会在 Jira issue 阅读场景里再弹一条复述同一字段值的 Lens；同一条记忆仍可以在 RingCentral 群聊、thread 或 Jira comment composer 里作为“讨论估算时的口径提醒”出现。
- `interactionScene.admission` 只表达“前端已经观察到足够场景信号，值得查询”，例如 issue key、选中文本、输入框 focus、附近消息、可见字段。最终是否展示、展示成只读 Lens 还是给 Compose Assist 的 draft hint，仍由后端 SceneFrame、Cue Compiler 和 Outcome Loop 决定。
- 后端会 over-fetch、过滤、合并同源 cluster、rerank，再返回 `uiSummary`、`reasonType`、`evidenceRole`、`displayPriority`、`exploreLink`。
- 对短句或指代性上下文会先做 `MemoryContextMatchService` 话题锁定：用当前页面/会话 hint、`conversation_context_frames`、近期高频消息、source anchors、角色词和互动信号判断用户可能在问哪个项目或 thread。例如用户只说“那个 BE ready 了吗”或“那个新 design 定了吗”时，服务会先尝试锁定到最近最强的话题；如果候选接近，Context Recall 应降级或保持静默，不强弹确定结论。
- Cue Compiler 位于召回和 UI 之间。`SceneFrameService` 只从当前原始页面/输入框 request 提取 sceneType、fieldHints、issueKey、risk，不使用 RecallContextExpansion 加入的历史记忆词，避免把“找到的 estimate 记忆”反向污染当前 status 页面。当前先支持 Jira estimate：`MemoryCueFactService` 从候选记忆抽 `estimate.unit`、`jira.field`、`close_policy`、`due_date_policy`，`CueCompilerService` 生成 `ContextCue(actionType='remember')`，并要求 `sourceRefs`、`whyNow`、`confidence` 可追溯。
- Cue Compiler 会读取 `MemoryOutcomeLoopService` 的 cue policy。重复负反馈生成的 `suppress` patch 会把同一句 cue 降为 `compileStatus='suppressed'`、`suppressReason='outcome_policy'`，前端不需要新增按钮；重复正向采纳则会以 `boost` policy 提高同类 cue 的排序置信度。
- Jira issue 页面会额外做“当前页字段 echo”过滤：如果页面已经显示 `DEV Estimate New: 0.4` 这类 estimate 字段值，Lens 不应再弹一条只复述该字段值的提示。这样的记忆更适合在 RingCentral 群聊、thread、Jira comment 草稿等“讨论这张 ticket 估算”的场景里出现；只有页面上看不到的口径、决策背景或风险说明才适合在 Jira 页面提示。
- 带明确 Jira key 的 RingCentral / Jira 场景会对 `source_memory` 做精确锚点过滤：资料记忆的标题、摘要、片段、来源 URL 或 link 必须包含同一个 issue key，才允许作为强提示展示。`sdk`、`bug`、`release`、`link` 这类泛词重合只能说明可能相关，不能替代票号证据。
- Source Memory 的异步 deep pack 只在 `status=ready` 且 input hash 与当前 P0 一致时参与召回。查询若只命中 deep cue/memo/trigger 文本，必须再命中当前 `interactionScene` 对应的 trigger card；Ask、会议、Jira、页面阅读、写作和研究场景不能仅凭同一个 deep-only 关键词互相串场。标题、摘要、原始 preview、anchor 或 P0 takeaway 的基础命中仍可独立工作，因此 deep 排队、阻断或失败不会让已保存资料从 Lens 消失。
- ready deep pack 可提供更合适的显示预算：`one_line`、`compact` 或 `full`。Lens 仍返回 capsule 详情和安全来源链接作为复核路径，fact/open-question/Skill/Storyline candidates 不直接渲染成已确认事实，也不会因为卡片展示而写画像、创建动作、发布 Skill 或写回 Storyline。
- 当 `sourceTypes` 包含 `rehearsal` 时，`/context-recall` 可以返回 `type='rehearsal'`、`evidenceRole='rehearsal_cue'`、`reasonType='prospective_cue'` 的预演提醒。Lens 需要把它显示成“预演提醒”，解释命中的人物、会议、issue、URL 或 topic，而不是当普通事实记忆渲染。
- Rehearsal 卡片使用“为什么此刻相关 / 预演内容 / 我能做什么”的文案，`↗` 跳到 `memory-exploring.html#/rehearsals?rehearsalId=...`，有用/不相关反馈写回对应 Rehearsal activation。展开卡正文显示 `预演回执`，把触发线索、状态/提示资格、复核入口、只读边界和反馈范围放在用户执行反馈前。
- 普通记忆和 `source_memory` 资料记忆反馈会以 `recall_quality` 进入 memory-service；资料记忆负反馈按 capsule id 记录，后续 source memory 召回会排除该 capsule。Rehearsal 负反馈走 `/rehearsals/:id/feedback` 并记录为 `irrelevant`，后续同目标或低质量同源结果会被排除或降权。
- cue-backed 卡片不新增用户操作。用户展开卡片时会通过既有 `AMBIENT_CALIBRATION_TRACE` 写入 `expanded` outcome；thumb up/down 仍走现有反馈通道，但 detail 会带 `cue_id`、`cue_key`、`cue_action_type`、`cue_compile_status`、`cue_confidence` 和 `cue_why_now`，供 Outcome Loop 学习这句 cue 是否有用或不相关。

质量门控重点：

- 空 RingCentral Video / `You're the only one here` / invite UI shell 不触发会议关联提示。
- `RingCentral Video`、calendar invite、join link、participants 等壳信息没有项目、票号、动作、风险、决定、依赖等具体锚点时不展示。
- Codex/MCP/skill/setup 等工具上下文必须和候选记忆存在足够主题交集；不能因为日期或泛化 project 词召回 Gary trip 这类旅行记忆。
- 有具体 work signal 的会议、Jira、消息和 AI tool cost/budget/process 记忆仍可保留。

## 隐私与控制

Memory Lens 默认把“用户可以看见记忆”和“可以把记忆外发给其他 AI”分开。Lens 只在当前页面展示已有记忆，不自动复制、不注入输入框、不外发给第三方 AI。需要生成回复或把上下文交给外部 AI 时，应进入 Compose Assist / Context Passport / egress firewall 等后续能力。

### 用户总开关与服务器杀开关（两层门）

被动情境召回有两层独立门，必须同时打开才会真正检索：

| 层 | 开关 | 作用范围 | 默认 |
|---|---|---|---|
| 每用户 Options | `chrome.storage.local.envConfig.CONTEXT_LENS_ENABLED` | 扩展客户端：网页 `web_passive`、会议 `meeting_passive`、popup `popup_passive`、消息会话 `follow_thread` 的被动 Lens 气泡 / 旁路召回 | 打开（`!== false`） |
| 部署级服务器 | `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED` | memory-service：上述被动 surface 即使收到请求也直接空结果 | 打开（未配置时默认开启；仅显式 `false`/`0`/`off`/`no` 关闭） |

关闭 Options 的 Memory Lens 开关后：

- 客户端不再为被动 surface 发 `/context-recall`；background `CONTEXT_RECALL_REQUEST` 也会在发出前拦截并返回空结果。
- 已打开页面上的被动气泡会立刻清掉；重新打开开关后会重新评估当前页。
- **不会**关闭 Compose Assist（`CONTEXT_ASSIST_ENABLED` / `COMPOSE_ASSIST_ENABLED`）或会前准备 / Meeting Pilot。Lens 不是 Assist 的子开关。
- 主动划词检索（`contextType=selected_text`）仍可用，继续受敏感页、敏感表单和低信息/密钥选区拦截。

服务器 `CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED=false` 时，即使用户 Options 仍打开，服务端也会对被动 surface 返回空结果。两层可以同时存在：用户关 Lens，客户端不发请求；服务器关被动检索，即使请求到达也是空结果。Compose Assist 的 `composer_guard` 不受这两层被动门控制。

站点控制存在扩展本地 storage：

- `pai-context-muted-sites-v1`
- `pai-context-blocked-sites-v1`
- `pai-context-blocked-page-prefixes-v1`
- `pai-context-allowed-sites-v1`
- `pai-context-site-allowlist-mode-v1`

Options 页提供“网页记忆提示控制”管理入口，用于恢复临时静默、永久屏蔽站点、永久屏蔽页面路径和允许站点白名单。

这些控制只约束 **被动网页处理**：右下角 Lens、页面级 `/context-recall`、整页/视觉资料 `+ 入库` 的被动候选评估和旧的网页智能分析，都会在临时静默、永久屏蔽、路径屏蔽或白名单未命中时停止；用户主动划词检索仍可使用，但继续受敏感页面、敏感表单和低信息/密钥选区拦截。Options 中的修改会通过 `chrome.storage.onChanged` 实时同步到已打开页面，不需要刷新当前页才生效；如果当前页已经显示了被动 Lens 或整页/视觉 `+ 入库` 入口，被控制后也会立即清掉，恢复允许后再重新评估。这个实时变化会在当前页面留下短回执：被阻断时说明是哪类站点控制让被动 Lens、页面召回和被动入库候选停止；恢复时说明会重新评估；两种回执都会保留主动划词仍可用和不删除、不同步、不外发已有记忆的边界，避免用户把空白状态误读成召回失败。

Options 管理页会常驻显示 `站点控制状态` 回执：当前是默认模式还是白名单模式、会被控制的被动处理范围、当前有哪些静默/屏蔽/白名单阻断、主动划词仍可用，以及这些设置不会删除、同步、外发记忆或反写当前网站。白名单模式开启但没有允许站点时，回执会明确说普通网页被动提示会全部保持静默，避免用户以为是召回质量或扩展故障。Options 内每次允许、移除允许、临时静默恢复、永久屏蔽恢复或路径屏蔽恢复后，也会显示操作结果回执：它会区分“只是移除了某条规则”和“已打开页面会重新评估被动 Lens”，并在白名单模式下说明未加入允许列表的站点仍会保持静默。2026-07-12 起，Options 里的刷新、白名单开关、允许/移除/清空、整站屏蔽/恢复和页面路径屏蔽/恢复按钮也会在 `title` / `aria-label` 里提前说明点击影响：只改本机被动网页处理规则、已打开页面是否会重新评估、主动划词仍可用，以及不会写入、删除、同步或外发已有记忆。

白名单是全局模式，不是单站点的“解除屏蔽”。因此卡片菜单在白名单关闭时显示为“开启白名单并允许此站点”，避免用户误以为只是恢复当前站点。

当用户显式“允许”某个站点时，Options 页和卡片快捷入口会移除覆盖该站点的父域/子域临时静默或永久屏蔽规则，避免出现“已允许 docs.example.com，但 example.com 的父域屏蔽仍让 Lens 不出现”的假成功。反过来，用户显式“永久屏蔽”站点时会清掉覆盖范围内的允许/静默冲突记录，让设置页只保留当前真正生效的控制语义。

Expanded Card 的更多菜单会先显示 `站点控制回执`：当前 host、当前默认/白名单模式、当前状态、会被影响的被动处理范围，以及不会发生的事情。当前状态会明确说明这一页是否已经被临时静默、站点屏蔽、页面路径屏蔽或白名单未命中压住；如果当前仍可提示，就显示“当前未被静默/屏蔽；被动提示可继续评估”。菜单还会在用户点击前说明各动作影响：允许站点会开启/使用白名单并移除覆盖当前站点的静默/屏蔽冲突；永久屏蔽站点会保存当前站点屏蔽设置并清掉覆盖范围内的允许/静默/旧屏蔽规则；页面屏蔽只保存当前路径。用户点“今天不提示 / 页面永久不提示 / 永久不提示此站点 / 允许此站点”后，toast 也会说明这只影响右下角 Lens、页面召回和整页/视觉入库候选；主动划词仍可用，且不会删除、同步或外发已有记忆。

2026-06-23 补齐页面路径控制的即时回执：`此页面永久不提示` 和 Options 的页面路径屏蔽/恢复消息都明确说它只改变该路径下的被动网页处理，不影响同域其他路径；主动划词检索仍可用，且不会写入、删除、同步或外发已有记忆。

## 业内参考与启发

- Chrome extension `activeTab` 的官方设计强调“用户手势后临时访问当前 tab”，比长期全站访问更符合最小权限预期；划词检索同样应把用户选中的查询和页面背景上下文分开说明。
- Microsoft Edge 的 Copilot page context policy 把“Copilot 能否访问页面内容”做成可动态刷新的 profile-level 控制；站点控制变更实时作用于已打开页，沿用同样的可预期性。
- Microsoft Edge Copilot 的 Context clues 文档把 prompt、当前页面、打开的 tab、历史和偏好区分为不同来源；Selection Memory Search 也要告诉用户哪些内容是主查询、哪些只是辅助背景。
- ChatGPT Memory 和 Notion Enterprise Search 都把记忆/连接源控制、权限过滤和删除/断开后的不可用语义作为用户信任基础；Memory Lens 的静默/屏蔽不应只隐藏 UI，而应阻止对应被动处理。
- ChatGPT Memory Sources、Notion Enterprise Search citations 和 RAG trust/transparency 研究都指向同一个 UI 原则：用户看到关联记忆时，应能直接追到来源，而不是只看到模型摘要或分数。因此 Expanded Card 即使只拿到 `sourceUrl`，也要展示可点击来源链接。
- Slack AI Search / Notion Enterprise Search 都强调搜索答案来自用户已有权限范围，并可追溯来源；对 Hover Peek 来说，弱相关 `p2` 不能像强提醒一样打断用户，只能在有明确解释锚点时作为低打扰入口出现。
- context-aware recommender explanation 与 notification/peripheral-display 研究都指出，解释会提升信任但也带来理解成本；因此 Hover Peek 只展示 1 条低负担解释，并把范围 / 新鲜度压缩进 footer，`可能相关` 不使用 fresh 动效。
- SOUPS 2021 对浏览器扩展权限理解的研究指出，用户偏好能建立清晰心智模型的权限描述；Contextual Integrity 相关 AI assistant 论文也强调信息流应符合当前场景预期。因此这里优先做明确文案、实时反馈、冲突消解和被动处理边界，而不是增加复杂配置层级。
- 2026-06-22 复查 [ChatGPT Memory sources](https://help.openai.com/en/articles/8590148-memory-faq)、[Microsoft 365 Copilot Semantic Index](https://learn.microsoft.com/en-us/microsoftsearch/semantic-index-for-copilot)、[Notion AI security practices](https://www.notion.com/help/notion-ai-security-practices)、[Slack AI Search](https://slack.com/help/articles/31739993134867-Search-with-AI-in-Slack) 和 RAG trust/source-attribution 研究后，本功能继续采用“先解释来源/范围/过滤，再给用户反馈控制”的方向。Autopilot 回执不增加新按钮，只把后端已经做过的展示前过滤变成可见事实，避免用户把 Lens 卡片误读成写入、外发或完整结论。
- 2026-07-02 复查 Chrome `activeTab`、Microsoft Edge Copilot Context Clues、CHI 2025 RAG trust/transparency 和 RAG trustworthiness survey 后，划词检索继续采用“用户明确选中内容作为主查询、页面背景只作辅助、来源与控制可见”的设计：选区卡片现在明确写出 `命中门槛`，并用 E2E 锁住背景-only 强返回不弹出查记忆入口，避免把当前页面上下文误当成用户主动选中内容。
- 2026-07-04 复查 ChatGPT Memory sources、Slack AI Search citations、Notion Enterprise Search 权限过滤、CHI 2025 RAG trust/transparency 和 HCINLP 2025 end-user control 后，Hover Peek 继续保持轻量，但把本条提示是“本轮召回”还是“本地缓存复用”直接露出。这样用户不需要先打开 Expanded Card 或看开发日志，也能判断这条弱提示是否刚重新查过。
- 2026-07-05 复查 Chrome `activeTab`、Microsoft Edge Copilot page context policy、SOUPS 2021 浏览器扩展权限理解研究、RAG trust/transparency 用户研究和 RAG trustworthiness survey 后，站点控制继续采用“点击前说明当前规则和影响范围”的方向：菜单不只说能静默/屏蔽，还要说明当前状态、会清理哪些冲突规则、主动划词仍可用、以及不会删除/同步/外发已有记忆。
- 2026-07-11 复查 Slack AI citations/source preview、Notion AI 权限过滤、Microsoft Edge Copilot Context Clues 和 CHI 2025 / IBM RAG trust-transparency 研究后，Hover Peek 继续保持轻量，但在多候选结果里补充 `当前预览第 1/N 条` 切片回执。这样用户在打开完整卡片前就知道当前 hover 只是本轮可翻页候选中的一条，而不是完整结果集。

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
- 对仍保留 `source-memory/<capsuleId>.md` 或 `source-memory:<capsuleId>` 线索、但关联 `messages_raw` 检索信号已经缺失的历史资料 chunk，召回引擎会回查已保存 capsule，恢复 `sourceUrl` / `sourceTitle` / 资料详情路由；Lens 不需要按卡片再发一次详情请求，也不会从标题猜测 URL。
- 链接文案优先用 `sourceTitle`，没有时使用来源类型；同 URL 去重，最多展示 3 个来源入口。
- 只接受安全 `http(s)` URL；`javascript:`、`data:` 和其他非网页协议不进入卡片。
- 如果 `exploreLink` 或原始来源 URL 被安全策略隐藏，或没有任何可打开来源，卡片要显示 compact 来源回执（例如 `记忆入口已隐藏` / `原始来源缺失`），避免用户把按钮消失误解成“已经完整可追溯”。
- 当有可打开来源或记忆详情入口时，卡片还会显示 compact `来源状态` 回执：当前页、同站、外部来源、已保存资料来源和记忆详情是否可复核；如果这条记忆已经很久没有更新，会提示“行动前复核”，避免用户把旧记忆当成当前事实直接执行。
- `当前页面来源可复核` 的判断使用规范化后的 URL：会忽略 hash、常见追踪参数和 query 顺序差异，避免当前页面带 `utm` / `fbclid` 时被误降级成“同站来源可复核”。
- 点击可打开来源或记忆详情后，卡片会显示 `来源打开回执`，记录本次点击打开的对象、复核口径和无写入/无发送/无事实确认边界；用户回到原页面时可以确认刚才只是复核入口，而不是把旧记忆升级成当前事实。

## Scene Memory Autopilot

后端 `/context-recall` 现在负责第一道场景过滤，不再把主要相关性判断留给浏览器端临时 `overlapAudit`。流程是：

1. 前端 `SiteContextAdapter` 先生成 `SiteContextSnapshot`，再补一个 `InteractionScene`：当前 surface、scene type、user mode、active element、可见字段、附近消息和 admission reasons。
2. `RecallEngine` over-fetch 候选；`ContextRecallService` 合并同一会议、群组、会话或来源 URL 的重复 chunk。
3. `SceneFrameService` 把原始 request 和 `InteractionScene` 合成后端可追溯的 scene frame，明确这是 `jira_issue_reading`、`jira_comment_composing`、`ringcentral_estimate_discussion` 等具体场景。
4. Scene Memory Autopilot 根据人物、项目、主题、来源重叠和用户当前动作调整分数和 `displayPriority`。
5. 低信息标题、空会议壳、广播/公告无锚点、跨域工具主题、弱语义-only 结果会降成 `hidden`。
6. 响应返回 `autopilot` 摘要和 debug scene frame，记录 `mode`、展示数、静默数、hidden 数、低信息数、来源排除数、重复合并数、场景锚点、interactionSceneType 和 quiet reasons。

2026-06-23 更新前端可见边界：普通 Memory Lens Expanded Card 不再在首屏正文顶部显示整块 `展示前过滤回执`。它会把后端 `autopilot` 压缩成 footer 左侧短摘要，例如 `3 条可能相关，7 条静默`；用户 hover、focus 或点击后，才看到本次是强相关卡片还是低打扰入口、静默了多少弱候选、命中的场景锚点，以及这只是只读展示前过滤，不写入记忆、不强化访问计数、不外发来源。Selection Memory Search 是用户主动查询，不显示这条被动 Autopilot 回执。

2026-06-30 更新 eval 可复核性：`scene-memory-autopilot` 报告除了展示每条 case 的 `sourceProvenance` 原始列表，还会生成 `样本来源审计`，汇总可信输入、阻断来源、stale / unverified / unknown 状态和告警。这样用户看报告时可以先判断样本是否真的来自可用页面、真实快照或 synthetic fixture，再判断 Autopilot 的展示/静默是否通过；混合 case 中被阻断来源会继续可见，但只要有明确 used / verified / synthetic / fixture 输入，不会被误判为失败。

这个分层的关键取舍是：前端做“是否有足够交互信号值得问”的确定性 admission gate，后端做“这条记忆在这个场景该不该出现”的语义判断。这样不会一打开任意网页就请求 Lens，也不会让浏览器端用临时规则决定所有记忆相关性。

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


## 变化脉络

Memory Lens 可消费 `/context-recall.changeProjections`，详见 [Change Memory Ledger / 变化脉络](./change_memory_ledger.md)。账本与普通 `matches` 分离。当同轮没有 `ready` / `partial` 简报时，它作为当前稳定对象的优先证据占用首个候选槽位；有可展示简报时，**简报优先**，变化脉络不与简报并列占首屏，而保留在证据/原始记忆层。没有简报时，分页先显示只读变化脉络，再显示其余普通记忆，并保持本轮最多 3 张卡。

维护约束：

- `conflicted` 的当前值必须显示为未知，候选只出现在历史里。
- `superseded_on_page` 显示页面当前值，同时保留最后观测历史。
- `confirmed_current` 只能来自本次页面显式字段或成功的实时来源读取，不能仅因历史事件来自用户本人或权威来源。Jira 对 DEV / QA Estimate 与 Story Points 使用一次带 60 秒短缓存的只读 REST 核对；返回 `null` 明确显示“Jira 当前为空”，请求失败或字段未渲染则保持 `last_observed`。
- Lens 的普通卡片缓存可以保留 5 分钟，但 Jira 实时字段读取时间是该缓存的组成条件：60 秒后形成新的读取快照时必须重新请求账本，不能拿旧卡覆盖新核对结果。
- `superseded_at_source` 显示实时来源当前值并保留账本最后观测；页面未显示某字段不得等价为该字段为空。
- 链级卡 footer 固定为 `链级只读`，操作边界固定说明不确认当前值、不写入、不插入、不发送。
- Cache 必须连同 `changeProjections` 保存，不能首次出现后在同页稳定缓存命中时消失。
- 排序先按专用交互和高阶展示对象仲裁，再按 `displayPriority` 与关联分数：Selection / Rehearsal 保持专用视图；`ready` / `partial` 简报优先于变化脉络；变化脉络优先于普通强相关记忆。
- Jira Lens 的缓存、去重和展示身份使用稳定 `issueKey`，而不是延迟渲染的字段签名。字段继续作为请求上下文传给服务端，但同一 issue 的局部重绘不得清空图标或重复发起 Context Recall。Compose Assist 的预渲染 icon 只有在当前上下文确实是可编辑 composer 时才抑制 Lens；Jira 阅读态必须把当前 issue payload 传入抑制判断，不能仅因 icon 可见就丢弃已完成的 recall 响应。
- Selection Memory Search 不消费页面级变化链。
- UI 回归使用 `node tools/verify-change-memory-ledger-e2e.mjs`。

## 验证

核心验证入口：

- `npm run verify:webpage-memory-detection`
- `npm run verify:webpage-memory-detection:e2e`
- `npm --prefix memory-service test -- --run src/__tests__/api-context-recall.test.ts`
- `npm run eval:run -- --suite scene-memory-autopilot --no-repair`
- `npm start` 到首次 successful compile 后停止
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/context-lens/__tests__/lensConfig.test.ts`

重点回归场景：

- Options「记忆提示控制」有独立的 `启用 Memory Lens / 情境召回` 开关，默认打开；关闭后网页/会议/popup/消息会话不再请求被动召回，写作护航和会前准备仍可用。
- `displayPriority=hidden` 不展示。
- `displayPriority=p2` 且带有 `whyRelevant` 时可显示 Rest icon 和 Hover Peek，但不使用 fresh/强相关动效；缺少解释锚点的 `p2` 不展示。
- 同页 hash 刷新、焦点恢复或缓存重显时，缓存里的 `p2` 结果仍保持 `可能相关` 低打扰状态，不重新触发召回或显示 fresh 动效。
- 右下角 Rest icon 的 tooltip / aria-label 应在 hover 前说明强弱相关、第一条 why chip、顶部记忆标题和只读边界，不展示百分比分数。
- 右下角 icon hover 出 Hover Peek，mouseleave 后消失，click 后打开 Expanded Card。
- Hover Peek 和 Expanded Card 都不展示 `100%/87%` 这类百分比分数。
- Expanded Card footer 应常驻显示按卡片类型变化的只读操作边界：普通 Lens 不写入/插入/发送，划词检索不保存/插入/外发，预演提醒不生成/插入/发送/执行。
- Rehearsal Expanded Card 正文应显示 `预演回执`，包含触发线索、提示资格、管理页复核入口、只读边界和反馈影响；负反馈 drawer 应使用预演提醒专属文案，并继续写回 `/rehearsals/:id/feedback` 而不是普通 `/feedback`。
- 普通 Memory Lens Expanded Card 应在 footer 左侧显示 `autopilot` 短摘要，例如 `3 条可能相关，7 条静默`；首屏正文不直接展示 `展示判断 / 过滤 / 场景锚点` 大块回执，hover、focus 或点击短摘要后才显示 `autopilot.summary`、静默弱候选、场景锚点和“不写入记忆、不强化访问计数、不外发来源”边界。Selection Memory Search 不显示这条被动 Autopilot 回执。
- Hover Peek footer 应优先显示来源、记忆范围、记录时间、旧证据复核提示和可读来源标题；这行只做 provenance / freshness 回执，不把时间误渲染成 why chip，也不等用户展开卡片才说明个人/工作范围。
- Expanded Card 标题使用 `metadata.summary` 语义描述，不使用 `"@xxx wrote:"` / `"3. 行动指南"` 这类 raw snippet。
- 当返回结果含 `metadata.actions[]` 或 `replyAdvice` 时，卡片证据区优先展示可执行行动/建议，不退回低信息 raw snippet。
- 当召回结果只有 `sourceUrl`、没有 `links[]` 时，Expanded Card 仍展示安全来源链接，并按 URL 去重。
- 当 `exploreLink` 或原始来源 URL 不安全/缺失时，Expanded Card 应显示来源回执；不允许把核验入口静默省略。
- Expanded Card 应显示来源状态回执：区分当前页 / 同站 / 外部来源 / 已保存资料来源，保留记忆详情可复核状态，并对 90 天以上的旧记忆提示行动前先复核。
- 当前页面来源状态应在页面 URL 带 hash、追踪参数或 query 顺序变化时仍显示 `当前页面来源可复核`。
- `source_memory` Expanded Card 的有用/不相关反馈应真实写入 `/feedback`，target id 规范为 source memory capsule id，而不是只在前端显示 toast。
- 如果 Expanded Card 的反馈写入失败，应给出失败 toast；不相关反馈失败时只能说明“本页隐藏”，并允许用户重新显示刚才的卡片。
- 划词后先静默发起 `selected_text` 召回；只有命中高相关候选才显示选区动作条里的查记忆 icon。
- 强相关划词命中且选区也适合保存时，选区旁的查记忆 icon 和页面右侧半露出的 `+ 入库` dock 应同时存在，但彼此分离。
- 选区旁的查记忆 icon 应有 hover/focus tooltip：命名为 `查已有记忆`，并说明不保存、不插入、不发送、不调用外部 AI。
- `selected_text` 没有高相关候选时不显示划词 icon，也不弹空结果 toast。
- `selected_text` 没有高相关候选但选区值得保存时，只显示 `+ 入库`，点击后必须先打开确认面板，取消不写入资料记忆。
- 点击划词 icon 后直接打开 Expanded Card，并保持当前 `selected_text` 结果，不被随后完成的页面 passive recall 立刻替换或清除。
- 划词结果卡片应显示 `检索范围` 回执，说明点击 icon 只打开已命中的本轮划词候选、不二次召回、不保存/插入/发送/调用外部 AI；同时说明主查询只取选中文字，页面标题/附近段落只作背景，主动划词不受被动站点静默影响，敏感页/密钥类选区仍拦截且不会自动入库、插入或发给外部 AI。
- 划词结果卡片的更多菜单只处理本次主动查询结果，不展示被动 Lens 的站点静默、站点屏蔽、页面屏蔽或白名单控制。
- 选中 Lens 自身卡片文本、明显密钥/卡号文本、或响应前切到敏感表单时不展示划词结果。
- 允许 `docs.example.com` 会移除覆盖它的 `example.com` 静默/屏蔽记录；随后白名单模式下打开该子域应能触发被动召回。
- 永久屏蔽一个站点会清掉覆盖范围内的允许/静默冲突记录，Options 页不应同时显示互相抵消的有效规则。
- 被动 Lens 卡片更多菜单应显示 `站点控制回执`，说明当前 host、当前模式、当前状态、控制范围、允许/临时静默/页面屏蔽/站点屏蔽动作的具体影响、主动划词边界和不删除/不同步/不外发边界；点击站点控制动作后的 toast 也要保留这条边界。
- Options 页应显示 `站点控制状态` 回执；白名单开启但允许列表为空时必须明确说明普通网页被动提示全部保持静默，并继续说明主动划词不受该被动控制影响。
- Options 的站点控制操作结果应说明本次改动是否会让已打开页面实时重新评估；白名单模式下移除允许站点、恢复静默或恢复屏蔽时，必须明确站点如果不在允许列表里仍会保持静默。
- Hackathon/Codex/MCP/setup 上下文不召回 Gary travel itinerary。
- 空 RingCentral meeting shell 不召回 Colin/AVA 或其他 glip 记忆。
- 有具体工单、动作、决策、风险的 RingCentral Video/meeting 记忆仍可召回。
- Scene Memory Autopilot eval 覆盖 compose 群聊、Google Doc/web 文档、工具额度噪音、空会议壳和重复会议 chunk；报告应展示样本来源 provenance、来源状态审计、`autopilot.mode`、`quietReasons`、`duplicateMergedCount` 和 top match 解释。缺少可信输入源、全部来源被阻断或含 stale / unverified 来源时，eval 应在 score 和建议里显式提示。
- 命中 Rehearsal 时展示“预演提醒”与 `prospective_cue` why chips，不插入回复、不自动生成文本。
- HR Open Day / Everyone AI Campaign 广播通告等跨群无锚点记忆，在 `overlapAudit` 后降为 `hidden`，不进入自动弹出候选。
- 跨群无重叠的候选即使 score=1.00 也不展示 Rest icon 红点；仅在用户主动点击 icon 后以 `可能相关` 出现。
- 当所有候选 `overlapAudit` 均为 `hidden` 时，Rest icon 不显示红点，Hover Peek 不弹，Expanded Card 主动打开才展示"暂无强相关"空态。
- 反馈 thumb up/down 后，`detail` JSON 携带 `scene_anchor_signature`、host、target/source 类型、来源标题/URL，以及可用的 `match.metadata.groupId + sender`，用于后续同场景降权。thumb-down 原因面板还会写入 `interaction=memory_relevance_trainer`、`feedback_reason`、可选 `feedback_note` 和 `auto_applied=true`，让后端后续能区分“只是宽泛主题相似”“群组/项目错配”“空页面壳误触发”等训练信号。
- Options 里新增/移除站点静默、永久屏蔽、路径屏蔽或白名单规则后，已打开页面应立即停止或恢复被动 Lens；被控制站点也不应继续触发旧的网页智能分析或整页/视觉 `+ 入库` 候选评分。
