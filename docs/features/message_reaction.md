# 消息交互功能 (Message Reaction)

## 功能概述

消息交互功能提供了在 RingCentral 消息流中快速处理消息的能力。当前工具栏提供四个入口：稍后处理 / Remind、关注后续 / Watch、第三入口（别人消息为自动答复 / Reply，自己消息为跟进追问 / Followup）、联动操作 / Openclaw，并在长悬停工具栏时提供齿轮设置入口。

## 大白话运行逻辑

Message Reaction 是“在消息旁边就地处理”的工具条：用户停留在某条消息上，系统先判断消息是谁发的、能提取出哪些上下文，然后给出稍后、关注、答复/跟进、联动这些动作。

结果主要受这些因素影响：

1. 悬停意图：工具栏只在鼠标停留消息 4 秒后出现，点击消息或键盘聚焦消息卡片不会直接展示工具栏，避免用户只是扫过或选中消息时打扰阅读。
2. 消息身份：别人消息显示自动答复，自己消息显示跟进追问；自我识别错误会直接影响入口。
3. 原消息链接/ID：Snooze 和 pending 保护依赖同源消息 ID，决定是更新旧提醒还是创建新提醒。
4. 功能开关：四个入口可独立关闭，全部关闭时不显示工具栏。
5. Background 返回状态：配置型入口只有明确成功后才提示打开配置；失败不能显示成成功。

## 设计参考

- Gmail Snooze、Slack Later 都强调“先从当前消息流移出，再在明确时间回到可处理列表”。
- Gmail Snooze 和 Slack Later 的桌面入口都从消息/邮件 hover 后直接出现操作按钮；本功能工具栏使用 4 秒停留作为明确意图判断，避免扫过消息时打扰阅读。
- Slack / Teams 的消息动作也会落在可展开的 more actions 路径里；本功能的 reaction bar 展示入口收敛为消息 hover 4 秒，不再把点击消息或键盘聚焦消息卡片作为展示条件，避免阅读、选中或复制消息时误弹出。
- 2026-06-22 针对消息工具栏设置的检查补充：Gmail Hover actions 是本地显示偏好，Teams 从消息创建任务 / workflow 仍要进入配置并确认目标位置，Human-AI interaction guidelines 也强调状态反馈、用户控制和可恢复性。Personal AI 因此把长悬停齿轮明确成“本地显示开关”：关闭入口只隐藏本浏览器消息旁按钮，不会取消已创建的 Snooze、Watch、Followup、自动答复规则或联动操作；已排队或已保存事项仍回各自管理页处理。
- Slack Later / Reminders 和 Microsoft Teams 定时消息都强调创建后的管理能力：可回到统一列表完成、编辑、重排期或删除；本功能创建提醒后会给出「撤销」和「管理」入口，可就地取消误触的新提醒，也可跳转到定时消息管理器的 Snooze 类别视图。
- Slack Later 对同一保存项支持修改提醒时间，而不是为同一消息堆积多个提醒；本功能会用原消息链接识别仍待处理的同源 Snooze，再次设置时更新原提醒的时间和内容。
- 2026-06-13 针对 Glip AI 标注的检查补充：Slack Later 把保存项和提醒集中到 Later，并能跳回原消息；Gmail Snooze 会把邮件临时移出 inbox，但保留 Snoozed 视图；Teams Recap 把 AI follow-up tasks 锚在会议聊天/Recap 里；MobileHCI 2018 的 Snooze 研究也说明短延后、下班前和次日早上这类日常节奏很重要。Personal AI 因此既要在原消息旁显示“已经被接管”，也要保证标注角标在键盘 focus 和 hover 时都能看到完整标注来源、缓存刷新时间和本地快照边界。
- 2026-06-22 针对 Glip AI 标注的检查补充：同一个消息旁可能同时出现 Snooze、Outreach 和 Scheduled Messages 日志。角标不能只显示“AI 标注”，还要在 tooltip / `aria-label` 里说明这是待处理队列、等待原线程回复、已发送追问事件，还是成功执行日志，避免用户把历史投递日志误读成仍在排队，或把待处理 Snooze 误读成已完成提醒。
- MobileHCI 2018 的 Snooze 研究显示，短延后（如 30 分钟 / 1 小时）和具体时间点（如下一个整点、当天晚上）都很常见；Android 原生通知 Snooze 也提供 15 分钟、30 分钟、1 小时、2 小时这类短选项。当前快捷项优先覆盖 15 分钟、30 分钟、1 小时、2 小时、3 小时、下个整点、工作日下班前、下个工作日早上和不重复时的下周一。
- Snooze 快速菜单提供常驻「列出已设置的提醒」入口，避免用户错过成功 Toast 后找不到统一管理列表。
- Snooze 快速菜单的普通选时视图显示「提醒时间口径」：本次点击会创建到哪个目标时间、只有点击具体时间后才写入 Scheduled Messages、不会发送消息/标记已读/完成原消息；提醒成功后的原消息标注仍等后台 marker 同步刷新。已有同源 Snooze 时则显示「改期预览」。
- 如果原消息本地 marker cache 已显示仍有待处理 Snooze，Snooze 快速菜单会在时间选项前显示「改期预览」：先显示当前本地「稍后 / Remind」标注，再说明本次点击会改期同源 Snooze、不会新增第二条；英文界面会把旧缓存里的中文 `稍后` 标签显示成 `Remind`，但这个预告仍只读本地 marker 快照，并会说明该快照是 fresh、可能过旧还是尚未刷新，真实状态以 Scheduled Messages 管理页和后台同步为准。
- 2026-07-05 补充：已有同源 Snooze 时，改期预告会同步显示本次快捷项将改到的目标时间；用户 hover、键盘聚焦或点击不同快捷项时，这个目标时间跟随菜单里的实时预览刷新，避免只看到旧提醒时间。
- 为避免用户连点或多个入口同时触发造成重复提醒，Snooze 在前端和 Background 都会用原消息链接 / 群组消息 ID 做同源 pending 保护；同源请求未完成前，后续请求不再进入 Google Sheets 创建流程。
- Snooze 创建成功后，成功 Toast 是“已写入/已改期”的即时回执，并会说明原消息标注仍要等后台 marker 同步刷新，当前页面可能短暂显示旧的本地快照。原消息最终会跟随统一 Glip AI 标注显示「稍后处理」状态；成功 Toast 的「管理」会带上本次提醒 ID，直接打开定时消息管理器里的对应行，避免用户在 Snooze 列表里重新搜索。
- 2026-06-21 针对 Snooze 撤销路径的检查补充：Slack Later/Reminders 保留统一 Later 管理页，Gmail Snooze 保留 Snoozed 视图，MobileHCI Snooze 研究强调延后通知要能安全找回和再处理。Personal AI 因此在撤销成功后说明只删除这条未完成 Snooze，不删除原消息、其他定时消息或改写记忆；撤销失败时保留「管理」入口定位该提醒，避免用户误以为旧 Toast 已经删除了最新改期的提醒。
- 配置型入口（关注后续 / Watch、自动答复 / Reply、跟进追问 / Followup、联动操作 / Openclaw）打开的是记忆入口规则的任务态外壳，只保留本次要配置的这一条规则；外壳形态由入口意图决定，而不是由页面在信息架构里的位置决定。点击后会进入短暂 pending 状态，并等待 Background 明确返回成功后才提示正在打开配置，避免失败时给出误导性成功反馈或重复打开多个配置窗口。其中 Watch、自动答复和联动操作入口的成功回执都会明确说明当前消息尚未开始关注/发送/执行、未创建规则或 RuntimeAction，只有保存规则后才会按对应口径执行。自动答复不会在 AI 生成失败且没有固定文本时写入默认短句，而是跳过本次队列创建。
- 联动操作从消息入口进入时，配置页会先展示触发消息上下文：会话、发送人、原消息时间、消息 ID 和安全原消息链接。用户应能在写动作描述前确认“这条规则将被哪类消息触发”，而不是只看到一段 AI 生成动作。
- 从联动操作入口保存规则后，页面会给出保存边界回执：这只是保存规则草稿，不会立刻回扫历史消息、创建 RuntimeAction 或调用 OpenClaw；只有后续新消息命中规则后才会进入动作队列，并按 OpenClaw 连接状态和审批设置继续。
- Snooze 创建中会把快捷菜单标记为 busy 并禁用菜单项，避免鼠标或键盘重复触发；自定义时间选择器打开后会把焦点移到日期时间输入框，返回快捷菜单时恢复菜单焦点。
- 隐藏后的工具栏和长悬停设置按钮会退出键盘 Tab 顺序；只有当前可见的操作按钮可聚焦，避免用户 Tab 到不可见控件。
- 跟进追问参考 Boomerang / Superhuman 的 “if no reply” 跟进模型，但比单纯计时提醒多一层信息目标判断：系统先检查是否已有回复满足完成标准，未命中才继续追问；同一条消息已存在跟进时不会重复创建。
- Teams Recap / Facilitator 把 follow-up tasks 放在可复核、可同步的任务路径里；本功能仍保持轻量弹窗入口，但会在创建前说明跟进范围、下一次检查语义和是否复用已有 session。
- Teams thread notifications 和 Slack message reminders 都把动作锚定在原始消息/线程上；关注后续的配置预填也必须保留原消息时间、链接和群组范围，后台请求新鲜度另用 `requestedAt` 判断，避免把“点击配置的时间”误显示成“原消息时间”。
- 2026-06-20 针对关注后续的检查补充：Microsoft Teams Followed threads 把自动/手动 follow、未读过滤和集中管理放在一起；Slack message reminders 从原消息创建并在指定时间提醒；多方聊天线程检测研究说明 reply/thread/context 关系需要显式消歧；AI-powered reminders 研究也强调 extracted commitment、提醒投递和任务完成不能混成同一个状态。Personal AI 因此在 Watch 保存前显示监听期限和匹配路线，并在保存后区分原消息索引是否已确认。
- Gmail / Google Chat Smart Reply 和 Outlook Suggested Replies 都把生成文本作为可编辑建议，不会绕过用户发送动作；Intercom Fin 的 human-in-the-loop procedure 也会把高风险步骤交给 teammate 审核。自动答复因此在配置页直接展示发送口径：是否下一分钟直接发送、是否延迟可拦截、是否只进待审核列表，以及每次是否重新 AI 生成。
- 2026-06-19 针对自动答复配置页的检查补充：Google Agent Assist Smart Reply 把建议展示给 human agent，Outlook Suggested Replies 仍需要用户选择/发送且移动端可先编辑，Fin Procedures 强调确定性控制和上线前模拟，Human-AI bias 研究提醒 AI 建议会锚定人的判断。Personal AI 因此在自动答复表单内补充“规则边界”回执，把命中范围、保存规则的非即时副作用、以及后续创建 `Active` / `PendingReview` 队列行的路径放在用户保存前可见的位置。

