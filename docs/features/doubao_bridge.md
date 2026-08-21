# Personal AI Desktop App Memory Flow

_最后更新: 2026-07-11_

## 概述

Personal AI Desktop App 是一套运行在本机的记忆协调系统，用来在 `Memory Service`、explorer 输入链路、豆包线程之间建立稳定的双向记忆流。

它的目标不是让服务端直接控制豆包账号，而是把职责拆成三层：

- `Memory Service`
  - 唯一真源
  - 负责记忆提炼、画像、检索、提醒、上下文渲染、explorer 落库
- `Personal AI.app`
  - 本机控制中心
  - 负责登录豆包、绑定线程、配置同步频率、查看状态、手动触发同步、管理 explorer 输入链路
- Chrome Extension 中的 `desktop-app.html`
  - 只做安装引导、状态摘要、打开 app
  - 不再承载主要配置功能

当前架构版本为 `v2`，以 macOS app 形态交付。

## 大白话运行逻辑

这个功能像一个本机桥接器：Desktop App 负责维持本机登录态和同步能力，Memory Service 负责保存和检索记忆，Chrome Extension 负责提供页面入口和状态展示。豆包只是当前接入的 provider 之一，长期设计应保持 provider-neutral。

结果主要受这些因素影响：

1. 本机服务是否在线：Desktop App 和 Memory Service 连接状态是同步能否发生的前提。
2. provider 登录态：豆包登录过期、页面需要人工验证时，自动同步只能暂停或降级。
3. 线程绑定关系：只有已识别或已绑定的 provider thread 才能稳定写回对应记忆。
4. 同步方向：输出侧同步负责把 Personal AI 内容带到豆包，输入侧探索负责把豆包会话沉淀回 Memory Service，两者应分开判断。
5. 用户显式动作：涉及发送、写回或跨平台注入时，应保留用户确认和可见状态，不把后台同步伪装成已完成。

---

## 核心能力

Desktop App 当前提供这些核心能力：

### 1. 连接 Memory Service

- 在 app 中配置 `Memory Service Base URL`
- 可选配置 `Memory Service API Key`
- 必须配置 `Memory Service User ID`
- 可在 app 中直接测试连接
- Memory Service、登录、线程绑定、后台同步和已接通的 Explorer 来源在就绪后会自动收起，只留标题和状态；点「展开」可改配置。未就绪区块保持展开。

> 注意：`Memory Service User ID` 对写操作是必填的。如果没填，Memory Service 会返回类似  
> `X-User-Id header is required for write operations`

### 2. 管理豆包登录态

- 本机使用独立的 Playwright 持久化 profile 保存豆包登录态
- 用户通过 app 打开的受控浏览器窗口手动登录一次
- 登录态只保存在本机，不回传服务端
- 也可以在“使用我日常浏览器的登录状态”开关下，通过 `webpage-mcp` 借用用户日常 Chrome 里已登录的豆包页面
- 如果 `webpage-mcp` 不可用、没有可用豆包标签页、填入/发送失败或发送后无法验证消息可见，输出广播与输入抓取都会临时回退到桌面端自带的 Chromium profile，并在短时间内避免反复重试不可用的连接器
- 回退状态会在 app 内展示当前实际传输、回退原因和大致自动重试时间；登录、打开线程或绑定线程这类修复动作会立即重新尝试日常浏览器
- 输入侧的豆包 / ChatGPT 来源卡片会显示当前传输状态；如果用户选择了日常浏览器但系统临时回退到内置 Chromium，会直接展示回退原因，避免用户误以为仍在使用日常浏览器登录态
- 当 Memory Service 未配置、来源未登录或连接器不可用时，输入来源的“自动读取”开关会显示阻塞原因并临时不可点击，但会保留用户已经保存的开启 / 关闭状态，避免用户编辑其它设置时把来源误保存成关闭。
- 输出侧“使用日常浏览器”的广播方式可在广播卡片里直接保存；未保存时界面会提示待生效状态，如果用户切换后立刻登录、绑定或手动推送，app 会先保存待生效的广播方式再执行操作

### 3. 绑定两类豆包线程

Desktop App 使用双线程模型：

- `memory_sync_thread`
  - 专门用于长期记忆沉淀
  - 只承接稳定信息，如 `persona_core`、`voice_mode`
- `mobile_context_thread`
  - 绑定到用户真实使用的“手机版对话”
  - 承接近期重点、提醒、查询结果等短期上下文
  - 自动绑定会先查找默认标题；如果找不到，但当前桥接器浏览器已经打开一个可用的豆包 `/chat` 或 `/thread` 页面，会把当前页作为手机版对话绑定
  - app 会在绑定步骤下方显示“手机上下文通道”回执，提前说明当前目标线程、近期重点 / 新待办 / 每日完整摘要节奏、最近一次手机上下文发送结果，以及失败或安全验证不会标记投递成功

这个设计来自豆包的实际行为边界：

- 明确要求“请记住”的内容，才有机会跨会话、跨设备共享
- 普通会话上下文不会自动跨线程共享

因此：

- 长期稳定信息要发到 `memory_sync_thread`
- 近期重点、提醒、查询结果要发到真实使用的 `mobile_context_thread`
- 线程链接必须是 `doubao.com` 或其子域名下的 `/chat/...` / `/thread/...`。只有路径长得像线程但 host 不是豆包的链接，会保留为待修复状态，不会被当作已就绪线程，也不会被 app 自动打开。
- 如果本机还保留可打开的旧 `memory_sync_thread` 绑定，但本机 thread record 丢失，`创建 / 修复长期记忆线程` 会先恢复旧线程记录，不会直接新建第二条长期记忆线程。
- 用户点击 `创建 / 修复长期记忆线程` 后，app 会留下即时绑定回执，区分复用已绑定线程、恢复本机记录、修复不可用旧绑定或新建线程；回执会说明这一步只写 `memory_sync_thread` 绑定，不同步 `persona_core` / `voice_mode`，不写 `mobile_context_thread`，真实内容投递、跳过原因和页面可见性仍以后续同步流水为准。

### 4. 输出侧同步，写回豆包

Desktop App 支持三类定时同步：

- `stable_memory`
  - 同步长期记忆到 `memory_sync_thread`
  - 默认改为使用豆包“随手记”结构化格式发送
- `mobile_briefing`
  - 同步近期重点到 `mobile_context_thread`
  - 也会明确要求豆包将内容记录到“随手记”
- `reminder_sync`
  - 同步提醒到 `mobile_context_thread`
  - 默认改为使用豆包“随手记”结构化格式发送，提醒会转成待办形态
  - 自动后台分成两种节奏：新待办按短间隔推送；历史未完成待办每天固定时间推送一次完整摘要，默认 `09:00`
- Quick Ask 的有证据回答
  - 可以从回答卡片一键发到 `mobile_context_thread`
  - 只携带本轮问题、答案和证据摘要，不写长期记忆；未绑定、落错线程或安全验证都会在原回答卡片里显示失败原因

同时支持手动触发：

- `现在推一次 persona`
- `现在推一次近期重点`
- `现在推一次提醒`
- `查记忆并注入当前会话`

app 会在两个线程步骤卡片里提前显示“推送前会发生什么”回执：