## 功能开关

在插件的设置页面（Options）中，可以独立开启或关闭这四个功能：

| 配置项                 | 说明                 | 默认值 |
| ---------------------- | -------------------- | ------ |
| `ENABLE_SNOOZE`        | 启用「稍后处理 / Remind」功能 | `true` |
| `ENABLE_FOLLOW_THREAD` | 启用「关注后续 / Watch」功能 | `true` |
| `ENABLE_AUTO_REPLY`    | 启用第三入口：别人消息为「自动答复 / Reply」，自己消息为「跟进追问 / Followup」 | `true` |
| `ENABLE_LINKED_ACTION` | 启用「联动操作 / Openclaw」功能 | `true` |

- 如果四个功能都关闭，消息上将不会显示交互工具栏
- 如果只开启其中部分功能，工具栏只显示对应的按钮，顺序保持不变
- 当前 RingCentral 页面会监听 Options 中四个开关的变化：如果页面加载时四个入口全关，之后重新开启任一入口，当前会话页无需刷新也会恢复工具栏；再次全关时会隐藏已有工具栏和浮层。

---

## 工具栏结构

鼠标在消息上停留 4 秒后显示工具栏；点击消息、选中消息文本或键盘聚焦消息卡片都不会直接显示 reaction bar。功能按钮顺序固定为：

1. **稍后处理 / Remind**：中文常态显示「稍后」，英文显示 `Remind`；点击或 hover 展开快速菜单，选择具体提醒时间后创建提醒
2. **关注后续 / Watch**：紫色按钮，打开关注后续规则配置
3. **自动答复 / Reply** 或 **跟进追问 / Followup**：别人发送的消息显示自动答复 / Reply；自己发送的消息显示跟进追问 / Followup，不再显示自动答复。跟进追问依赖主动询问引擎和 RingCentral token；未开启或未配齐时按钮仍显示，但呈灰色 `is-setup-needed` 状态，hover / 读屏说明缺的是引擎还是 token，点击只打开 Options「主动询问」配置，不会创建 session 或发送追问
4. **联动操作 / Openclaw**：红色按钮，打开“记忆入口规则”弹窗并预填一条带“联动操作”的规则
5. **PAI 图标**：视觉标识
6. **齿轮设置**：工具栏再长悬停约 1.4 秒后出现，可快速开关四个入口

中文功能按钮 DOM 中保留完整四字文案，但常态宽度只露出两字短标识：稍后处理显示「稍后」、关注后续显示「关注」、自动答复显示「答复」、跟进追问显示「跟进」、联动操作显示「联动」。英文界面使用完整按钮名：`Remind`、`Watch`、`Reply`、`Followup`、`Openclaw`，按钮宽度按当前语言动态计算。工具栏右侧锚定在 Personal AI 图标上，按钮 hover、键盘 focus 或 Snooze 快速菜单打开时只通过正常布局宽度向左展开并推开左侧相邻按钮，不使用覆盖层，也不移动最右侧图标；其中中文「自动答复」使用末端紧凑对齐，在两字裁剪窗口中露出末尾的「答复」。

工具栏按钮和 Snooze 快速菜单项使用可聚焦的原生 `button` 元素，保留 `aria-label`、悬停提示和键盘焦点样式；每个快捷时间项、自定义时间和管理入口的 hover / 读屏文案都说明这次点击会创建、改期、只打开选择器还是只打开管理视图。隐藏工具栏时会同步 `aria-hidden` 和按钮 `tabIndex`，避免不可见按钮留在键盘焦点顺序中。工具栏出现后，按钮 focus、按钮 hover 或 Snooze 快速菜单打开时只通过正常布局宽度向左展开；在工具栏按钮上按 Esc 会隐藏工具栏。Snooze 快速菜单只会在鼠标仍停留在稍后处理按钮上时完成展示，避免消息信息异步提取较慢时，用户已经离开按钮但菜单又延迟弹出；键盘用户也可以在稍后处理按钮上按 `ArrowDown` 打开菜单，并在菜单内使用方向键、Home/End 和 Esc 完成选择或关闭。自定义时间选择器的返回入口也是原生按钮，方便键盘用户退回快捷菜单。

长悬停齿轮打开的设置弹窗会先显示「本地显示开关」回执：这些开关只改变当前浏览器消息旁工具栏按钮显示；不会取消已创建提醒、关注、追问、自动答复规则或联动操作；已排队或已保存的任务仍从各自管理页处理。弹窗还会随勾选状态实时显示「保存后」入口预览：如果四项全关，保存前就说明会隐藏本地消息工具栏，但已创建事项不受影响。保存成功 Toast 也保留同一边界，避免用户把“隐藏入口”误解成“清理或取消已接管事项”。弹窗跟随界面语言显示，英文界面不再混入中文设置项。

Remind 快捷时间菜单和自定义时间选择器跟随界面语言：中文显示「15 分钟后」「今天下班前」「自定义时间」「请选择未来时间」等文案；英文显示 `In 15 minutes`、`Today by EOD`、`Custom time`、`Choose a future time` 等文案。时间预览同样本地化，中文使用「明天 09:00 / 周一 09:00」，英文使用 `Tomorrow 9:00 AM / Mon 9:00 AM`。菜单顶部回执在中英文下都会保持标签和说明分列可扫读，避免 `Writeback` / `Cache basis` 这类英文标签挤压说明文本。

多个入口在视觉上以连续分段控件呈现；齿轮设置入口默认不占据分段控件宽度，只在长悬停后作为工具栏左侧的独立小按钮出现，避免短悬停时看到一段不可点击的空位。当用户点击创建、关闭浮层或点击页面其他区域后，仍在等待消息信息提取的旧 Snooze 菜单请求会被取消，避免操作完成后又弹出过期菜单。成功或失败 Toast 会在窄屏下自动换行，避免较长提醒时间或“管理”入口被挤出屏幕。

---

## 自动答复 (Reply)

### 功能说明

自动答复功能允许用户配置规则，当消息匹配特定条件时，系统自动生成并发送回复消息。

### 触发方式

- **定时消息分析**：在定时分析消息时（非实时），检测到匹配规则后触发
- 触发后将消息添加到定时消息队列执行

### 匹配条件

| 条件       | 说明                       |
| ---------- | -------------------------- |
| 匹配发送人 | 筛选特定发送者的消息       |
| 匹配群组   | 筛选特定群组的消息         |
| 匹配内容   | 基于语义相似度匹配消息内容 |

### 答复模式

| 模式     | 说明                                        |
| -------- | ------------------------------------------- |
| 直接发送 | 匹配后立即执行发送（下一分钟）              |
| 延迟拦截 | 设置延迟时间（如 X 小时后发送），期间可拦截 |
| 仅审核   | 添加到待审核列表，需手动批准后发送          |

配置页会在模式选择下方显示一条“发送口径”回执，把实际发送时间、审核/拦截路径、AI 生成方式和失败 fallback 合并说明；延迟拦截时间统一限制在 1 到 72 小时，旧数据或导入配置超出范围时按边界值执行。进入定时消息管理器后，`PendingReview` 自动答复行会继续显示“自动答复审核”回执：批准前直接露出当前正文、原排期和执行方式快照；批准会把当前行改为 `Active` 并排到下一分钟发送当前正文；拒绝只把当前行标为 `Done`，不会删除触发规则或改动原消息。批准/拒绝完成后页面顶部保留对应结果回执和点击时正文快照，避免用户只能从行状态变化或控制台日志推断发生了什么。

自动答复配置块和规则列表会显示“内容就绪”回执：固定回复为空且未开启 AI 生成时标为未就绪，说明后续命中只会跳过自动答复入队；开启 AI 生成但没有固定文本时标为无固定 fallback，说明生成失败或空文本会跳过；有固定文本时则在列表展示当前草稿或 AI fallback。

自动答复配置块还会显示“自动答复规则边界”回执：先列出当前规则的发送人 / 群组命中范围；再说明保存规则只影响后续分析的新消息，不会回扫历史消息、不会把草稿插入 RingCentral、也不会立即向任何人发送；最后按当前模式说明后续命中会创建 `Active` 队列行、延迟可拦截队列行，或只创建 `PendingReview` 待审核行。

自动答复新建 / 编辑表单的最终保存按钮也会把同一边界镜像到 hover 和读屏文案：当前命中范围、保存后只影响后续新消息、直接发送 / 延迟 / 仅审核路径、内容是否就绪，以及未就绪时只跳过自动答复入队；普通规则保存按钮不受影响。

消息分析完成后的“本轮分发回执”会把自动答复拆成“入队”和“未入队”两类：命中规则但因定时消息未初始化、同一消息已有历史、AI 生成失败且没有固定文本、固定文本为空或队列创建失败而跳过时，会显示未入队数量和补充说明；这只是本轮聚合回执，不会重跑分析或补发回复。

### 答复内容生成

- **AI 生成**：勾选"每次 AI 生成类似答复"后，每次由 LLM 根据模板风格动态生成；如果生成失败且固定文本非空，会用固定文本入队；如果生成失败或生成空文本且没有固定文本，则跳过本次自动答复，不写入默认短句
- **固定文本**：不勾选时，使用用户编辑的固定回复内容；固定文本为空会跳过本次创建，不入队空回复
- **标题容错**：如果 LLM 分析摘要为空，自动答复定时消息标题会回退到原消息内容，避免创建流程被空摘要阻塞

### 配置入口

1. **关注主题管理** (`topic-modal.tsx`)：添加关注项时勾选"自动答复"
2. **消息交互工具栏** (`message-reaction/MessageReactionUI.ts`)：点击"自动答复 / Reply"按钮快速配置

从消息工具栏点击自动答复只打开配置窗口，不会直接发送或创建规则；成功 Toast 会保留这个边界，避免用户把 `Reply` 按钮误解成“一键代发”。真正的发送口径仍以后续配置页里选择的直接发送、延迟拦截或仅审核模式为准。

从消息工具栏进入配置页时，新增规则表单会先显示“正在准备自动答复草稿”回执：它说明来源消息、规则尚未保存、不会插入 RingCentral 输入框、不会发送消息，也不会创建定时消息队列行。AI 草稿生成失败时页面保留“草稿建议未生成”失败回执和重试入口；用户仍可手动填写固定回复，保存前不会影响后续消息。重试或生成成功后，页面才显示“草稿建议已填入”，提醒用户继续复核文本和发送口径。

### 核心数据结构

```typescript
interface AutoReplyConfig {
  enabled: boolean; // 是否启用
  replyContent: string; // 回复内容模板
  useAIGenerate: boolean; // 是否每次 AI 生成
  reviewMode: 'immediate' | 'delayed' | 'manual'; // 审核模式
  delayHours?: number; // 延迟小时数（delayed 模式）
}

interface TopicItem {
  // ... 其他字段
  filterSender?: string; // 匹配发送人
  filterGroup?: string; // 匹配群组
  autoReply?: boolean; // 是否启用自动答复
  autoReplyConfig?: AutoReplyConfig;
}
```

### 消息状态

自动答复生成的消息使用 `PendingReview` 状态，与普通的 `Paused` 状态区分，便于在定时消息管理器中过滤审核。

---

## 跟进追问 (Followup)

### 功能说明

跟进追问只出现在当前用户自己发送的 Glip 消息上。点击后打开轻量弹窗，用户确认后在 memory-service 创建一次性 Outreach session，不写入 Google Sheet，也不创建 Outreach template。

如果 Options 里尚未启用主动询问引擎，或 RingCentral Server URL / Client ID / Client Secret / JWT 未配齐，工具栏上的「跟进追问 / Followup」按钮会变成灰色待配置状态，而不是直接消失。hover 和读屏会说明缺的是引擎开关还是 token；点击会打开 Options 的主动询问配置，并提示这次点击没有创建跟进会话、也没有发送消息。Memory Service 暂时读不到配置时同样走这条引导，不会假装可以创建。

到点发出的 AI 追问会直接发送原问题正文，作为当前线程里的一条普通回复，不加 `Follow-up:` 这类机器前缀。

### 弹窗交互设计

| 字段                     | 展示方式           | 说明                                     |
| ------------------------ | ------------------ | ---------------------------------------- |
| 原消息预览               | 折叠 `<details>`   | 默认收起，点击展开查看                   |
| 追问的信息目标 / 完成标准 | 必填 textarea，置顶 | 用户必须填写，空提交时高亮提示并聚焦；后续用来判断回复是否满足目标 |
| 跟进范围                 | 只读短行           | 始终展示当前会话；若消息里有 @ 人，会以“会话（提及某人）”显示，避免误解成私聊追问 |
| 追问间隔 / 最多追问次数  | 折叠"更多选项"     | 默认收起，一般无需修改                   |

### 默认配置

| 字段       | 默认值                         |
| ---------- | ------------------------------ |
| 原消息预览 | 当前消息内容（折叠展示）       |
| 跟进范围   | 当前会话；若能识别 @ 人则展示为“会话（提及某人）” |
| 追问间隔   | 24 小时（折叠在更多选项中）    |
| 最多追问   | 1 次（折叠在更多选项中）       |
| 信息目标   | 必填，自动聚焦                 |

提交前会把追问间隔限制在 1 到 720 小时，最多追问次数限制在 0 到 10 次；`0` 次是只检查完成标准、不自动发送 AI 追问的监控模式。创建失败会在弹窗内保留错误提示并允许用户直接重试。

弹窗会根据原消息时间、追问间隔和最多追问次数显示执行口径：如果原消息已经超过间隔，创建后会立即检查当前会话是否已有满足目标的回复；如果还没到间隔，则显示预计检查时间；最多追问次数为 `0` 时，摘要会明确说只检查完成标准，不自动发送 AI 追问。提交按钮显示为「创建跟进」，避免把创建 Outreach session 误读成马上追问。提交后状态行会先切换为「正在创建或复用跟进会话」回执，说明此刻不会发送追问、不写 Google Sheet、不创建可复用 Outreach template；若本次设置为 `0` 次追问，也会继续提示不会自动发送 AI 追问。成功后才会检查原消息线程并刷新本地跟进标注。重复对同一条消息提交跟进追问时，后端返回已有 session，前端提示不会覆盖原目标，并在可用时带出原 session 的完成标准，避免用户误以为刚输入的新目标已经保存。

弹窗提交前还会显示「创建边界」回执：这次跟进只锚定当前会话和原消息，创建后先检查原消息线程是否已有满足完成标准的回复，未命中才按间隔和追问次数处理；点击不会立刻发送新消息，不写 Google Sheet，也不会创建可复用 Outreach template；同一原消息已有跟进时会复用旧 session。提交按钮的 hover / 读屏文案会同步当前跟进范围、检查时间、最多追问次数和同一创建边界；当用户把最多追问次数改为 `0` 时，按钮口径也会明确这是只检查完成标准、不自动发送 AI 追问。

创建成功或复用已有 session 后，Toast 会提供「查看追问」入口，直接打开对应 Outreach session 详情；如果响应里缺少 session id，则退回到 Outreach 会话列表并筛选 message reaction 来源。成功回执会明确说明只是创建了跟进会话，未立刻发送新追问，会先检查原消息线程；如果后端返回下一次检查或最早追问时间，也会直接显示在 Toast 里。最多追问次数为 `0` 时，Toast 会把后续动作写成再次检查，而不是“后追问”。复用已有 session 时，Toast 会继续说明当前输入没有覆盖旧的信息目标。Outreach 列表和详情页会把这类来源显示为「消息跟进」，并在安全的 `http(s)` 原消息链接存在时提供「打开原消息」入口，避免用户把它误解成普通手动/定时询问。