- 长期记忆线程会说明 `persona` 手动推送会先保存待生效的广播方式，再渲染 `persona_core` / `voice_mode` package，并只写入长期记忆线程的豆包随手记
- 手机上下文通道会分别说明“近期重点”使用 `active_focus_digest`、“待办 / 通知”使用手动完整摘要模式，以及它们只写入已绑定手机版对话，不混入长期 persona / voice 线程
- 这些回执是点击前的边界说明；真正的送达、跳过、失败、安全验证和状态回写结果仍以后面的最近同步流水为准
- 点击手动推送后，在后台确认返回前会先显示“推送待确认”回执：说明正在保存待生效广播方式、渲染哪类 package，以及尚未写入长期记忆线程或 `mobile_context_thread`、尚未标记送达；提醒推送还会明确尚未把待办标记完成，也不会发送空占位文本
- 用户点击手动推送后，成功、跳过和失败文案都会保留同样的边界：本次渲染的 package 类型、目标线程、是否未发送占位、是否不会混入长期 persona / voice、是否不会把待办标记完成，以及真实送达仍以后续同步流水为准；如果后台抛错且没有返回本次审计，失败回执会说明最近同步流水可能仍是上一次快照
- 手动推送按钮旁的即时回执会直接使用 `/sync/run-now` 返回的本次审计摘要，包括 package 类型、内容条目数、去重后的来源引用数、目标线程、验证 / 传输状态和状态回写异常；用户不用先翻最近同步流水，才能判断这次点击是送达、跳过还是需要复查

其中：

- 自动同步与“现在推一次 persona”走同一条 `stable_memory` 发送链路
- 自动同步与“现在推一次近期重点”走同一条 `mobile_briefing` 发送链路
- 自动同步与“现在推一次提醒”共用 `reminder_sync` 发送链路，但自动后台会区分 `new_items` 与 `daily_digest`；手动触发按用户显式请求推送当前完整待办 / 通知
- 这三条链路现在都会明确要求豆包把内容记录到“随手记”，并在发送文案里说明内容来自 `Personal AI (私人 AI)`
- 其中 `stable_memory` / `reminder_sync` 的结构化程度更强，`mobile_briefing` 仍以近期重点列表为主，但记录话术已改为随手记导向
- 手动触发同步会区分 `succeeded` 与 `skipped`：如果 Memory Service 当前没有真实可推送内容，app 会提示“本次没有可推送内容”，不会把跳过误展示为已推送
- 自动同步和手动同步都会过滤 Memory Service 返回的空占位包（例如 `itemCount: 0` 的近期重点、待办、通知或稳定记忆包），并把对应 sync job 标记为 `skipped`；不会把“暂无内容”的占位文本写进豆包线程
- `mobile_briefing` 还会在发送前二次剔除摘要标题、freshness window、`No recent...` 等元信息 / 空占位行，并按规范化文本去重；如果渲染结果没有真实可读条目，会直接 `skipped`，避免把 concerned items、重复 bullet 或空摘要误当近期重点推送
- app 会展示最近几次同步流水，区分手动 / 自动、成功 / 跳过 / 失败，并保留可读原因；流水里也会展示 Memory package 类型、内容条目数、去重后的来源引用数量、目标线程、页面可见性验证状态，以及待办同步属于“新待办短轮询 / 每日完整摘要 / 手动完整推送”的哪一种模式，方便确认内容有没有真正送达、是否来自真实记忆来源、以及为什么被跳过
- 如果一次 `reminder_sync` 同时包含多个跳过原因，例如“没有待办”和“当前 Memory Service 暂不支持通知同步”，流水会把原因拆开显示，不会合并成一个模糊的“没有可推送内容”。
- 默认开启“新待办当天不重复推送”：Memory Service 的 provider context package 在 `incremental` 模式下只返回未成功投递过的待办；`daily_digest` 模式才会忽略投递记录，重新列出仍未完成的全部待办
- 最近同步流水会写入本机 `bridge-state.json`，app 重启后仍可恢复最近记录；这里不保存发送正文，只保存状态、时间、类型、来源计数和投递验证元数据，便于排查但不扩大敏感内容落盘面
- 豆包发送结果和 Memory Service 状态回写会分开呈现；如果内容已经送达但 delivery / sync job 回写失败，流水会保留“已送达”并追加“状态回写异常”，避免用户误以为需要重发内容。
- 失败流水会根据失败类型直接给出恢复动作，例如打开豆包处理安全验证、重新绑定手机对话、测试 Memory Service、重试对应同步或查看日志；用户不需要先在页面其它位置重新寻找入口
- “绑定长期记忆线程”步骤卡片会直接展示目标线程、最近一次长期记忆同步结果、同步节奏和对应恢复动作；用户不用先翻完整同步流水，才能判断 persona / voice 这类长期记忆是否真的送到同一条稳定线程。
- `创建 / 修复长期记忆线程`、`现在推一次 persona` 以及卡片里的恢复动作都会在 hover / 读屏文案里说明本次点击的真实范围：绑定/修复只处理 `memory_sync_thread`，重试才会重新跑 `stable_memory`，测试和查看日志都不会写豆包或 Memory Service。
- 如果长期记忆线程已经绑定但还没有任何 `stable_memory` 自动或手动同步流水，卡片会显示“首次同步基线”：当前只是 `memory_sync_thread` 绑定就绪，persona / voice 尚未投递；下一次自动到期或手动首推才会渲染 `persona_core` / `voice_mode`，无内容只记 skipped，不发送空占位，也不会写入 `mobile_context_thread`。
- 这张卡片还会显示最近同步审计摘要，包括包类型、内容条目数、来源引用数、目标线程、正文可见性 / 验证状态、实际传输方式和状态回写异常；如果内容已经送达但 Memory Service 状态回写失败，只提示测试 Memory Service 或查看日志，不鼓励用户重复发送同一批长期 persona。
- `stable_memory` 最近流水还会和当前绑定的 `memory_sync_thread` 做一次投递目标核对：目标一致时显示目标一致回执；目标缺失或不一致时，卡片会改成待核对 / 目标不一致状态，并提示先修复长期记忆线程或查看日志，不把旧流水误当成当前长期线程已送达证明。
- “绑定手机版对话”步骤卡片也会直接展示短期上下文通道回执：未绑定时说明不会写入当前活动页，已绑定时说明近期重点、待办 / 通知和 Quick Ask 有证据回答都会进入这条手机对话；长期 persona / voice 不会混进这条手机对话。
- 这张手机上下文卡片会直接展示最近一次手机发送审计，包括 package 类型、内容条目数、来源引用数、目标线程、正文可见性 / 验证状态、实际传输方式和状态回写异常；如果内容已经送达但 Memory Service 状态回写失败，卡片会显示为“回写需检查”，避免用户把“豆包可见”和“服务端状态已记录”混成同一件事。

随手记格式发送后的内容，目标是让用户可以在豆包手机端按更结构化的方式查看和管理，而不是只停留在桥接线程里的一段普通上下文文本。