### 创建语义

确认后调用 `POST /api/v1/outreach/sessions/from-message`：

请求基址与 Options 中「记忆服务 API 地址」显示的当前构建默认值保持一致；用户尚未保存 `envConfig` 时也不会另行回退到 `localhost:3210`。保存自定义地址后，后台单例客户端会立即切换到该地址。

- `originKind = message_reaction`
- `status = waiting_reply`
- `renderedQuestion = 原消息内容`
- `sentChatId = 当前 chat/group id`
- `sentPostId = 原消息 post id`
- `createdAt = 原消息时间`
- `waitUntil = 原消息时间 + followupInterval`
- `nextCheckAt = now`
- `followupCount = 0`
- `informationGoal/context = 用户填写的信息目标`

后续回复检测、追问前预检、AI 追问发送和超时升级继续复用 Outreach 现有运行逻辑。`context/renderedContext` 在 API 和存储层保留兼容，但产品语义是“信息目标 / 完成标准”：planner 只有在证据明确满足该目标时才把会话判定为 `complete/resolved`；只拿到部分线索、摘要里仍有“尚未/缺少/没有明确回复”等缺口时继续等待或追问。

在主动询问视图里，`message_reaction` 来源可以单独筛选。等待回复阶段的说明会强调这不是重新发出一条新问题，而是基于原消息先查当前会话回复；只有未满足完成标准时才继续追问。

结案 Bot 回执（拿到结果、超时或升级）会写明这次有没有发生追问；若发生过，回执里带「查看追问消息」的 RingCentral 直达链接。回执同时带继续追问标记：在 Bot 消息上可以直接设置下次间隔和次数，或打开主动询问会话详情的继续追问表单。这条路径不会重发原问题，提交后先等待间隔，到期才在原帖 bump。

---

## Glip AI 标注

Glip 消息标注统一通过 `chrome.storage.local.glipMessageMarkers` 缓存驱动，结构为 `chatId -> postId -> markers[]`。content script 在初始化、marker cache 更新、DOM mutation、页面可见性变化和聊天切换时只读取本地缓存并做 `chatId + postId` 精确匹配，不对每个聊天会话发远端请求。

后台负责刷新缓存：

- 从本地 `concernedItems` 派生关注后续 marker
- 从 Sheet 中未完成的 Snooze 定时消息派生原消息 marker
- 从 memory-service 同步 Outreach marker
- 从 Sheet `Logs` 执行结果派生已拿到 `postId` 的计划消息 marker

当前 marker 类型：

| 类型                     | 标签     | 来源                       |
| ------------------------ | -------- | -------------------------- |
| `follow_thread_original` | 关注后续 | 本地关注后续配置           |
| `follow_thread_related`  | 关联     | 本地关注后续关联消息       |
| `snooze_pending`         | 稍后 + 到期时间 | Sheet 中仍未完成的 Snooze 定时消息 |
| `outreach_initial_ask`   | 跟进中   | message reaction Outreach  |
| `outreach_followup`      | AI追问   | Outreach 追问发送事件      |
| `scheduled_asme`         | AI代发   | Logs 中带 postId 的 AsMe 执行结果 |
| `scheduled_bot`          | AI推送   | Logs 中带 postId 的 Bot 执行结果 |
| `scheduled_ai_report`    | AI报告   | Logs 中带 postId 的 AI/JiraAutomation 执行结果 |

Snooze marker 在有排期时直接显示紧凑到期时间，例如 `稍后 5/18 09:00`，tooltip 继续保留完整提醒时间和来源。这样用户回到原消息上下文时不用再 hover 或打开管理页才能确认提醒是否仍在队列里。同一条消息命中多个非关注后续 marker 时，页面角标显示最高优先级标签和 `+N` 数量；hover 或键盘 focus 会展开全部 marker 明细，避免「跟进中」遮住同时存在的 Snooze 或计划发送回执。这个处理参考 Slack Later / reminders 和 Gmail Snooze 的可见状态路径：用户回到消息上下文时应能立刻判断消息已经被系统接管，并能用键盘查看完整来源。

当同一条消息有多个普通 AI 标注时，tooltip 和 `aria-label` 会补充「角标显示 / Badge scope」回执，说明当前角标优先显示哪一项、`+N` 折叠了哪些状态，并明确这只是本地展示顺序，不代表折叠项已经完成或被忽略。

关注后续原消息和关联消息虽然沿用更醒目的眼睛/关联样式，但交互语义也必须和普通 AI 标注一致：页面上是可聚焦 `button`，保留 `aria-label` 和 title；hover 或键盘 focus 都会展开 tooltip。tooltip 与按钮文案同样显示角标折叠、状态口径、下一步、标注来源、缓存刷新和本地快照边界，所以 Watch 样式不会把同条消息上的 Snooze / Outreach / 执行日志状态藏成纯装饰。

普通 AI 标注的 tooltip 和 `aria-label` 还会显示一条轻量回执：这组标注来自哪些来源（本地关注配置、Sheet 排期/执行日志或 Memory Service 跟进）、本地缓存上次刷新时间，以及“本地标注快照，不代表实时远端查询”的状态边界。若 marker cache 超过 30 分钟未刷新，回执会提示缓存可能过旧，并在 badge 上额外显示 `旧` / `old` 小标记；缺失刷新时间时显示 `待刷` / `sync?`，让用户第一眼就知道这不是刚刚确认过的远端状态。Remind 创建成功 Toast 也会同步提示“原消息标注会随后台同步刷新”，避免用户把刚写入队列后的短暂无角标误读成失败。这样用户从原消息回看时能判断“这条消息曾被系统接管”，但不会把角标误读成刚刚完成的远端状态检查。

兼容旧缓存时，`updatedAt` 可以是当前毫秒时间戳，也可以是历史秒级时间戳；展示前会统一规范化，避免 tooltip / `aria-label` 把秒级缓存误显示成 1970 年或错误判成过旧。缺失或非法时间仍降级为“尚未刷新”，并保留本地快照边界。

2026-06-22 状态口径补齐：普通 AI 标注的 tooltip / `aria-label` 现在还会按 marker 类型汇总 `状态口径`。`跟进中` 表示等待原消息线程或下一次 Outreach 检查，不代表已经发送新追问；`稍后` 表示仍在 Snooze 队列，完成、改期或删除以 Scheduled Messages 为准；`AI追问` 表示已记录一次追问发送事件；`AI代发`、`AI推送`、`AI报告` 来自成功执行日志，表示对应投递已经发生，不是待发送队列。多 marker 同时存在时，这些口径会合并展示，和来源 / 缓存刷新一起构成完整本地快照回执。

2026-06-30 下一步路径补齐：普通 AI 标注的 tooltip / `aria-label` 还会按 marker 类型汇总 `下一步`。Snooze 会指向 Scheduled Messages 的 Snooze 列表，Outreach 跟进会指向主动询问会话，计划消息执行日志会指向 Scheduled Messages 日志核对，关注后续 marker 会指向关注后续管理页。这个字段只是恢复/复核路径提示，不会从 RingCentral 页面发起实时远端查询，也不会自动完成、改期、删除或发送消息。

2026-06-26 英文界面补齐：当 RingCentral 内容脚本运行在英文界面时，普通 AI 标注的 badge 标签、tooltip 标题、`aria-label`、状态口径、来源和缓存刷新标签会切到英文；Snooze 紧凑时间仍沿用同一时间值，只把 `稍后` 展示为 `Remind`。缓存边界语义不变，仍说明这是本地 marker 快照，不是实时远端检查。

计划消息创建时还没有 RingCentral `postId`，不会立刻标注。发送成功后，Jira rule 将 `chatId/postId/sentAt` 或紧凑的 `sentPayload` 传给 AppScript `markBotMessageExecuted`，AppScript 写入 `Logs` 的 `Sent_Chat_ID` / `Sent_Post_ID` / `Sent_At`；后台下次刷新 Sheet 后写入本地 marker cache。邮件 fallback 没有可靠 `postId`，不参与 Glip marker 标注。

---

## 稍后处理 (Remind)

### 功能说明

稍后处理功能允许用户在浏览消息时快速设置提醒，系统会在指定时间通过 Bot 推送提醒消息，帮助用户跟进重要信息。

### 触发方式

- **悬停触发**：在 RingCentral 消息页面，将鼠标悬停在任意消息上短暂停留后，自动显示浮动工具栏
- **菜单触发**：点击或悬浮「稍后处理 / Remind」按钮会先展开快捷菜单，再由用户选择提醒时间
- **排除规则**：Reply 输入框不会显示工具栏
- **功能开关**：需要在设置中启用对应功能，否则不显示工具栏或对应按钮

### UI 结构

工具栏中和稍后处理相关的元素如下：

| 元素         | 功能                                                                |
| ------------ | ------------------------------------------------------------------- |
| 稍后处理 / Remind 按钮 | 蓝色闹钟 icon 按钮，点击或悬浮显示快速选项菜单，避免误触时直接创建提醒 |
| PAI 图标     | 视觉标识，不可点击                                                  |

### 快速选项

点击或悬浮"稍后处理 / Remind"按钮时显示快速选项菜单：

| 选项         | 提醒时间                             |
| ------------ | ------------------------------------ |
| 15 分钟后 / In 15 minutes | 当前时间 + 15 分钟 |
| 30 分钟后 / In 30 minutes | 当前时间 + 30 分钟 |
| 1 小时后 / In 1 hour | 当前时间 + 1 小时 |
| 2 小时后 / In 2 hours | 当前时间 + 2 小时 |
| 3 小时后 / In 3 hours | 当前时间 + 3 小时 |
| 下个整点 / Next full hour | 下一个整点；若和短延后选项落在同一分钟则隐藏 |
| 今天/明天/周 X 下班前 / Today/Tomorrow/Wed by EOD | 最近一个工作日 18:00，若当天已过或遇周末则跳到下个工作日 |
| 明天/周 X 9 点 / Tomorrow/Wed 9 AM | 下个工作日 09:00，避免周末工作消息提醒落到休息日 |
| 下周一 9 点 / Next Mon 9 AM | 下周一 09:00；如果和“下个工作日 9 点”是同一时间则隐藏 |
| 自定义时间 / Custom time | 打开日期时间选择器 |
| 列出已设置的提醒 / List Remind | 打开定时消息管理器的 Snooze 类别视图；打开中会防止重复触发 |

快速菜单的普通选时视图显示「提醒时间口径」回执：本次点击会创建到当前预览时间，只有点击具体时间后才写入 Scheduled Messages 的 Snooze 队列，不会发送消息、标记已读或完成原消息；成功后原消息标注仍等后台 marker 同步刷新，当前页面可能短暂显示旧快照。当当前消息的本地 `glipMessageMarkers` cache 已有 `snooze_pending` 标注时，菜单显示「改期预览」：它优先显示已有标注和“本次点击会改到目标时间、仍是同源 Snooze、不新增第二条”的预告；英文界面会把缓存中仍是中文的 `稍后 ...` 标注显示成 `Remind ...`，同时说明它只是本地 marker 快照，真实状态以 Scheduled Messages 管理页和后台同步为准。快速菜单会同时展示预计提醒时间，减少用户点选前的不确定性；用户悬停、键盘聚焦或点击某个快捷项前，菜单会刷新可见时间和无障碍标签，避免菜单长时间打开后“看到的时间”和实际写入时间不一致。每个快捷时间项的 `aria-label` / `title` 也会镜像该项自己的创建或改期边界；「自定义时间」只说明打开选择器，只有确认未来时间后才写入；「管理稍后处理」只说明打开 Snooze 管理视图，不会直接创建、改期、完成或删除提醒。同日提醒会精确显示到小时和分钟，避免自定义时间被粗略显示成错误的整小时。快捷项会按分钟去重，避免“2 小时后 / 3 小时后”和“今天下班前”等入口指向同一个提醒时间。

快速菜单点击时会重新计算所选快捷项的提醒时间，并在创建前统一校验必须是未来时间，避免长时间停留在菜单上后写入已经过期的提醒。

如果用户在本地 marker 快照读取完成前已经离开 Remind 按钮、打开自定义时间选择器或触发了新的菜单请求，旧请求会被丢弃，不会在消息旁重新弹出过期快捷菜单。

同一条消息的 Snooze 创建 / 更新请求会串行化：当前请求仍在处理中时，重复点击或键盘确认不会创建第二条定时消息，也不会弹出额外错误 Toast；界面会显示「提醒处理中」回执，说明这次点击没有创建第二条、没有改期、没有写记忆或发送 Bot 消息，首个请求完成后再显示成功或失败结果。

「列出已设置的提醒」入口也会串行化：点击后菜单显示打开中并禁用其他选项，连续点击只会打开一个 Scheduled Messages Snooze 视图；如果打开失败，焦点留在管理入口并提示可重试。

同源更新只接受能定位到具体消息的 RingCentral 链接或 `groupId + postId`；如果页面 DOM 只能提供会话级链接，则不会用它去匹配旧提醒，避免把另一条消息的 Snooze 静默改期。

新建 Snooze 的成功 Toast 提供「撤销」入口，但撤销只匹配该 Toast 创建时的提醒日期和时间；如果用户随后对同一消息重新安排了提醒，旧 Toast 的撤销请求会被 Background 拒绝，避免误删最新的待处理提醒。Toast 文案会直接说明「可撤销；管理会定位到这条提醒」和「原消息标注会随后台同步刷新，当前页面可能短暂仍显示旧快照」，避免用户把绿色成功提示误解成只能等 Bot 推送，或把短暂无角标误判为没有写入。撤销成功后会显示结果回执，说明只删除这条未完成 Snooze，不删除原消息、其他定时消息或改写记忆；撤销失败时会说明提醒可能仍在 Snooze 队列，并继续提供「管理」入口定位确认或删除。

同源更新不会提供撤销按钮，因为旧提醒已经被改期；成功 Toast 会说明「同一条消息的旧提醒已改期；管理会定位到原提醒」，并沿用相同的 marker 同步边界。新建和已更新提醒的「管理」入口都会把本次提醒 ID 传给 Scheduled Messages 页面，页面用 `messageId` 查询参数只显示并高亮对应行；如果没有拿到 ID，则退回到 Snooze 类别列表并在 Toast 里说明只能打开列表确认。

### 自定义时间选择器

点击"自定义时间"后弹出选择器：

- **日期时间选择**：使用 `datetime-local` 输入框选择本地日期和时间
- **默认时间**：打开时默认填入最近一个未来的工作日 09:00；若当天 09:00 已过或遇周末，则跳到下个工作日，避免周五打开时默认落到周末
- **确认**：只允许选择未来时间，点击确认按钮完成设置

### 工作流程

```
用户点击稍后处理 / Remind 按钮或悬浮稍后处理 / Remind 按钮
         ↓
  展开快速选项菜单
         ↓
用户点击快速选项/确认自定义时间
         ↓
  发送消息到 Background
         ↓
  前置检查定时消息初始化状态
   ├─ 未初始化：显示初始化引导并停止创建
   └─ 已初始化：继续
         ↓
  查找是否已有同源待处理 Snooze
   ├─ 有：更新原提醒的日期/时间/内容，并提示“已更新提醒”
   └─ 无：创建定时消息到 Google Sheets
         ↓
  Toast 显示成功结果；新提醒可点击「撤销」；已更新提醒或需要复核时可点击「管理」打开定时消息管理器的 Snooze 类别视图
         ↓
  [异步] LLM 生成摘要更新 Topic
         ↓
  [异步] 存储到云端记忆系统
         ↓
  到达提醒时间 → Bot 推送消息
```

### 消息信息提取

从消息 DOM 中提取以下信息：

| 字段          | 说明                           |
| ------------- | ------------------------------ |
| `id`          | 消息唯一 ID（从 data-id 属性） |
| `senderName`  | 发送者名称                     |
| `groupId`     | 群组 ID（从 URL 提取）         |
| `groupName`   | 群组名称                       |
| `content`     | 消息内容                       |
| `messageLink` | 消息直链                       |
| `timestamp`   | 消息时间戳                     |

### 提醒消息格式

创建的定时消息包含：

- **Topic**: `稍后处理: {LLM摘要}` （异步生成，默认使用群组名）
- **Content**: 包含原消息摘要、发送者、群组、原消息链接
- **Category**: `Snooze,提醒`
- **Push_Method**: `Bot`
- **Target_Type**: `private`

### 核心数据结构

```typescript
interface MessageInfo {
  id: string; // 消息 ID
  senderName: string; // 发送者
  groupId: string; // 群组 ID
  groupName: string; // 群组名
  content: string; // 消息内容
  messageLink: string; // 消息链接
  timestamp: string; // 时间戳
}

// Background 请求
interface SnoozeRequest {
  type: 'CREATE_SNOOZE_REMINDER';
  data: {
    messageInfo: MessageInfo;
    remindAt: number; // 提醒时间戳
    note?: string; // 备注（暂未使用）
  };
}
```

### 隐藏逻辑

工具栏在以下情况下隐藏：

- 鼠标离开消息区域（除非移动到工具栏/菜单/选择器）
- 成功创建提醒后
- 点击页面其他区域
- 自定义时间选择器支持点击外部或按 `Esc` 关闭

快速菜单会根据屏幕空间在按钮下方或上方展开，并保留鼠标移动缓冲区，避免靠近屏幕底部时菜单刚弹出就消失。

---

## 关注后续 (Watch)

### 功能说明