这次手动推送路径的 UX 判断参考了 [ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt) 的确认 / 通知 / 监控任务边界、[ChatGPT Memory Sources](https://help.openai.com/en/articles/8590148-memory-faq) 的来源透明度，以及数字提醒系统研究对“提醒意图、过去信息和会话线索”混合场景的讨论；结论是按钮发起后也要先给待确认回执，不能等后台结果回来后才解释影响范围。

### 5. 输入侧探索，写回 Memory Service

Desktop App 现在还承接 explorer 输入链路，用来把受支持来源中的消息重新整理后写回 `Memory Service`。

- 支持查看各来源的认证状态、启用状态、运行频率、最近一次运行结果
- 支持手动触发 explorer 立刻抓取
- 原始消息先写本机 explorer cache，再由提炼链路产出 artifact 并写入 `Memory Service`
- 支持 preview 已缓存消息、提炼结果、cursor 位置，方便定位问题
- 支持 reset cache，只清理本机 raw message cache 与 cursor，不删除远端会话
- 豆包 / ChatGPT 来源卡片可直接预览本机 raw cache、清洗后消息、artifact 与 cursor；也可重置本地缓存和 cursor，重抓输入链路时不影响已写入 `Memory Service` 的记忆
- 支持 revoke ingested memory，按来源和 `work/personal` scope 删除之前写入 `Memory Service` 的记忆，不回删远端聊天记录
- 来源卡片现在直接提供危险区样式的“按已保存范围撤回记忆”入口，按当前来源与已保存默认范围执行；操作前会显示当前范围可撤回的本地 artifact 数量，并提示这是删除 `Memory Service` 记忆的操作，但不会删除远端聊天
- 撤回入口旁会显示“撤回范围回执”：如果 Memory Service 未连接或来源正在读取，会直接说明按钮为什么不可用；可执行时会写明当前保存的默认范围、另一个范围不会受影响、远端原始聊天不会被删除，以及本地可撤回 / 旧版无 scope / 已撤回 artifact 数量
- 用户确认撤回后、后台返回前，来源卡片会先显示“撤回请求回执”：说明请求已经提交，但尚未证明 Memory Service 消息 / chunk 已删除、本地 Explorer artifact 已标记撤回，也尚未刷新预览、缓存、cursor 或删除原始对话；最终状态仍以返回结果为准
- 撤回成功后会分别展示 `Memory Service` 删除的消息 / chunk 数，以及本地 Explorer artifact 从多少条活跃审计变成多少条；如果只有服务端或只有本地审计发生变化，界面会直接提示可能是已删过、来源 / 范围不一致或旧版本审计缺口
- 撤回结果只有在 `Memory Service` 删除和本地 artifact 标记都发生时才显示为成功态；远端-only、本地-only 或空结果会显示为注意态，并说明预览里保留的已撤回行只是本地审计，不代表仍是活跃记忆
- 撤回确认、请求中和结果回执都会保留同一份“点击快照”：确认时保存的来源 / 范围、本地可撤回 artifact 数和旧版无 scope 审计数；这不是刷新后的 Explorer 统计，也不表示原始聊天、预览、缓存或 cursor 被删除
- 本地 Explorer artifact 不会被清理，但会标记为“审计已撤回”，来源卡片的“活跃提炼记忆”只统计仍视为 Memory Service 活跃输入的 artifact，避免用户把已撤回内容误读成还在长期记忆里
- Explorer 本地 artifact 审计按每次提炼批次追加保留；同一会话后续增量抓取不会覆盖之前的提炼结果，只有 reset cache 或 revoke 才会改变本地审计可见性
- 来源卡片修改自动读取、回看天数、默认范围、ChatGPT 对话上限、抓取间隔或日常浏览器传输方式后，会立即显示“待保存输入范围”回执。回执对比已保存后台设置和当前表单草稿，说明保存前后台自动读取、撤回已入库记忆和缓存统计仍按已保存设置执行；点击保存、登录来源或立即抓取才会先保存再继续。
- 手动触发某个来源抓取前，如果该来源卡片有未保存的抓取范围、默认范围或浏览器传输方式，app 会先保存再执行，避免本次抓取沿用旧设置；抓取完成后会留下“抓取回执”，说明本轮是否先保存了待生效设置、实际使用的范围 / 天数 / 传输方式，以及本次只读取来源到本机 cache 并提炼 Memory Service artifact，不删除远端聊天、也不向来源写回内容；如果来源的 lookback days 为 `0`，回执会写成“不限制历史天数”，不会误写成“最近 0 天”
- 点击“立即抓取”后、后台结果返回前，来源卡片会先显示“抓取请求回执”：说明是否会先保存待生效设置、准备使用的范围 / 回看窗口 / ChatGPT 对话上限 / 传输偏好，以及当前只是提交请求，尚未确认新的 Memory Service artifact、尚未刷新本机 cache / cursor，也不会删除远端聊天或向来源写回内容；完成或失败后再由真实运行结果替换这条请求态回执。
- 如果立即抓取失败，来源卡片会保留“抓取失败回执”：继续写明本次是否已先保存待生效设置、尝试读取的范围 / 回看窗口 / ChatGPT 对话上限 / 传输偏好，以及失败不代表新增 artifact、刷新 cache / cursor、删除远端聊天或向来源写回内容。
- 抓取回执会区分保存的传输偏好和本轮实际传输；如果用户选择了日常 Chrome / `webpage-mcp` 但本轮临时回退到桌面端 Chromium，会在完成消息里保留回退原因和重试窗口，不把 fallback 误写成日常浏览器已成功读取。
- 使用日常 Chrome 抓取或广播豆包时，必须先存在明确的 `doubao.com` 标签页；不会把当前活动页误当作豆包页面读取或写入。DOM fallback 也会统一处理 `/chat/<id>`、`/thread/<id>` 与绝对链接。
- 当 `webpage-mcp` 来源读取失败并临时回退到桌面端 Chromium 时，Explorer 状态会保留最近一次回退原因，UI 会在来源卡片内显示，用户可以据此补齐扩展连接、Chrome 标签页或登录态
- 使用日常 Chrome 读取豆包时，会优先走页面接口；接口不可用时再尝试 DOM fallback。fallback 自身失败会作为可见读取失败或回退原因呈现，不会被吞成“本轮没有新增内容”
- 如果某个 Explorer 来源最近一次自动读取失败，来源卡片会直接显示失败原因和下一步恢复提示，例如重新登录、补齐日常浏览器标签页、测试 Memory Service 或重新抓取
- 如果某个 Explorer 来源最近一次自动读取成功，来源卡片和手动抓取反馈会显示本轮摘要：新增缓存消息数、提炼消息数、写入记忆数，以及因无可沉淀内容被跳过的对话数。这样 `新增 0 条缓存` 不会被误解成“没有做事”，因为本轮可能只是把已有缓存提炼并写回 Memory Service。
- 来源卡片的常驻状态会同时显示缓存消息、对话数、待提炼消息数和已提炼记忆数；用户不用打开日志，也能判断当前是“还没抓到内容”“有缓存等待提炼”，还是“已经形成可审计记忆”。
- 来源卡片还会把这些数字整理成一条输入链路回执：区分等待登录、读取失败但仍展示上次成功缓存、缓存待提炼、已有可审计记忆、已处理但低信号、自动读取关闭和 Explorer 未响应；当已有活跃 artifact 且待提炼为 0 时，会明确写成缓存已处理完，只是本机 Explorer 审计快照，不代表刚刚新增写入，只有下一轮抓到新缓存才会继续提炼或写入 Memory Service；这条回执也会直接写出该来源当前保存的默认范围（工作 / 个人），避免用户把本地旧状态误读成刚刚成功抓取，或误判后续提炼 / 撤回会落在哪个范围。
- 如果 Explorer 状态接口暂时不可用或某个来源缺失，来源卡片会先清空旧的传输提示，再显示“Explorer 未响应”和恢复建议；不会把上一轮“已借用日常浏览器”或“已临时回退”的提示留在错误状态旁边。
- ChatGPT 来源在日常浏览器读取失败后，会和豆包来源一样保留回退原因和大致重试时间；后续冷却期轮询不会把“已临时回退到内置 Chromium”误刷成待保存状态。

因此当前产品方向已经不是单向“往豆包发”的 bridge，而是：

- 输出侧，把长期记忆、近期重点、提醒、查询答案发进豆包线程
- 输入侧，把 explorer 抓回来的对话材料整理后沉淀回 `Memory Service`

### 输入链路的产品依据

业内同类能力正在把“记忆来自哪里、能否迁移、能否删除”做成一等路径：

- [ChatGPT Memory Sources](https://help.openai.com/en/articles/8590148-memory-faq) 强调用户可以看到哪些信息影响了个性化回答，并可编辑记忆、删除引用聊天、标记来源是否相关。
- [ChatGPT data export](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data) 仍是用户拿到历史会话的正式路径之一，说明输入链路应把导入 / 抓取来源、失败原因和数据边界讲清楚。
- [Claude memory import/export](https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude) 已支持从其它 AI provider 导入/导出记忆，但也提醒导入仍是实验能力，可能不会完整吸收所有内容。
- [Gemini Apps Privacy Hub](https://support.google.com/gemini/answer/13594961) 把活动保存、关闭活动、临时聊天、删除和训练使用边界作为用户可控项；这类边界也应在 Personal AI 的 Explorer 状态里显式呈现。
- Memory portability 产品如 [Mollow](https://mollow.ai/) 和 [Lore](https://loreapp.dev/) 都把跨 ChatGPT / Claude / Gemini 的导入、搜索、删除、来源证明或本地加密作为核心卖点。

研究侧也支持当前实现方向：不要把完整聊天原文直接当长期记忆，而应拆成可审计的提炼结果。[Mem0](https://arxiv.org/abs/2504.19413) 讨论了从持续对话中动态提取、整合、检索显著信息，并用结构化持久记忆降低延迟和 token 成本；[LongMemEval](https://arxiv.org/abs/2410.10813) 则把长期记忆能力拆成信息抽取、多会话推理、时间推理、知识更新和拒答能力，提示 Explorer 输入链路需要保留来源、时间、跳过/提炼结果，后续才方便校准质量。近期的 [MemX](https://arxiv.org/abs/2603.16171) 和 [MemReader](https://arxiv.org/abs/2604.07877) 也都强调本地优先、可解释检索、低置信拒答或主动判断是否写入，进一步支持“显示真实状态、不要用旧成功态掩盖当前不可用”的 UI 边界。

撤回路径的产品边界是“删除长期记忆，不删除原始来源”。这与 ChatGPT / Gemini 这类产品把记忆控制、聊天活动和来源数据分开管理的做法一致，也符合数据系统研究里对 provenance / deletion 的要求：用户需要知道删除影响的是哪一层，系统也要保留足够的本地审计状态来解释为什么某条提炼结果后来不再参与召回。[ChatGPT 删除聊天](https://help.openai.com/en/articles/8809935-how-to-delete-and-archive-chats-in-chatgpt)会区分聊天视图移除、服务端保留窗口和已连接数据；[machine unlearning verification](https://arxiv.org/abs/2003.04247) 也强调用户需要能验证删除请求是否被执行。因此 Explorer 撤回结果不能只给一个“成功”，而要分开显示 Memory Service 删除结果、本地 artifact 审计标记，以及两者不一致时的解释。

### 6. 本机状态与后台运行

- app 关闭窗口后，后台会继续运行
- 真正停掉后台，需要在 app 中点击 `停止后台并退出`
- extension 页面会显示本机 Desktop App 服务是否运行、是否就绪、当前还缺哪些前置条件

---

## 用户主流程

标准主流程如下：

1. 从 GitHub Releases 下载最新安装包  
   [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)
2. 安装 `Personal-AI-Desktop-<version>-Installer.pkg`
3. 在 `Applications` 中打开 `Personal AI.app`
4. 在 app 中依次完成：
   - 配置 `Memory Service Base URL`
   - 配置 `Memory Service User ID`
   - 测试 Memory Service 连通性
   - 打开登录窗口并登录豆包
   - 创建/修复长期记忆线程
   - 自动绑定“手机版对话”；如果没有同名会话，先在豆包里打开真正会继续使用的手机对话，再点击绑定
5. 视情况调整同步频率
6. 关闭窗口即可，后台会继续按节奏自动同步

如果只打开 Chrome extension 中的 Desktop App 页面，看到的是安装引导和状态页，不是完整配置页。

---

## 自动同步前置条件

要让“自动定时推送记忆”真的工作，必须同时满足这些条件：

1. `Memory Service Base URL` 已配置
2. `Memory Service User ID` 已配置
3. 豆包登录状态为 `connected`
4. `memory_sync_thread` 已绑定到可打开的 `doubao.com` `/chat` 或 `/thread` 链接
   影响 `stable_memory`
5. `mobile_context_thread` 已绑定到可打开的 `doubao.com` `/chat` 或 `/thread` 链接
   影响 `mobile_briefing` 和 `reminder_sync`

当前 app 中后台同步默认开启，不再要求用户额外勾选一个 `autoSync` 开关。

如果任意条件不满足：

- app 会在状态区显示阻塞原因
- extension 页也会显示“当前阻塞原因”
- 如果本机状态里残留旧 binding 但缺少可打开的豆包会话链接，状态页会继续显示为待修复，而不是把它当成已就绪

---

## 默认配置与同步节奏

当前默认值如下：

- `Memory Service Base URL`
  - `http://10.32.56.212:3210`
- 轮询周期
  - 每 `5` 分钟检查一次
- `stable_memory`
  - 每 `12` 小时同步一次
- `mobile_briefing`
  - 每 `4` 小时同步一次
- `reminder_sync`
  - 新待办每 `15` 分钟检查一次，默认不重复推送当天已投递内容
  - 历史未完成待办每天 `09:00` 推送一次完整摘要

这些默认值来源于 `desktop-app/.env` 或代码默认值，但普通用户应在 `Personal AI.app` 中修改，而不是手改 `.env`。

---

## 架构边界与 provider-neutral 背景

当前文档以豆包用户可见行为为主，但底层仍保留 provider-neutral 的服务边界：

- `Memory Service` 是唯一真源，负责记忆、画像、提醒、context package 渲染、provider binding 和 sync job 状态
- `Personal AI.app` 是本机传输与登录态执行端，负责豆包输出线程、豆包 / ChatGPT explorer 输入链路、本地缓存、预览、回写和撤回
- Chrome Extension 只负责入口、状态摘要和打开 app，不保存豆包凭据，也不直接控制 provider 页面

服务侧 provider API 的有效边界是：

- `GET /api/v1/providers/:provider/capabilities`：声明 transport、binding type、scenario 和 sync model
- `GET /api/v1/providers/:provider/bindings`
- `PUT /api/v1/providers/:provider/bindings/:bindingType`
- `POST /api/v1/providers/context-packages/render`
- `GET /api/v1/providers/:provider/sync-jobs`
- `GET /api/v1/providers/:provider/sync-jobs/:id`
- `POST /api/v1/providers/:provider/sync-jobs/:id/report`

当前豆包侧的 transport mapping 仍然是：

| Memory product | Provider transport | Target binding |
| --- | --- | --- |
| `persona_core` | `native_memory` | `memory_sync_thread` |
| `voice_mode` | `native_memory` | `memory_sync_thread` |
| `active_focus_digest` | `session_context` | `mobile_context_thread` |
| `reminder_digest` | `reminder` or `session_context` fallback | `reminder_channel` / `mobile_context_thread` |
| `query_answer_card` | `session_context` | `mobile_context_thread` |

这部分是设计背景，不单独维护旧的 integration 文档；用户可见配置、同步、输入抓取和恢复路径以本文前面的当前行为为准。

---

## 消息发送策略

Desktop App 当前正式发送链路不再使用实验性的 request-mode，而是固定走 DOM 发送，并尽量降低机器人验证触发率。

当前策略：

- 主策略：`paste`
- 仅当满足以下两个条件时才 fallback：
  - 没检测到 challenge
  - 消息没有真正落到页面
- fallback 顺序：
  - `insert`
  - `type`

同时做了这些保护：

- 文本剪贴板备份/恢复，尽量避免污染用户剪贴板
- 发送后会检查：
  - 是否检测到 challenge
  - 消息是否真的以新增正文的形式出现在页面
- 内置 Chromium 与日常 Chrome 的发送验证都会排除输入框 / 编辑器内容，并比较发送前后的正文匹配次数；旧同步消息或未提交的输入框残留不会被当成本次送达成功
- 近期重点、待办、通知和查询注入必须先绑定 `mobile_context_thread`；未绑定时不会把内容发到当前豆包页
- 如果 `mobile_context_thread` 只剩旧 binding 或不是豆包 `/chat` / `/thread` 链接，发送前会直接失败并提示重新绑定，不再启动浏览器尝试写入当前页或错误线程
- 发送失败、命中安全验证或消息不可见时，手动推送会返回失败，后台同步也不会把失败任务当作已完成冷却
- 这类失败会在 Desktop App 状态区转成可执行提示，例如完成豆包安全验证、刷新可输入对话页或重新绑定手机版对话
- todo / notice 投递失败会回写到 Memory Service，避免把未送达的通知误标为已送达
- `reminder_sync` 的新待办轮询会先投递待办，再投递通知；如果待办投递已经失败，本轮会停止后续通知投递，避免在豆包安全验证、错误线程或不可输入页面上继续尝试写入，未处理通知会留待下次重试
- `daily_digest` 只负责完整未完成待办，不混入通知；成功送达后同样回写 delivery，避免后续新待办轮询把同一条历史待办当作新内容
- 如果已经检测到 challenge，不会继续盲目切换输入方式乱发
- 日常浏览器 `webpage-mcp` 传输不会只因为按下 Enter 就判定成功；它必须先成功填入输入框、触发提交，并在页面正文里观察到本次消息片段，才会向上层返回 `sent=true`
- `webpage-mcp` 传输会先检查当前页是否已经处在安全验证状态；发送后会等待消息出现在非输入区正文中，避免把仍留在输入框里的文本或慢加载页面误判为成功/失败；如果这些检查返回未送达，输出链路会切到内置 Chromium profile 再尝试
- `webpage-mcp` 传输现在支持 `/chat/<id>` 和 `/thread/<id>` 两类路径，也不再假设 thread id 一定是纯数字
- `webpage-mcp` 失败后会进入短暂回退冷却，后台抓取和同步会直接使用内置 Chromium，避免反复撞同一个不可用连接器；但用户点击登录、打开线程或绑定线程时，会绕过这层冷却并优先尝试日常 Chrome，方便用户修复连接后立即恢复到自己选择的传输方式
- 冷却期间 UI 会说明“多久后自动重试”和“哪个按钮会立即重新尝试”，避免用户把临时回退误解成永久配置变更

这套策略的背景是：

- 纯请求方式曾做过实验，但无法稳定通过豆包的校验链路
- `paste + 等待 + 发送` 更接近真实人工操作，实际表现更稳定
- 对输出同步来说，误报成功比失败重试更危险，因为 Memory Service 可能会把待办或通知标记成已投递

---

## App 与 Extension 的分工

### `Personal AI.app`

负责：

- 配置 Memory Service
- 登录豆包
- 创建/修复长期记忆线程
- 绑定手机对话
- 调整同步频率
- 查看阻塞原因、最近同步、日志
- 手动推送 persona / 近期重点 / 提醒
- 停止后台并退出

当前发送形态说明：

- `persona` 的自动同步和手动推送，底层会转成随手记格式后再发送到 `memory_sync_thread`
- `近期重点` 的自动同步和手动推送，底层会明确要求豆包把近期重点记录到随手记
- `提醒` 的自动同步和手动推送，底层会转成随手记待办格式后再发送到 `mobile_context_thread`
- 用户在 app 里看到的按钮文案仍然是 `现在推一次 persona / 近期重点 / 提醒`，但发送给豆包的内容已经不是旧格式
- 点击后会先显示待确认回执；后台确认前，按钮忙碌只代表请求已发起，不代表豆包已经可见、Memory Service 已回写或提醒已处理
- 每次手动点击后的即时回执会复用最近同步流水的审计口径，显示本次 package、条目数、去重后的来源引用、线程、验证 / 传输和状态回写异常；如果只是跳过，则明确说明没有内容被写入豆包；如果失败发生在返回审计前，则明确本次未确认写入目标线程、未标记送达，且最近流水可能仍是上一次快照
- 手机上下文步骤卡也会保留最近一次 `mobile_briefing` / `reminder_sync` 审计摘要；用户不用跳到完整流水才能确认最近一次近期重点或提醒推送的目标线程、内容计数、来源计数和验证状态
- 用户可在豆包手机端查看这些同步过去的随手记内容

### Extension 中的 `desktop-app.html`

负责：

- 检测本机服务是否在线
- 提示缺失步骤
- 展示状态摘要
- 引导下载安装包
- 引导用户打开 `Personal AI.app`

不再负责：

- 配置本机服务地址
- 配置 token
- 配置 auto-sync 开关
- 配置线程绑定细节

当前固定约定：

- Desktop App 本机服务地址：`http://127.0.0.1:46321`
- 这些细节由 app 自动管理，不暴露给普通用户

---

## Quick Ask

在 `v2` 的 app 方案里，menubar 的默认入口不再直接打开配置页，而是改成一个 `Quick Ask` 小窗：

- 左键点击 tray icon
  - 打开或收起 quick ask
- 右键点击 tray icon
  - 只弹 context menu
- 配置页
- 退回 `Open Desktop App Settings`

### 快捷键

默认全局快捷键是 `Option+A`（Electron 中注册为 `Alt+A`）：

- 窗口隐藏时
  - 唤起并聚焦 quick ask
- 窗口可见但未聚焦时
  - 把焦点带回现有 quick ask
- 窗口已聚焦时
  - 切换语音输入 start / stop

当前版本通过 Electron `Alt+A` 注册与本机 key-state helper 区分短按/长按：

- 短按用于打开、聚焦或隐藏 quick ask
- 按住约 `320ms` 会进入语音输入
- 如果系统权限或本机 helper 不可用，会退化为短按快捷键，并在窗口内显示原因

### Compact 与 Expanded

Quick Ask 的视觉目标是 `Spotlight 式胶囊壳`：

- 收起态只保留：
  - 输入提示
  - 工作 / 个人 / 两者范围选择
  - 同一行的小号语音按钮
  - 如有运行态异常，同一行显示小号状态胶囊
- 不再保留：
  - 模型菜单
  - 常驻状态条
  - 底部帮助文案
  - 单独占一整行的底部按钮区

范围切换会立即写入 `explorer.askDefaultScope`，成为后续 Quick Ask / Ask 的默认范围。切换后小窗会显示范围回执：保存成功时说明后续默认范围已经改变，但不会改已入库记忆、触发同步发送或改变已显示答案；如果设置不可用或保存失败，则说明只影响当前 Quick Ask 窗口里的后续提问，默认值没有持久化。

当用户真正发起问题后，窗口再平滑展开成轻量对话面板：

- 上方是消息流
- 下方是固定输入区
- structured answer 仍会保留：
  - `keyFindings`
  - `timeline`
  - `insights`
  - `relatedEntities`
  - `confidence`
- 证据默认折叠为轻量列表，而不是完整 dashboard

发起 Ask 时，Quick Ask 会先把用户消息和 `正在检索相关记忆` pending 状态渲染出来，再机会性读取日常 Chrome 的当前页面上下文和发起流式 `/ask`；页面上下文读取、Memory Service 首个 SSE status 或后端 API 往返都不能阻塞这个即时反馈。如果当前页是 RingCentral，会把聊天标题、URL、选中文本和少量可见文本拼入 `context`，作为 `MemoryContextMatchService` 的可选 hint；如果当前页只是 Google Docs 等弱相关页面，且用户问的是 `那个/这个/ready` 这类指代问题，则不会把该页面塞进请求，避免活动页噪声覆盖真实项目记忆。真实 Quick Ask 仍可能完全没有当前 chat context，因此 `/ask` 不能依赖客户端补上下文，而要先用近期高频、互动和 source anchor 记忆锁定话题。

证据卡片只展示可读摘要：标题优先使用群名、sourceTitle 或网页标题，正文会清理 Google Docs/网页抓取 chrome 文本，并限制为三行；网页快照、Memory Capture 等弱相关证据会标注“弱相关网页快照”，原文片段放到可展开区域。原文区域会保留消息换行，安全渲染 `a` 链接和 mention 文本，禁止横向溢出。这样用户先看到“来源是什么、为什么匹配、摘要是什么”，需要时再看格式化后的原始消息。

当 Quick Ask 生成有证据答案时，答案卡可以一键 `发到豆包手机对话`。这条操作会先显示 `query_answer_card -> mobile_context_thread` 的发送范围回执：只发送本轮答案和证据摘要到已绑定手机对话，不写长期记忆、不确认答案、不改绑定、不标记待办完成。按钮本身也会在 hover / 读屏文案里暴露同一控制点边界，并区分未发送、发送中、已发送和失败可重试状态。成功时还会内联展示本次线程、传输方式、回退原因、正文可见性和验证结果，避免用户需要回到完整同步流水才能确认实际送达路径；失败时明确本次没有写入 `mobile_context_thread`，避免用户把按钮理解成已同步、已确认或已处理提醒。

当前交互约定：

- `Esc`
  - expanded -> 收起到 compact
  - compact -> 隐藏窗口
- 会话上下文
  - 只在窗口存活期间保留
  - 短时间隐藏 / 重新唤起会回到上一段对话和原滚动位置，方便继续追问
  - 如果距离上一轮互动超过 30 分钟，会自动开始新对话，避免新问题误带旧上下文
  - 完整历史对话仍只保存在当前 Quick Ask renderer 内存里，app 重启后不恢复完整 transcript

### 本机会话续接

每次 Ask 成功完成后，Quick Ask 会额外保存最近一条经过裁剪和脱敏的 `AskResumeSnapshot` 到 desktop app 本机 `localStorage`。快照默认 24 小时过期，只保留一条；它不是长期记忆，也不依赖 Memory Service 才能在打开窗口时显示。

当 app 重启或当前 renderer 已没有活跃会话时，如果快照仍有效，输入框上方显示一条嵌入式续聊条：

- `继续`：恢复上一问、答案摘要和 topic 线索；下一问才会携带 `contextHints.source = local_ask_resume_snapshot`。
- `新问题`：隐藏续聊条，本轮请求不携带上一轮 hint。
- `丢弃`：删除本机快照，并说明不会删除 Personal AI 长期记忆。
- 待选 topic：最多显示 3 个候选，点击候选后以该 topic 作为本轮显式续聊线索继续 Ask。

快照会剔除完整长 transcript，限制问题、答案、topic 和 evidence 数量，并脱敏 secret 字段、bearer token、常见 API key、邮箱、电话及 URL query/hash 凭据。过期或格式损坏的快照在读取时直接清理。直接在续聊条仍显示时输入文本按“新问题”处理，不会静默继承。

Memory Service 仍负责当前事实：收到 hint 后把用户显式选择的 `topicTitle` 作为独立的 preferred topic，优先于仅共享宽泛 anchor 的近期环境 frame，再重新跑 evidence recall；即使最终生成超时，也按已锁定 topic 保留证据。响应返回 `continuityReceipt`，明确这是本机线索、仅作提示、本轮已重新检索且快照未写入长期记忆。详见 [Ask](./ask.md)。

交互 demo： [Ask 会话续接](/Users/Esone/git/personal-ai/docs/demo/ask-conversation-continuity.html)。

Quick Ask 的产品参照是“低打扰快问 + 必要时继续深入”：[Raycast Quick AI](https://manual.raycast.com/ai/chat) 同时支持一问一答、继续追问、超时自动新对话和升级到完整 AI Chat；[ChatGPT macOS Chat Bar](https://help.openai.com/en/articles/9295241-accessing-the-launcher-chatgpt-macos-app) 也把全局快捷键、菜单栏入口、文件 / 截图入口放在轻量 prompt window 里。手机上下文发送还参考了 [ChatGPT Memory Sources](https://help.openai.com/en/articles/8590148-memory-faq)、[Claude chat search and memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context) 和 [Gemini Enterprise personalization](https://docs.cloud.google.com/gemini/enterprise/docs/configure-personalization) 的来源 / 记忆控制原则：跨设备或跨线程上下文必须解释来源、目标和删除 / 关闭边界。研究侧的 [just-in-time information access](https://www.scholars.northwestern.edu/en/publications/user-interactions-with-everyday-applications-as-context-for-just-)、[mixed-initiative context](https://arxiv.org/abs/2604.07121) 和 [digital reminder systems](https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf) 都指向同一个原则：上下文可以主动利用，但生命周期、未来提醒语义和用户控制必须清楚，所以当前实现把 renderer 内短期会话、24 小时本机恢复线索、显式继续和手机对话发送边界分别处理。

### 状态胶囊与状态卡

compact 态只显示一条主状态胶囊，按优先级从高到低选择：

1. `setup_blocker`
2. `runtime_issue`
3. `sync_issue`
4. `confirm_request`
5. `running_action`
6. `waiting_reply`
7. `queued_action`

如果还有其他活跃状态，胶囊文案会显示成：

- `外部询问等待回复 +2`

这里的 `+2` 表示还有另外两类状态存在，而不是同类状态数量。

点击状态胶囊后：

- 窗口展开
- 将当前运行态汇总成一张 `status card`
- 状态卡直接插入消息流
- 不跳页，不打开第二窗口
- 即使最高优先级是 `setup_blocker`，也会先展示状态卡；用户再点具体设置项时才打开设置页

这样做的原因是：

- 对用户来说，这仍然是一场 chat
- 状态只是这场 chat 里的“系统回复”
- 不需要为了看运行态切到另一个 dashboard

当前 v1 中，状态卡只做“显示与引导”，不直接在卡片里完成 approve / retry / openclaw / outreach 操作。

状态卡会展示本次运行态快照距离现在多久，以及每一项来自哪条状态来源（例如本机同步流水、Memory Service 确认请求、Outreach 运行态或 Action Queue）。当同一快照里有多类状态时，卡片顶部会显示 `状态构成` 摘要，例如同步异常、待确认、排队动作各有几项；这只是当前快照的构成说明，不会批准、重试、发送、取消、归档或写入。状态胶囊本身的 hover / 读屏文案也说明点击只展开 Quick Ask 状态卡，不会打开设置或执行任何状态动作。每条状态项还会直接显示本行代表的数量、来源和只读快照口径，避免把一条例子误读成全部状态；点击状态项带入输入框继续追问时，也会把同一数量口径放进草稿。每条状态项还会显示读取新鲜度和“为什么现在显示”：例如缺配置会阻断同步、状态读取失败不能沿用旧快照、确认请求不会自动写入或发送、外部询问要先区分待批准发送还是等待对方回复。状态项底部会显示明确的处理入口条：`setup_blocker` 只打开 Desktop App 设置，其它状态只把来源、数量、新鲜度、显示原因和处理边界带入 Quick Ask 输入框继续追问；不会在卡片内直接 approve、retry、send、cancel、归档或写入。卡片内可以手动 `重新读取`，用于用户刚修复 Memory Service、豆包验证或配置后立即确认状态是否变化；刷新按钮的 hover / 读屏文案说明它只刷新状态卡和状态胶囊，刷新中阻止重复点击，不会批准、重试、发送、取消、归档、写入或改配置。如果重新读取后没有需要关注的状态，卡片会保留“暂无状态项”的反馈，而不是继续展示旧异常。如果重新读取失败，状态卡会保留上次成功快照但把卡片和状态项标成“刷新失败 · 上次快照”，点击追问时也会带入当前状态未确认和失败原因，避免把旧状态误当成刚确认过的运行态。

如果后台自动同步遇到 Memory Service 连接失败、豆包发送失败或其他桥接异常，`sync_issue` 会在 Quick Ask 状态卡中直接显示最近一次错误、失败链路、触发方式和失败时间。点击这类状态项会把错误摘要带入输入框，方便用户继续追问排查顺序；不用先去翻本机日志才知道同步曾经失败。

Quick Ask 的 `sync_issue` 只代表当前未清除的同步异常，或最新一条同步流水本身失败。更早的失败仍保留在 Desktop App 的同步流水里，但如果后续同步已经成功或跳过并清除了 active error，Quick Ask 不再用历史失败继续打扰用户。

如果 Quick Ask 能打开，但读取 Memory Service 的确认请求、动作队列或外部询问运行态失败，会显示独立的 `runtime_issue`，而不是误展示成 `setup_blocker`。状态卡会说明这是运行态读取异常，不代表同步已完成，也不代表用户配置没有完成；点击后会把错误、细节和建议动作一起带入输入框，方便继续排查或测试 Memory Service。

外部询问状态不会把“待批准发送”误写成“等待回复”：如果当前只有 pending approval，胶囊和状态卡会显示 `外部询问待批准发送`，状态卡中保留 `待你确认发送` 数量和示例问题。点击普通状态项时，Quick Ask 会把该状态的标题与摘要一起带入输入框，再附上追问提示，避免用户点击后丢失刚才想处理的具体事项。

### 显式记忆

Quick Ask 和原来的 exploring `/ask` 有一个关键差异：它更像聊天，因此会自然出现“请帮我记住”这种输入。

当前实现约定是：

- 只有命令式的显式“记住 / 记下 / 保存 / remember”意图，才会写长期记忆
- “你还记住了吗？”这类回忆/确认问题不会触发写入
- 普通聊天不会自动沉淀 profile item
- 记忆写入不走 `/ingest`
- 而是直接写 `POST /profile/items`
- 独立记忆请求会在消息流里保留用户原话，再显示“已记住 / 已存在”的确认，方便回看

分类规则：

- 语言 / 回复风格类 -> `preference`
- 身份 / 角色 / 组织 / 时区类 -> `fact`
- 其他显式“请记住” -> `fact` + `itemKey=remembered_note`

如果内容已存在，bridge 会把 Memory Service 的 `409` 归一化成成功响应，并在 UI 中显示“已记住 / 已存在”。

### 语音

当前语音输入只在 quick ask 窗口内可用：

- macOS 上通过本机 `Speech` + `AVFoundation` helper 做系统语音识别
- helper 会按需编译/启动，并把 transcript、音量、权限错误回传给 quick ask
- transcript 先进入语音草稿，用户仍可确认后再发送
- voice sheet 会显示 `语音草稿回执`：听写时说明这是本机语音识别且不会自动发送；可发送时说明点箭头才会按当前 Quick Ask 范围发起 Ask，点叉号会把草稿带回文本框继续编辑；出错时说明语音未发送、草稿仍保留
- 即使用户在 helper 回传“开始监听”前立刻点叉号，Quick Ask 也会立即取消本机语音会话、回到文本输入，并忽略随后迟到的开始或转写回调；不会重新打开 voice sheet、注入草稿或发起 Ask
- 用户点中间按钮停止监听后，voice sheet 会把 ready 态拆成两种回执：有转写草稿时显示 `已停止监听`、草稿仍留在本机、点箭头才会发送转写文本；没有可发送内容时显示没有发送、没有保存音频、没有发起 Ask，可继续说话或回到文本输入
- voice sheet 的中间按钮、返回文本、发送和权限恢复入口都会同步动态 hover / 读屏边界：点击前即可知道当前动作是停止监听、重试语音、只把草稿带回文本框、打开系统权限入口，还是按当前 Quick Ask 范围提交转写文本；这些按钮边界也说明不会自动发送、不会保存原始音频，也不会在没有草稿时发起 Ask
- 点箭头真正提交后，对话里的用户消息会保留 `语音草稿已确认发送` 回执，说明只提交转写文本、不发送或保存原始音频；如果文本本身包含“请记住”等明确意图，仍走现有记忆保存回执
- 如果麦克风或系统 Speech Recognition 权限被拒绝，voice sheet 会保留当前草稿，显示明确原因，并直接提供“打开麦克风设置 / 打开语音识别设置”的恢复入口；主配置页也保留这两个系统权限入口
- 如果本机 helper 启动失败或重启失败，Quick Ask 会停在可恢复的 voice-ready 状态并显示失败原因，不把界面继续伪装成正在监听
- 如果系统语音识别在已经产出 partial transcript 后中断，voice sheet 会保留“识别中断”回执：说明当前只是未确认语音草稿，没有发送、没有保存音频、没有发起 Ask；用户应先核对人名 / 项目词，再点箭头发送或点叉号回到文本框编辑

当前不做离线识别；如果后续需要完全离线能力，再考虑接入本地模型。

语音路径的产品参照是把“开始说话、看到实时反馈、修正/取消、修复权限”放在同一个短路径里：[Raycast Dictation](https://manual.raycast.com/ai/dictation) 把首次授权、输入设备、快捷键、push-to-talk、波形、本机历史/设置、隐私说明和 review/insert mode 作为 dictation 的核心流程；[ChatGPT macOS Chat Bar](https://help.openai.com/en/articles/9295241-accessing-the-launcher-chatgpt-macos-app) 也把 voice input 放在轻量 launcher 内。实现侧要遵循 Apple Speech 的授权模型：[SFSpeechRecognizer.requestAuthorization](https://developer.apple.com/documentation/speech/sfspeechrecognizer/1649892-requestauthorization) 会异步返回授权状态，用户之后也可能在系统设置中改掉权限；Apple 的 macOS 说明也明确用户可以逐个 app 开关 Speech Recognition 访问，所以 UI 必须提供回到系统设置的恢复路径。2026-06-21 复核还参考了 [Apple SpeechAnalyzer](https://developer.apple.com/videos/play/wwdc2025/277/) 对 live transcription、文本输出和传递给 LLM 的说明。研究侧同样提示不要只追求 transcript：Google 的 [Mondegreen](https://arxiv.org/abs/2105.09930) 把 ASR 错误视为会直接伤害查询结果的问题；[High-precision Voice Search Query Correction](https://arxiv.org/abs/2401.04235) 也强调 ASR hypothesis 可能因为噪声和领域词召回差而需要纠错；[Typist Experiment](https://arxiv.org/abs/2403.05785) 指出 dictation 需要覆盖 composition、review、editing；Microsoft Research 的 [Voice Typing](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/chi2012_VoiceTyping.pdf) 也强调实时可见和即时修正能降低用户纠错负担。因此当前 Quick Ask 先让 transcript 落在可编辑草稿，并把“停止监听 / 不会自动发送 / 当前范围 / 草稿保留 / 权限恢复 / 不保存原始音频”做成同屏回执，而不是自动发送或只报错。

### Demo

Quick Ask 的最终视觉 demo 收敛为一个独立 HTML：

- [docs/demo/doubao-bridge-quick-ask.html](/Users/Esone/git/personal-ai/docs/demo/doubao-bridge-quick-ask.html)

这个 demo 页面包含 5 个核心状态：

- compact 默认待命态
- compact 带状态胶囊态
- expanded 普通问答态
- expanded 插入状态卡态
- voice listening 态

---

## 发布与安装

面向用户的正式发布物只有一个：

- `Personal-AI-Desktop-<version>-Installer.pkg`

GitHub Release 主入口：

- [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

本地打包产物通常会同时生成：

- `desktop-app/release/Personal AI.app`
- `desktop-app/release/Personal-AI-Desktop-<version>-Installer.pkg`

但对最终用户来说，推荐只下载 `.pkg`。

版本号由 [desktop-app/package.json](/Users/Esone/git/personal-ai/desktop-app/package.json) 的 `version` 驱动，例如当前为 `5.0.0`。

`npm run build:app` 会打包 Desktop `.pkg`，并同时打出 `worker-<ver>.tgz` + `install.sh`。`npm run deploy:app` 会发布两条 GitHub 轨道：`desktop-v*`（内嵌 worker）和 `worker-v*`（headless）。

---

## 升级与卸载

### 升级

- 直接下载并安装更高版本的 `.pkg`
- app 会继续复用本机数据目录和登录态

### 卸载

当前卸载入口是隐藏的，不放在主界面，而放在 app 菜单中的高级选项里。

卸载会尝试做这些事：

- 停止后台服务
- 清理本地数据和日志
- 关闭 app
- 尝试把 app 移到废纸篓，或者在失败时定位到 Finder 让用户手动删除

注意：

- 直接删除 `/Applications/Personal AI.app` 不一定等于一次完整卸载
- 推荐使用 app 内的卸载入口

---

## 本地 API 摘要

Desktop App 本机默认监听：

- `http://127.0.0.1:46321`

常用接口包括：

- `GET /health`
- `GET /status`
- `GET /settings`
- `PUT /settings`
- `POST /settings/test-memory-service`
- `POST /auth/open-login`
- `POST /threads/create-memory-sync`
- `POST /threads/auto-bind-mobile`
- `POST /sync/run-now`
- `POST /inject/query`
- `GET /explorer/status`
- `POST /explorer/auth/open-login`
- `POST /explorer/run-now`
- `POST /explorer/reset-cache`
- `POST /explorer/revoke-ingested-memory`
- `GET /explorer/preview`
- `POST /memo/sync`
- `POST /memo/stable-memory`
- `POST /memo/reminders`
- `POST /memo/classify`

这些接口主要给 app 和 extension 使用，不面向普通用户直接操作。

其中：

- `POST /sync/run-now` 是 app 手动触发同步时走的统一入口
- `POST /sync/run-now` 会返回本次状态；`skipped` 表示没有可推送内容，不代表发送失败
- `POST /inject/query` 是 Quick Ask / 本机界面把有证据回答送入 `mobile_context_thread` 的入口；它依赖已绑定手机版对话，不会自动改写长期记忆线程
- `stable_memory`、`mobile_briefing` 与 `reminder_sync` 都会使用随手记导向的话术
- `/memo/*` 接口是直接操作随手记格式的本地 API
- `/explorer/preview` 会返回原始缓存消息、清洗后的预览文本、提炼出的 artifact、以及 cursor 位置
- `/explorer/reset-cache` 只清本地 explorer cache 与 cursor
- `/explorer/revoke-ingested-memory` 只删除 `Memory Service` 中按来源和 scope 写入的记忆，不删除远端聊天记录

---

## 已知边界

1. Desktop App 目前按 macOS 优先设计
2. 豆包普通会话上下文不天然跨线程共享，所以必须维护双线程模型
3. 消息注入仍需要浏览器上下文；当前不采用纯 HTTP request-mode 作为正式路径
4. 为降低风控触发率，当前不启用 headless 自动同步模式
5. 签名与 notarization 需要 Apple Developer Program 资质，未签名包在其他 Mac 上可能仍会被 Gatekeeper 拦截

---

## 相关文件

- app 入口与打包：
- [desktop-app/app/main.mjs](/Users/Esone/git/personal-ai/desktop-app/app/main.mjs)
  - [desktop-app/app/renderer.js](/Users/Esone/git/personal-ai/desktop-app/app/renderer.js)
- [desktop-app/scripts/package-macos.mjs](/Users/Esone/git/personal-ai/desktop-app/scripts/package-macos.mjs)
  - [desktop-app/scripts/deploy.mjs](/Users/Esone/git/personal-ai/desktop-app/scripts/deploy.mjs)
- 发送与桥接核心：
- [desktop-app/src/browserSession.ts](/Users/Esone/git/personal-ai/desktop-app/src/browserSession.ts)
  - [desktop-app/src/bridgeService.ts](/Users/Esone/git/personal-ai/desktop-app/src/bridgeService.ts)
  - [desktop-app/src/server.ts](/Users/Esone/git/personal-ai/desktop-app/src/server.ts)
- extension 状态页：
- [src/modals/desktop-app.tsx](/Users/Esone/git/personal-ai/src/modals/desktop-app.tsx)