关注后续允许用户对某条特定消息设置持续监听。当同群组内出现与该消息相关的后续讨论时，系统自动检测并通过配置的渠道（Bot / Chrome 通知）推送提醒，确保用户不错过重要话题的进展。

### 触发方式

- **消息交互工具栏**：将鼠标悬停在消息上，点击"关注后续 / Watch"按钮打开预填配置；按钮 hover / 读屏会先说明这只是打开配置草稿，点击本身不会直接开始关注、保存规则、索引原消息、发送通知或创建其他动作
- **关注主题管理**（`topic-modal.tsx`）：在关注项编辑界面启用"关注后续"开关，可进行详细配置

工具栏三个配置型入口（关注后续 / 自动答复 / 联动操作）打开的是记忆入口规则的**任务态**（`memory-exploring.html#/memory-entry-rules?surface=task&intent=...`），不是完整的记忆探索页。任务态只渲染任务头和这一条规则的表单：不显示记忆探索侧边菜单、全局搜索头、规则列表，也不显示导出 / 导入 / 立即分析这些列表级动作。这既是为了在 760×780 的配置弹窗里保持页面干净，也是一条数据安全边界——预填草稿在配置页挂载后就从 `chrome.storage.local` 清除，如果侧栏还在，用户点进其他记忆探索页面会卸载表单并永久丢掉原消息、群组和时间预填，只能回到消息重新点一次 Watch。任务头保留两个出口：「在完整记忆探索中打开」在新标签页打开完整规则列表且不影响当前草稿，「关闭」只关掉这个配置窗口且不创建任何规则、通知或动作。保存成功后任务态不会立刻关窗，而是先显示保存回执，再由用户选择「完成并关闭」或「查看全部规则」。详细的表面模式契约见 [message_analysis.md](./message_analysis.md)。

工具栏打开关注后续配置时，Background 会写入 `pendingFollowThreadConfig`：`messageTimestamp` 保存原消息时间，用于配置页的原消息预览和后续存储；`requestedAt` 只用于判断这次打开请求是否仍在 5 分钟新鲜窗口内。配置页默认清空发送人筛选、保留当前群组筛选，让关注规则监听同会话内所有人的后续讨论。Watch 按钮的 `title` / `aria-label`、工具栏 Toast 和配置页顶部都会显示「关注后续创建边界」：打开或编辑表单不会启用 Watch，只有保存后才会创建本地关注规则并索引原消息；保存也不会回扫历史消息、立刻发送通知、立即写入长期记忆、创建自动答复或创建联动操作。创建边界还会显示监听期限，以及后续匹配会优先走 reply / thread / @提及 / 引用 / 关键词，再必要时使用原消息语义匹配。

保存 Watch 规则后的成功 Toast 会区分两层结果：规则是否已保存，以及原消息索引是否已确认。索引已写入时，Toast 说明语义匹配可用；索引未确认时，Toast 会说明本地规则仍会监听后续新消息，reply / thread / @提及 / 引用 / 关键词路径仍会尝试，但语义匹配可能降级。两种成功状态都会重申没有回扫历史消息，也没有立刻发送通知。

关注后续管理页把 `expiredAt` 为空或 `0` 的规则显示为「手动结束」，不会误判为已过期；点击延长时从当前时间或原有未来到期时间继续加 7 天。页面顶部会显示「列表快照回执」：说明当前读取的是 `chrome.storage.local.concernedItems` 本地快照、可见/总手动规则数量、被隐藏的系统 / Outreach 内部 Watch 数量、当前筛选和排序口径，并声明列表读取不会取消、延长、补发通知、回扫历史消息、重新索引原消息、写入长期记忆或发送消息。每条规则会显示「监听状态回执」：说明规则是否仍在监听、已记录多少关联消息、最新关联 / 最新通知时间、通知渠道，以及展开时间线不会补发或重发通知。没有关联消息会显示为“尚未捕获到后续命中”，不是读取失败。状态筛选为空时会显示筛选空结果回执，说明已有手动 Watch 规则被当前筛选隐藏，并提供「查看全部」恢复；切换筛选只改变本页展示，不会取消、延长、补发通知或重新读取远端。命中时间线的每条记录还会显示通知状态：已记录通知时间时明确展示，旧缓存或只有关联记录时则提示以通知渠道记录为准。取消关注会先显示「取消关注待确认」回执，确认前不改本地列表；确认后只删除本地手动规则，不删除 RingCentral 原消息，不补发或撤回通知，也不会立刻清理已写入 Memory Service 的历史索引；旧资料继续按后端遗忘策略处理。管理页整体仍是本机手动 Watch 规则快照，不会回扫历史消息、确认任务完成、发送消息或把关联记录改写成长期记忆。

---

## 联动操作 (Openclaw)

### 命名约定

- 消息悬浮工具栏按钮英文使用 **Openclaw**，中文使用 **联动操作**
- 底层持久化字段仍然使用 `automationPrompt` / `automationRequiresApproval`

### 触发方式

- 在 RingCentral 消息页面悬停一条消息后，点击工具栏里的 **联动操作 / Openclaw**
- Background 会写入 `pendingLinkedActionConfig` 到 `chrome.storage.local`
- 随后打开 `topic-modal.html`
- 工具栏 **联动操作 / Openclaw** 按钮的 hover / 读屏文案会在点击前说明：此点击只打开当前消息的 Openclaw 配置草稿，不会创建 `RuntimeAction`、调用 OpenClaw、回扫历史消息、保存规则或发送内容
- 工具栏成功 Toast 只确认配置入口已打开：当前仍只是草稿入口，尚未创建 `RuntimeAction`、未调用 OpenClaw，也不会回扫历史消息；只有保存规则且后续新消息命中后，才会进入动作队列并按连接状态和审批设置执行
- 手动新建或编辑记忆入口规则时，联动操作区默认折叠；从工具栏联动操作入口进入时会自动展开并进入建议生成流程

### 默认流程

```text
联动操作
  -> topic-modal / 记忆入口规则
  -> 预填一条规则
  -> 默认开启 写入记忆 + 联动操作
  -> 异步生成一条可编辑的联动操作建议
```

### 预填规则

- `text` 默认使用“发送了内容与以下语义相似：...”
- `filterSender` / `filterGroup` 直接带入当前消息上下文
- 不默认开启通知、自动答复、关注后续

### 建议生成策略

- 首选用户已经保存的 `automationPrompt` 历史
- 如果历史不足，则回退到内置样例目录
- 内置样例用作能力护栏，不是最终展示 schema；样例至少包含：
  - `sampleId`
  - `actionFamily`
  - `targetSystem`
  - `canSchedule`
  - `examplePrompt`

当前首批样例覆盖：

- 转发消息给某人
- 给 Jira ticket 加 comment
- 写入表格
- 设置 Glip 状态
- 创建日程 / 提醒
- 通用 OpenClaw 黑盒委派
- 文件 / 附件 / Drive 类任务的 OpenClaw 黑盒委派

这些样例用于帮助生成更具体的自然语言建议，不再作为 planner 的硬白名单。样例选择先看消息里的明确关键词；如果没有识别到 Jira、表格、状态、提醒、附件 / Drive 等目标，会回退到通用 OpenClaw 委派样例，要求先确认目标系统、对象、权限和成功回执，缺关键字段时返回 `need_human_decision` / `capability_missing`，避免把模糊消息误生成 Glip status 之类无关动作。规则命中后，Memory Service 会先尝试内部确定性规划；如果无法内部完成但 `automationPrompt` 非空，会把原消息、消息链接和附件上下文委派给 OpenClaw，让 OpenClaw 在执行阶段返回真实能力状态。

### OpenClaw 禁用态

- 当 `OPENCLAW_ENABLED` 未启用或 `OPENCLAW_BASE_URL` 未配置时，规则页仍允许先填写并保存 **联动操作** 描述，但会以“待激活”状态提示连接前不会执行外部写操作
- UI 会在输入框下方显示连接 CTA，跳转到 `options.html#OPENCLAW_ENABLED`
- 选项页配置完成后，topic-modal 通过 `chrome.storage.onChanged` 实时更新状态；若当前来自联动操作入口且文本仍为空，会自动触发一次建议生成
- 从旧消息点击联动操作时，pending 配置的新鲜度以本次点击时间为准，原消息时间单独保留，避免历史消息被误判为过期而无法预填
- 从消息入口创建草稿时，规则页会展示触发消息面板；其中“本次点击时间”只用于判断配置请求是否新鲜，“原消息时间”只用于用户核对和动作上下文，不混用。
- 规则摘要会把未连接的联动操作标为 **待激活**，不会显示“自动执行”；只有 OpenClaw 已连接时，才按“需批准 / 自动执行”展示真实执行语义。
- 新建或编辑联动操作时，输入框下方会显示保存前执行预览：保存本身只写本机手动规则，不回扫历史消息、不立即创建 RuntimeAction、不调用 OpenClaw；随后按当前连接和审批设置标出 **待激活**、**需批准** 或 **自动执行**。
- 点击「预演并改进」后，规则页会显示 **预演结果回执**：列出本次 dry-run 使用的触发样本、候选动作数量、警告数量、是否可规划和下一步处理。预演只调用 Memory Service 规划接口，不保存规则、不创建 RuntimeAction、不调用 OpenClaw、不发送消息，也不写外部系统。
- 如果自动建议失败，用户仍可直接手写动作描述；手动输入会清掉失败提示，并使仍在飞的自动建议请求失效，避免晚返回的建议覆盖用户文本。
- 点击「确认」保存这条规则时，成功 Toast 会重申三个非效果边界：没有回扫历史消息、没有创建 RuntimeAction、没有调用 OpenClaw。OpenClaw 未连接时显示 **待激活**；已连接时会继续区分「需批准」和「免批准」的后续动作队列语义。

### 执行就绪继承

保存或预演联动规则不会创建 readiness contract。只有后续新消息命中规则并生成 `delegate_openclaw` RuntimeAction 后，真实 dispatch 才继承 [Action Readiness Contracts](./action_readiness_contracts.md)：已知鉴权/能力/输入/proof blocker 会在计次前阻断，缺失 `readinessRequiredInputs` 会本地失败关闭，修复后 probe 也不会携带原消息任务或执行外部写入。当前规则页仍只展示保存/预演边界，contract 的实时状态和重测入口以 Action Queue 为准。

### 关联关系检测

系统按优先级依次尝试以下六种匹配方式：

| 优先级 | 匹配方式          | 判断逻辑                                          |
| ------ | ----------------- | ------------------------------------------------- |
| 1      | **parentId 匹配** | 新消息的 `parentId` 等于原消息 `postId`（最准确） |
| 2      | **线程匹配**      | 新消息与原消息的 `threadId` 相同                  |
| 3      | **@提及匹配**     | 新消息内容中 @了原消息发送者                      |
| 4      | **引用匹配**      | 新消息包含原消息前 50 字符的内容片段              |
| 5      | **关键词过滤**    | 若配置了关键词，新消息必须包含至少一个关键词      |
| 6      | **语义匹配**      | 向量相似度 ≥ 0.7（ChromaDB，最耗时）              |

LLM 在消息分析阶段也会独立识别后续消息，并在 JSON 返回 `follow_thread_info` 字段作为补充。

### 数据流程

```
新消息进入分析流程
        ↓
contentScriptGlip: checkFollowThreadRelation()
（实时检测：parentId / threadId / @提及 / 引用 / 关键词 / 语义匹配）
        ↓
或 LLM 分析返回 follow_thread_info 字段
        ↓
messageDealing.ts: 更新 relatedMessages 记录 + 存储到 ChromaDB
        ↓
NotificationService.sendNotification()
  ├─ Bot 推送：包含原消息预览 + 后续回复内容 + 跳转链接
  └─ Chrome 通知：仅展示 summary，点击跳转原消息
```

### 通知内容

**Bot (Glip) 推送**格式示例：

同一条消息若同时命中多条即时通知规则，`__关注项__` 会换行拼接这些规则；开启了 @我 的规则排在前面并带 `（@提醒）`。LLM 审核不会把这份列表覆盖成单条规则。

```
`Esone Qiu 确认身份定义已完成，询问是否还需补充。`

📌 关注的消息（来自 AI Service）：
> 你是想给我做"身份定义"（也就是：我是谁、你是谁、我们怎么称呼...
🔗 [查看原消息](https://app.ringcentral.com/...)

💬 后续回复：
__关注项__：Personal AI 讨论（@提醒）
AI相关讨论话题,了解下是否有新工具...
__在群__：@esone.qiu+sync.service
__发送者__：Esone Qiu
__时间__：2026-02-04 14:17:47
__原文__：我已经定义完了，还有什么要定义的么？
__回复建议__：...

🔗 [点击查看原消息](https://app.ringcentral.com/...)
```

**Chrome 浏览器通知**：仅展示 `summary`（最多 200 字），点击跳转到原消息链接。

### 通知方式配置 (notifyMethod)

通知方式使用逗号分隔的字符串，支持多选：

| 值             | 说明                     |
| -------------- | ------------------------ |
| `'bot'`        | 仅发送 Bot (Glip) 消息   |
| `'chrome'`     | 仅发送 Chrome 浏览器通知 |
| `'bot,chrome'` | 两者同时推送             |

> 旧版 `pushToGlip: true` 在加载时自动迁移为 `'bot,chrome'`；`pushToGlip: false` 迁移为 `'chrome'`。  
> 新建关注项默认为 `'chrome'`。

### 关注项生命周期

| 阶段       | 说明                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| **创建**   | 在 topic-modal 中配置，或从消息交互工具栏快速添加                                        |
| **监听中** | `expiredAt` 未到期，持续检测后续消息                                                     |
| **延长**   | 在"关注后续"管理界面点击"⏰ 延长"                                                        |
| **到期**   | `expiredAt` 到达后停止匹配，标记为"已过期"                                               |
| **清理**   | 每天凌晨 2:00 执行 `cleanupExpiredFollowThreads()`，同时清理 ChromaDB 中 90 天前的旧数据 |

### 核心数据结构

```typescript
interface FollowThreadConfig {
  originalMessage: {
    postId: string; // 被关注的原消息 ID
    threadId?: string;
    teamId: string;
    teamName: string;
    sender: string;
    content: string;
    datetime: string | number;
    messageUrl: string;
  };
  createdAt: string;
  keywordFilter?: string[]; // 可选关键词过滤
  relatedMessages: RelatedMessageMeta[]; // 已捕获的后续消息记录
  lastCheckedAt?: string;
  lastNotifiedAt?: string;
}

// 后续消息元数据
interface RelatedMessageMeta {
  postId: string;
  sender: string;
  datetime: string;
  relationType:
    | 'thread_reply'
    | 'mention'
    | 'quote'
    | 'semantic'
    | 'direct_reply'
    | 'same_thread'
    | 'semantic_related';
  notifiedAt?: string;
  summary?: string;
}

// 关注项（在 TopicItem 外层）
interface TopicItem {
  notifyMethod?: string; // 如 'bot,chrome'（替代旧的 pushToGlip）
  notifyFrequency?: 'immediate' | 'merged';
  followThread?: boolean; // 是否启用关注后续
  followConfig?: FollowThreadConfig;
  expiredAt: number; // 到期时间戳（统一管理生命周期）
}
```

### LLM Prompt 中的关注规则格式

当关注项在分析 Prompt 中生成时，格式如下（由 `agentThinking.ts` 处理）：

```
规则12 [RULE_ID:11]: 在 esone.qiu+sync.service 中 关于以下内容的后续讨论：
"原消息内容..."

【匹配细节】在 xxx 群组中，检测所有与 post_id="xxxxxx" 相关的后续讨论。
原消息由 "AI Service" 在 2026/2/4 13:59:32 发送。
匹配条件（满足任一）：
(1) reply_to 属性指向 "xxxxxx" 的直接回复
(2) 在同一 <thread> 中且时间在原消息之后的消息
(3) 虽然不在同一 thread，但语义上是在讨论或回应原消息内容的消息
(4) @提及原消息发送者且内容与原话题相关的消息
【注意】排除原消息本身，只识别后续的讨论消息。
```

LLM 返回的匹配结果格式：

```json
"follow_thread_info": {
  "original_post_id": "76751614156804",
  "relation_type": "direct_reply",
  "relevance_score": 0.95
}
```

### 关注后续管理界面

路径：记忆探索页面（`memory-exploring.vue`）→「关注后续」Tab

功能：

- 按状态筛选（全部 / 进行中 / 已过期）
- 筛选为空时显示“当前筛选无结果”回执和「查看全部」恢复入口，避免误读成没有手动规则或读取失败
- 按创建时间、到期时间、关联消息数排序
- 查看原消息内容和已捕获的后续消息列表
- 查看每条规则的监听状态回执，区分成功空结果、已命中、已通知和只读本地快照边界
- 延长关注时间；手动结束规则会从当前时间起新增 7 天，到期规则会从当前时间重新起算
- 取消关注：先在页内确认本地删除范围；确认后删除本地手动规则并停止后续匹配，不删除原消息，也不立刻清理已写入 Memory Service 的历史索引

---

## 相关文件

| 文件                                                 | 说明                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/message-reaction/`                              | 消息交互功能模块                                                         |
| `src/message-reaction/index.ts`                      | 模块入口，导出所有公共接口                                               |
| `src/message-reaction/MessageReactionUI.ts`          | 消息交互工具栏 UI、消息信息提取、功能开关控制                            |
| `src/message-reaction/SnoozeManager.ts`              | Snooze 功能核心逻辑                                                      |
| `src/message-reaction/snoozeTime.ts`                 | Snooze 提醒时间格式化与未来时间校验                                      |
| `src/message-reaction/snoozeCreateResult.ts`         | Snooze 创建结果和错误反馈文案                                            |
| `src/message-reaction/snoozeToastActions.ts`         | Snooze 成功 Toast 的撤销 / 管理动作策略、管理范围和 marker 同步边界回执  |
| `src/message-reaction/snoozeDeduplication.ts`        | 根据原消息链接识别仍待处理的同源 Snooze，避免重复提醒堆积                |
| `src/message-reaction/floatingPosition.ts`           | Snooze 菜单/选择器浮层定位计算                                           |
| `src/message-reaction/messageReactionTiming.ts`      | 工具栏短悬停和长悬停延迟常量                                             |
| `src/message-reaction/AutoReplyHandler.ts`           | 自动答复处理逻辑                                                         |
| `src/message-reaction/autoReplyPresentation.ts`      | 自动答复标题、发送口径、内容就绪和规则边界回执                           |
| `src/messageAnalysisDelivery.ts`                     | 消息分析分发回执；记录自动答复入队 / 未入队计数和补充说明                |
| `src/message-reaction/FollowThreadHandler.ts`        | 关注后续核心逻辑：关联关系检测、ChromaDB 存储、过期清理                  |
| `src/services/NotificationService.ts`                | 统一通知推送服务（Bot / Chrome），替代旧的 `sendBotMessage`              |
| `src/types/followThread.ts`                          | 关注后续功能类型定义                                                     |
| `src/modals/topic-modal.tsx`                         | 关注主题管理：关注后续 + 自动答复 + 通知方式配置 UI                      |
| `src/modals/components/FollowThreads.vue`            | 关注后续管理界面组件                                                     |
| `src/messageDealing.ts`                              | 消息分析主流程，调用关注后续匹配与推送                                   |
| `src/agentThinking.ts`                               | Agent 模式消息分析，生成关注后续规则 Prompt                              |
| `src/contentScriptGlip.tsx`                          | RingCentral 页面内容脚本，初始化消息交互功能                             |
| `src/services/GlipMessageMarkerService.ts`           | 统一生成关注后续、Snooze、Outreach 和计划消息的 Glip 标注缓存            |
| `tools/verify-glip-ai-markers-e2e.mjs`               | 验证 Glip 标注源码合约与键盘 focus 展开路径                              |
| `src/background.ts`                                  | Snooze 请求处理、Chrome 通知点击事件处理                                 |
| `src/bot.ts`                                         | Bot 消息底层发送                                                         |
| `src/scheduled-messages/`                            | 定时消息管理                                                             |
| `src/scheduled-messages/scheduleDateTime.ts`         | 将用户选择的本地提醒日期/时间写入定时消息                                |
| `src/scheduled-messages/scheduledMessagesFilters.ts` | 定时消息页面 URL 查询参数到过滤器状态的解析                              |
| `src/scheduled-messages/ScheduledMessagesUtils.ts`   | 定时消息共用工具                                                         |
| `src/llm.ts`                                         | LLM 调用，`generateAutoReply`、摘要生成                                  |
| `src/utils.ts`                                       | 包含 `ENABLE_SNOOZE`、`ENABLE_AUTO_REPLY`、`LLM_REVIEW_BEFORE_SEND` 配置 |
| `src/options.tsx`                                    | 设置页面，消息交互功能开关 UI                                            |

---

**相关文档**:

- [定时消息管理](./scheduled_messages_manager.md)
- [聊天消息分析入库](./message_analysis.md)

**外部参考**:

- [Slack Later](https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later)：Later 把保存项和提醒集中到 In progress / Archived / Completed，并支持跳回原消息、完成和改提醒时间；Snooze 成功后必须保留可回到统一管理的位置。
- [Slack reminders](https://slack.com/help/articles/208423427-set-a-reminder)：消息提醒可以从原消息创建，并在 Later 里完成、编辑或删除；本功能的 Toast 要把“刚创建/已改期”和“去哪里管理”说清楚。
- [Gmail hover actions](https://support.google.com/mail/answer/2473038)：邮件列表 hover 后展示归档、删除、Snooze 等快捷动作，且可在设置里关闭；工具栏设置应表达为显示偏好，不应暗示已创建事项被取消。
- [Gmail Snooze](https://support.google.com/mail/answer/7622010)：Snooze 会把邮件临时移出 Inbox，并提供 Snoozed 统一视图；Personal AI 不移动 RingCentral 原消息，所以必须通过原消息标注和管理入口弥补可见性。
- [Microsoft Teams create a task from a message](https://support.microsoft.com/en-us/teams/platform/create-a-task-from-a-teams-message)：消息动作进入任务创建后还要填写目标和选项；Personal AI 的消息动作入口也要区分“打开配置”和“已经创建 / 执行”。
- [Microsoft Teams message workflows](https://support.microsoft.com/en-us/workflows/use-workflows-from-a-message-in-teams)：消息级 workflow 从单条消息 More actions 进入，并提供创建、查看和管理路径；本功能设置弹窗也要说明已保存任务仍回各自管理页处理。
- [Microsoft Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/)：指南强调状态反馈、用户控制、谨慎适配和错误恢复；工具栏本地开关要把非效果和后续管理路径前置。
- [Snooze! Investigating the User-Defined Deferral of Mobile Notifications](https://weberdo.com/publications/2018-Snooze-Investigating-the-User-Defined-Deferral-of-Mobile-Notifications.pdf)：研究说明通信类通知常被短延后，用户需要安全地暂时放下又能找回；因此快捷时间、原消息锚点和管理回执都属于核心体验。
- [Coping with Prospective Memory Failures](https://arxiv.org/abs/1601.06230)：提醒系统需要可靠、可适配和符合用户偏好的提醒计划；本功能保持用户主动选择时间，并把后续修改路径放在成功回执里。
- [Slack Workflow Builder](https://slack.com/help/articles/17542172840595-Build-a-workflow--Create-a-workflow-in-Slack)：触发、步骤、变量、权限分开配置，提醒联动操作要把“触发上下文”和“外部执行能力”分清楚。
- [Zapier trigger setup](https://help.zapier.com/hc/en-us/articles/8496288188429-Set-up-your-Zap-trigger)：trigger 需要选择事件、配置字段并测试样本；联动操作的建议生成和 dry-run 预演承担类似的触发样本核对职责。
- [Zapier AI Actions](https://docs.zapier.com/integrations/reference/ai-actions)：自然语言动作可以接入外部自动化平台，但需要保留用户可编辑的动作描述。
- [Zapier Custom Actions](https://help.zapier.com/hc/en-us/articles/16277139110157-Create-a-custom-action)：AI 生成的外部动作仍需要 summary、输入、逻辑、endpoint 和测试结果回执；本功能的预演 / 改进入口应承担同类核对责任。
- [Microsoft Copilot Studio Request for Information](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information)：agent flow 可以暂停并请求人工输入 / 复核；联动操作的“需批准”路径应在保存前可见，而不是等 RuntimeAction 出现后才解释。
- [Zapier Agents approval steps](https://help.zapier.com/hc/en-us/articles/41776074420493-Add-approval-steps-to-your-agent-s-instructions)：外部自动化 agent 可通过消息请求批准并回到 agent 内批准或停止；Personal AI 需要把“保存规则”和“批准执行”分成两个清晰动作。
- [Slack coded workflow admin restrictions](https://docs.slack.dev/changelog/2024-05-security-updates-coded-workflows/)：外部动作能力可能受管理员限制；OpenClaw 未连接或缺少能力时，应清楚显示待激活或重试确认，而不是把规则保存解释成执行成功。
- [SAFECHAIN: Securing Trigger-Action Programming from Attack Chains](https://arxiv.org/abs/1903.03760)：TAP 规则组合会带来隐蔽的权限升级和隐私泄露风险；黑盒委派默认要暴露缺权限、缺能力和需人工判断状态。
- [Data Privacy in Trigger-Action Systems](https://arxiv.org/abs/2012.05749)：触发-计算-动作平台会在服务间传递敏感数据；联动操作应尽量只传必要消息上下文，并保留执行阶段的真实 blocker。
- [Supporting mental model accuracy in trigger-action programming](https://hcrlab.cs.washington.edu/publications/huang2015ubicomp/)：TAP 研究说明触发 / 动作类型混淆会造成误解，联动操作应明确点击时间、消息时间和执行前提。
- [If This Context Then That Concern](https://arxiv.org/abs/2012.12518)：自动化风险会随上下文变化；OpenClaw 未连接时应可保存草稿，但不能暗示已具备外部执行能力。
- [Towards Integrating Human-in-the-loop Control in Proactive Intelligent Personalised Agents](https://dl.acm.org/doi/10.1145/3631700.3664903)：主动 agent 需要在关键步骤上暴露人工控制点；联动操作因此把待激活、需批准、自动执行三种路径前置到保存前。
