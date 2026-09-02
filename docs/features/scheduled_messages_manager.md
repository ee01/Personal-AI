# 定时消息统一管理功能（任务中心 ☁️ jira_sheet lane）

*最后更新: 2026-09-02*

> **定位**：本文是[任务中心](task_center.md)的 **Level 2 / ☁️ `jira_sheet` lane** 子文档，覆盖 Google Sheet + App Script + Jira Automation 这条云端 24/7 调度链路的全部实现细节（数据模型、执行匹配与幂等、Config 同步、Timeline 缓存、App Script 自动更新）。
>
> 任务中心的总体设计——两条 lane 如何共存、任务类型与编辑器、分层激活、人工节点、反思候选——见 [`task_center.md`](task_center.md)。本文描述的能力对存量用户**照常运行、无需迁移**。

## 功能概述

定时消息统一管理功能提供了一个集中化的平台，用于管理和执行各种类型的定时消息推送。系统整合了 Google Sheet、AppScript、Jira Automation 和 memory-service runtime，既能做普通消息推送，也能做“帮我问 / 主动询问（Outreach）”这类带运行时状态和追问逻辑的任务，也能创建“帮我做 / AgentTask”这类一次性或周期性 Agent 任务。

## 大白话运行逻辑

这个功能把“什么时候发什么消息 / 什么时候让 Agent 做什么”拆成三层：Google Sheet 是用户可编辑的计划表，执行引擎负责按时间发出或触发，memory-service runtime 负责 Outreach 这类需要等回复、追问和记录状态的任务，也负责 AgentTask 的 run 账本、OpenClaw 执行、artifact，以及 Memory Service 自己发出的结果通知。

结果主要受这些因素影响：

1. 表格行是否有效：状态、日期、时间、重复规则、推送方式和内容是调度的根。
2. 本地时区解释：日期/时间按本机本地时间保存和预览，避免 UTC 转换造成跨天误发。
3. 执行引擎选择：AsMe 走 App Script，Bot/AI 走 Jira Automation，Outreach 走 memory-service runtime，AgentTask 由 Jira Automation 到期触发 memory-service，再由 OpenClaw 执行；浏览器只做备用。
4. 幂等和补偿：`Next_Exec`、Logs、occurrence/session 共同决定是否已执行、是否要补偿、是否应避免重复。
5. 队列健康：pending/running/succeeded/failed/recovered 等状态会影响管理页提示，不应把历史成功误当当前阻塞。
6. Glip 输入框里的虚线未来消息只是本地待发送快照；它以同一 `Message_ID` 的成功 Logs 为完成信号，不以计划时间到点或页面出现同文消息为准。

## 核心特性

### 1. 一键初始化

- 自动创建 Google Spreadsheet
- 自动配置 AppScript 执行引擎
- 先创建维护表、Apps Script 项目和 Web App，再要求用户授权 Apps Script
- 点击“一键生成维护表”后会立即显示“初始化请求回执”，说明当前只在创建维护表 / Apps Script / Web App，尚未设置触发器、写测试消息、保存最终 Config 或发送消息；如果需要开启 Apps Script API 或完成授权，会停在可恢复的下一步
- 一键生成、打开 Apps Script API 设置页、重新初始化、打开授权页和继续初始化按钮都会在 hover / 读屏里说明本次点击是创建第一阶段、外部设置恢复、授权打开，还是沿用已创建资源继续第二阶段；按钮文案同时标明不会立即发送正式消息或静默写入无关配置
- 授权完成后设置分钟触发器、添加示例消息并保存 Config
- 维护表默认不会静默开放为“知道链接的任何人可编辑”；域内共享失败时保持仅创建者可编辑，并在初始化收据里提示用户手动分享给指定成员、群组或目标受众
- 初始化收据会保留并展示维护表子表定位、Web App deployment、触发器状态和安全边界；授权后保存 Config 时使用同一批元数据，避免新建表后还要靠后续同步修复 Messages / Logs 链接或 App Script 升级目标
- 授权后完成初始化并刷新到管理页时，会显示一次性完成收据，概括 Sheet、子表定位、Deployment、Script、触发器状态和共享/权限注意事项；关闭后不再重复打扰
- 通常 10-15 秒完成自动步骤；如果需要开启 Apps Script API 或完成授权，会停在可恢复的下一步
- 首次 One Click Setup 会明确请求完整 Google scope 集合，以覆盖 Sheet、Drive、Apps Script 和 Slides 等扩展完整能力；授权返回后会检查实际授予的 scopes，不能把部分勾选误当成完整授权。

### 2. 统一数据模型

- 用户友好的表格格式（无 JSON）
- 支持三种消息类型：Daily（按日期）、Hourly（按时间）、Periodic（周期性）
- 支持多种推送方式：AsMe、Bot、AI Report、Outreach（帮我问）、AgentTask（帮我做）
- 支持灵活的周期配置：日/周/月/年

### 3. 多种执行引擎

- **AppScript 引擎**：处理 AsMe 推送（通过 Email），24/7 可靠运行
- **Jira Automation 引擎**：处理 Bot / AI 类推送，解决内网访问限制
- **Outreach Runtime**：处理“帮我问”的模板同步、目标解析、发出、等回复与追问
- **AgentTask Runtime**：处理“帮我做”的到期触发、OpenClaw 执行、run 账本、artifact 和 Bot 私发通知
- **Chrome Extension 备用**：浏览器开启时可直接执行
- 管理页打开时只等待本机 Config、Google 授权缓存和 Messages 基础行读取；Jira Automation 状态同步、Outreach runtime 覆盖 / Done 回填、Bot 配置有效性检查和 App Script 升级检查都会在后台补齐，避免把整页停在首屏 loading。
- 日常 Scheduled Messages 加载、读写、同步、后台标注和自动答复只请求 Google Sheets scope，不会因为打开定时消息管理页捎带请求 Google Slides；Slides 分析、身份读取和 App Script 管理分别使用自己的最小 scope。较小 scope 不会撤销 One Click Setup 已授予的完整授权。
- 多 Google 账号环境会按 scope 记住最近一次成功的 Chrome account id（只保存 opaque id，不保存邮箱或 access token），静默获取时先检查该账号，再检查 Chrome 可枚举的其它账号；因此默认个人账号不会遮住第二个工作账号上仍然有效的 Sheets 授权。用户明确点击“重新授权”时仍由 Chrome 显示账号选择器，成功后更新对应 scope 的账号绑定。
- 管理页会区分缺少 Google Sheets scope、未登录/取消授权和其它 OAuth 错误，不再把所有静默取 token 失败统一描述为“授权已过期”；扩展刚重载时的临时 Identity 失败会先静默重试一次。只有确认来自 Google Sheets 的 401/invalid credential 才清理该 token 缓存，普通错误文本中的 `401` 不会触发授权重置。
- 管理页列表、健康告警和诊断回执会显示真实执行引擎：例如 AsMe 是 AppScript 邮件 fallback 还是 Jira Automation RingCentral sender，Bot/AI 是否依赖 Bot executor，JiraAutomation 是外部规则还是托管 API，Outreach 是否由 memory-service runtime 接管。新增 / 编辑表单默认只显示预计下次执行，缺少前置配置时才显示简短“发送配置待完成”提醒。
- 列表主题后会展示相关执行入口：JiraAutomation 行的 link icon 打开 Jira Rule；AgentTask 行的 link icon 打开 `Action Queue`，按 `sourceKind=agent_task` 和当前 Messages `ID` 定位执行账本。
- 从 Jira 页面托管进 Personal AI 后，编辑保存会保留 `Automation_Link`；改 Topic 会继续同步到对应 Jira Rule 名称。整行写回时如果表单没带 link，也不会把 Sheet 里已有的规则入口写成空。
- 打开定时消息列表时，会像“帮我问”一样只读叠加 memory-service 运行态：Outreach 读 session 结果；AgentTask 读 `/agent-tasks/runtime-status`，列表与 hover 只展示 OpenClaw `summary`（缺 summary 时才回退第一条 artifact）；Bot 私发文案和 Sheet `Agent_Last_*` 只作兜底，不是结果真源。完整 artifact 仍在 Action Queue。
- 新增 / 编辑表单把任务类型放在弹窗顶部 tab，视觉分为两组：`发消息（AsMe · Bot · AI Report）` 与 `Agent 任务（帮我问 · 帮我做）`。Bot / AI Report / 帮我问 / 帮我做在缺少前置配置时仍可选中填写草稿，tab 会标成“可预览 · 待配置”，保存会被明确阻止，不会写入 Messages、发送消息、创建 Jira Rule 或同步 runtime。
- “帮我做 / 帮我问”不再占用管理页头部独立按钮；统一从新建弹窗 tab 进入。普通入口创建的 AgentTask 可以是一次性或重复任务，但不暴露 AR 绑定入口。只有网页 [AR 数据](./ar_data_overlay.md) 入口创建且勾选重复执行的任务，才会写入 `Agent_AR_Binding_ID` 并出现在列表里。编辑已有 Outreach / AgentTask 行时 tab 锁定为对应类型，不可跨类型切换。

### 4. 智能调度

- 自动计算下次执行时间
- 支持重复次数限制
- 自动标记已完成任务
- 记录执行日志
- 日期和时间按本机本地时间保存，避免接近午夜时被 UTC 转换成前一天 / 后一天
- 执行时间必须是有效的本地时间（00:00-23:59），异常值会在管理界面提示并被执行器跳过
- 周期任务的 `End_Date` 包含结束日当天；达到 `Repeat_Count` 后会在本次成功发送后收尾
- 所有周期单位（天 / 周 / 月 / 年）都可以设置重复次数上限；周重复不会再丢失 `Repeat_Count`
- 一次性任务、到达 `End_Date` 或达到 `Repeat_Count` 的周期任务成功收尾后会清空 `Next_Exec`，列表中显示为已完成，避免误以为还有下一次发送
- 已完成的单次任务如果被改到未来执行时间，或改成仍有下次执行的重复任务，会自动从 `Done` 恢复为 `Active`，并清空上次执行时间以允许重新推送；单次改成循环时还会把 `Exec_Count` 归零，让新的重复次数从这条新计划起算。执行器只领取 `Active` 行，已完成行没有单独的“恢复”按钮。
- Outreach / 帮我问模板同步到 memory-service 后会保留 `Repeat_Days`、`End_Date` 和 `Repeat_Count`，运行态发问节奏与表单预览保持一致
- 周期任务的预计执行和保存校验会同步检查 `End_Date`；如果结束日前已经没有下一次可执行日期，表单会阻止保存并提示用户调整结束日或重复规则
- 周重复任务的预览和 `Next_Exec` 始终指向未来的有效执行日，今天时间已过时会自动跳到下一个匹配星期
- 列表里的频率文案与实际调度保持一致：Day 重复会标明“仅工作日”，`Repeat_Every > 1` 且选择多个星期时会显示“每 N 周的周一/三/五”，避免把隔周任务误看成每周任务
- 新建 / 编辑表单会在执行预览中只显示简洁的下一次执行日期时间；跨时区和队列语义细节保留在列表、健康告警和诊断回执里，避免创建主路径被技术说明挤占

### 4.1 Glip 输入框快速定时与未来消息

- RingCentral/Glip 消息输入框旁会注入闹钟按钮。用户选择未来时间后，扩展读取当前草稿和会话目标；只有内容、目标、未来时间、Scheduled Messages 配置和 Google 授权都有效时，才创建一条 `Push_Method = AsMe`、`Category = ComposeScheduled` 的 Messages 行。
- 创建成功后才清空输入框，并按当前 `chatId` 在消息列表底部显示虚线未来消息；卡片里的“管理”会打开 Scheduled Messages 并定位对应 `messageId`。它是 `chrome.storage.local.glipMessageMarkers.pendingScheduledByChatId` 的本地快照，不是已经发到 RingCentral 的真实消息。
- 虚线卡片的完成判定按以下顺序执行：
  1. Logs 写入端始终把新记录插在第 2 行，因此后台用有界 A1 range 只读取表头和最上方 500 条数据行（即最新 500 条），找到相同 `Message_ID` 且 `Status = Success` 时，从 pending 缓存删除；失败日志不会删除。该刷新不再先下载完整 Logs 工作表。
  2. marker 缓存默认每 5 分钟刷新；页面初始化或 Service Worker 重新加载也会主动刷新。缓存变化后，内容脚本约 500ms 防抖重绘，因此真实消息发出后可能短暂与虚线卡片同时存在。
  3. 如果成功日志缺失、授权不可用或 Sheet 读取失败，计划时间超过 6 小时后才按时间兜底清理，避免永久残留。
- 卡片不会因为计划时间到点、Glip DOM 出现相同正文而直接删除；滚动区距离底部超过 160px 时只会暂时隐藏，回到底部仍可显示，这不等于缓存已清理。
- 关键实现：`src/glipComposeScheduler.ts`（入口与创建交互）、`src/background.ts`（Messages 创建和 5 分钟 Logs 同步）、`src/services/GlipMessageMarkerService.ts`（pending 缓存与清理）、`src/contentScriptGlip.tsx`（虚线卡片渲染）。

### 5. 灵活的表格结构 ✨

- **动态列位置识别**：通过 header 行自动识别列的位置
- **支持自由调整列顺序**：用户可以在 Google Sheet 中随意调整列的顺序
- **自动适配读写**：系统自动根据 header 确定数据的读取和写入位置
- **向后兼容**：自动适配旧版本和新版本的表格结构

### 6. 列表筛选与恢复路径

- 管理页支持按类别、待审核状态和“过滤掉仅发我的”筛选消息
- 筛选生效时会显示“列表筛选回执”：说明当前条件、显示 / 隐藏数量、各条件隐藏了什么；如果本机账号还没识别，“过滤掉仅发我的”会明确提示暂未生效
- 如果页面仍在后台补齐 Jira Automation 状态、Outreach runtime 覆盖或 Done 回填，筛选回执会标为“后台补齐中”，说明当前数量只是已读取 `Messages` 行的快照，补齐完成后会自动刷新
- “过滤掉仅发我的”按本机 Google 账号的邮箱本地名归一匹配，兼容 `esone.qiu`、`Esone Qiu`、`esone.qiu@...` 以及旧表里用 `+` 或逗号分隔的多人写法；多人或群组消息不会被当成仅发我的消息隐藏
- 多个筛选条件同时命中同一行时，回执会按条件分别计数并显示重叠提示，避免用户误以为某个筛选条件没有影响
- 回执会说明筛选只改变当前列表，不会暂停、删除、改期或同步 Sheet，并提供“清除筛选”恢复入口
- 筛选结果为空时会显示明确空状态和“清除筛选”按钮，不再只留下空表格
- 筛选逻辑由共享 helper 统一处理，便于入口链接和 UI 保持一致
- 自动答复通知中的“点击审核或取消”链接会带上 `messageId`，管理页打开后直接定位目标消息；如果目标消息已经不满足待审核 / 类别 / 个人提醒筛选，页面会显示“消息定位回执”，说明目标定位优先展示单行、哪些筛选被覆盖、当前状态，以及这只是查看定位，不会批准、拒绝、暂停、删除、改期、发送或同步 Sheet
- 目标消息不存在时，定位回执会明确说明当前 Messages 表未找到该行，并保留“返回完整列表”恢复路径
- 管理页的表格入口按任务拆分：“推送记录”打开 Logs；空状态和页脚的 Google Sheet 入口打开 Messages 维护表，避免批量编辑时误进日志页
- 状态列只展示状态；暂停 / 恢复改为行内显式按钮。`PendingReview` 必须通过批准 / 拒绝处理，`Done` / `Completed` 需要编辑到未来执行时间后恢复，避免误触绕过审核或重启已完成消息
- 暂停 / 恢复成功后会在页面顶部保留“定时消息状态回执”，写明 `Messages` 行从哪个状态切到哪个状态，Jira Rule 和 Outreach runtime 是否已同步，以及这次操作只切换排程状态，不立即发送、不改 Logs、不批准或拒绝待审核正文
- 新增 / 编辑保存成功后会自动定位刚保存的消息行，并在 URL 写入 `messageId`；页面顶部保留“定时消息创建 / 更新回执”，列出写入的 Messages 行、下次执行、频率、接收目标，以及“已保存但没有立即发送”的边界
- 删除成功后不只弹出一次性提示，而是在页面顶部保留“定时消息删除回执”；如果删除的正是当前定位行，页面会清除定位并返回完整列表，避免停在一个已不存在的消息过滤状态
- 新增 / 编辑保存过程中会用真实 in-flight 闸门拦截重复提交；即使用户连续回车、双击或浏览器重复触发表单 submit，也只会写入一次 Sheet，避免同一计划被重复创建
- 删除确认会列出消息 ID、状态、下次执行、频率和接收目标；托管 JiraAutomation 消息删除前会按本机时区把本地计划时间还原成 Jira 需要的 UTC trigger 时间，恢复前置检查或 Jira trigger 恢复失败时不会删除本地行
- 行内编辑 / 删除按钮带有包含消息标题、当前行快照和点击后果的 hover / 读屏标签；编辑会说明只是打开本地草稿、保存前不写 Sheet，删除会说明确认前不写 Sheet、确认后只删 Messages 行或先恢复托管 Jira Rule / 取消 Outreach 模板镜像
- AI Report 表单里的自定义版块增删改只影响当前弹窗草稿；按钮 hover / 读屏和内联回执会说明尚未写入 `Messages` / `AI_Body`，也不是删除已保存消息、历史发送或 Logs

### 7. 队列健康提示

- Bot / AI / JiraAutomation 消息由 Jira Automation 每分钟执行一条；管理页会汇总同一执行时间的排队情况
- 只有带有效 `AI_Endpoint` 的 JiraAutomation 消息会进入统一执行器队列；空白 endpoint 的外部规则不会被误判为 Bot / AI 队列
- 当同一时间槽可能超过 30 分钟补偿窗口时，顶部会显示风险提示，并列出受影响的时间槽和示例消息
- 明确时间的同槽排队会给出“改到建议”操作；即使尚未超出补偿窗口，也能把最晚受影响的消息改到下一个清晰分钟
- 队列卡片默认只显示有多少消息正在排队、多少时间槽拥挤、最大同槽数量、最大预计延后，以及是否需要调整；操作边界、建议处理项、前序样例和建议依据默认折叠，点击“查看详情”后再展开
- 点击“查看详情”会先显示“队列详情展开回执”，说明这是基于已读取 `Messages` 快照和本机时间计算的本地诊断、当前展示 / 未展开的拥挤槽位数量、风险数量，以及展开详情不会同步 Sheet、刷新 Jira Automation、改期、发送消息、改 Logs 或跳过前序
- 队列卡片会把“建议原因”保留在改期建议旁边，说明是同分钟前序阻塞、补偿窗口风险，还是 08:00 后队列容量不足；一键写入成功后的回执也保留同一条原因，避免用户点击后丢失为什么改到这个时间
- 队列卡片展开后会在操作按钮前显示“建议依据”：明确这是同槽明确时间还是 08:00 后队列、目标位置、前序阻塞数量、已展示 / 未展开的前序样例、建议写入目标，以及不会自动处理前序或发送消息的边界
- 队列卡片里的“定位最晚”和“编辑”按钮带有可读目标与边界：会说明要处理哪条消息、属于哪个时间槽 / 队列位置，以及这次点击只定位当前行或打开编辑草稿，不会写 Sheet、改期、发送或跳过前序消息
- 新增 / 编辑表单会实时提示当前消息在同槽队列中的位置；高风险时间会阻止保存，避免创建后才发现不会按预期发送
- 新增 / 编辑表单在明确时间已经拥挤时会直接给出“使用建议时间”；无时间队列如果快排到执行日结束后，会优先建议下一天默认队列日期，并清空执行时间保留“08:00 后队列”语义，减少手工试错
- 在表单内点击“使用建议时间”后，会留下草稿回执，说明已采用的目标时间、建议原因和“还没有写入 Sheet / 还没有发送”的边界；用户继续手动改日期、时间或执行方式时会清掉这条回执
- 无时间的 08:00 后队列会把当天后续明确时间消息占用的分钟扣掉；如果明确时间已经吃掉剩余容量，队列卡片会说明“已避开明确时间分钟”，并把最晚受影响项建议到下一可用队列日
- 已有 Active 消息如果因为手工改 Sheet 或长期未打开而错过可执行窗口，管理页会在顶部和行内提示需要改期；用户可以编辑为未来明确时间，或对执行器消息清空时间进入 08:00 后队列
- 错过执行窗口或执行时间格式异常时，顶部健康告警会给出“一键改期”：明确时间改到下一分钟，未设时间的执行器消息改回今天的 08:00 后队列，减少手工编辑阻塞
- 多条明确时间消息同时错过窗口时，一键改期会按告警顺序分配连续可用分钟，并在告警行直接显示建议操作，避免把所有恢复操作重新挤到同一个分钟
- 未设时间的执行器消息错过日期后，健康告警会先检查今天默认队列是否还剩可执行分钟；如果已经接近跨日或同批恢复会挤爆今天队列，就改到下一个可用默认队列日，避免“一键恢复”后立刻再次错过
- 需要改期的消息超过 4 条时，顶部健康告警可展开显示全部，保证每条阻塞项都有定位、编辑和一键改期入口
- 顶部健康告警默认只保留标题、条数摘要和可操作告警行；不再展开 triage 摘要、诊断分布或写回边界说明，减少首屏篇幅
- 每条健康告警只展示消息主题、错过的发送窗口，以及建议操作（通常是“改到下一可用分钟”）；定位 / 编辑 / 一键改期按钮保留在同一行
- 点击健康告警的一键改期后，当前行会先显示简短“写入中：改到 …”回执；写入成功或失败后再切换成最终回执
- 队列建议或健康告警的一键改期成功后，管理页会留下“已应用改期建议”回执，说明来源、写入的 Messages 行、是否清空 `Schedule_Time` 保留 08:00 后队列语义，并把“新计划已写入”和“执行器已领取 / 发送 / 写 Logs”分开确认
- 队列建议、表单草稿和改期成功回执仍会显示“写入后领取口径”：明确建议时间会走未来明确时间槽、30 分钟补偿链路还是 `08:00 后队列`，避免用户把“已写入建议”误看成“已经发送 / 已经被 Jira 确认执行”
- 一键改期如果找不到目标行、没有可应用建议或写入 Google Sheet 失败，不再只弹出一次性提示；页面会保留“改期建议未应用”回执，说明来源、目标、未写入边界、失败原因和下一步恢复动作
- 队列建议在点击前仍会说明操作边界：按钮只写回 `Messages` 的 `Schedule_Date` / `Schedule_Time`，不会立即发送、不会改 Logs 或跳过前序消息；写入后仍要同步刷新或等待下一轮 Jira Automation 确认当前队列是否恢复

### 8. 执行匹配、补偿与幂等

- 当前实现不使用独立 `Priority` 字段；同一执行槽命中多条 Bot / AI / 带 `AI_Endpoint` 的 JiraAutomation 消息时，按 Messages 表格行顺序每分钟执行第一条
- 执行器按三段顺序匹配：当前分钟显式时间消息、过去 30 分钟补偿窗口、执行日 08:00 后未填写时间的队列消息
- 显式时间只允许准点或最多迟到 1 分钟的触发器抖动容差，不会提前发送；补偿窗口支持跨午夜恢复
- `Last_Exec`、`Exec_Log` 和 `Execution_Key` 共同提供轻量幂等：当天成功或失败的消息都会跳过，避免失败项阻塞后续队列或 Jira 重试造成重复发送
- `markBotMessageExecuted` 会携带 `messageId` / `rowIndex` / `executionKey` 写回，Sheet 行移动、缺失 rowIndex 或 Jira 重试时仍能定位并去重
- `getBotMessageCurrentTime` 支持 `autoMarkOnFetch=api`；对 AgentTask / AI Report / 自定义 API，领取阶段只写 `⏳ …已领取待确认`（claimed），**不写最终 ✅**。最终成功由 `confirmBotMessageTriggered` 在下游（Dify / 第三方 API）调用成功后回写。普通 Bot 和 RingCentral sender 仍在发送回调后写 `Last_Exec` / Logs。
- 管理页的执行引擎回执会把这条边界讲清楚：Bot/RingCentral sender 是发送后回调写回，AI/API 和带 `AI_Endpoint` 的托管 JiraAutomation 是领取时先写 `Last_Exec` / Logs 防重复，endpoint 运行结果需要回到 Jira/API 执行记录排查
- 管理页列表、队列建议和改期回执会显示“领取口径”：明确时间槽走当前分钟 / 30 分钟补偿，未填写时间的 Bot/AI/托管 JiraAutomation 走 `08:00 后队列`，AsMe 不进入这个队列，外部 JiraAutomation 和 Outreach 会显示它们不由 Personal AI executor 领取；新增 / 编辑弹窗和顶部健康告警默认不展开这些细节
- 领取口径会同时写出证明边界：Bot/RingCentral sender 只有发送回调后才算写回，AI/API 领取时先写回防重复但 endpoint 成败要看 Jira/API 运行记录；因此“领取”不会被误看成“已发送”
- 明确时间的 Bot / AI / 托管 JiraAutomation 如果已经错过当前分钟但仍在 2-30 分钟补偿窗口内，列表行会显示“补偿窗口回执”：可见文案写明下一轮仍可补偿领取且尚未发送，hover / 读屏说明三段匹配顺序、`08:00 后队列` 优先级边界，以及 `Last_Exec` / `Exec_Log` / `Execution_Key` 幂等跳过依据
- 当未填写时间的执行器队列排到当天结束后，建议改期会继续保持 `Schedule_Time` 为空，而不是改成明确 `08:00`；这样用户看到的“08:00 后队列”不会被一键恢复误改成准点优先执行
- 健康告警的一键改期建议会避开已存在的未来明确执行分钟；批量修复错过项时不会把恢复动作重新制造成同槽排队
- `AI_Body` 支持 `{Topic}`、`{Content}`、`{TeamID}` 和 Timeline 变量；变量替换会做 JSON 字符串转义，避免正文里的引号、反斜杠或换行破坏外部 API body

### 9. Config 同步与跨设备恢复

- `Config` 工作表是跨设备恢复来源，`chrome.storage.local` 只是本机运行缓存；同步时先写 Sheet，再写本地，避免出现“本机成功但另一台设备无法恢复”的半同步状态
- Config 写入使用 Google Sheets `RAW` value input option，保留 rule id、URL、ISO 时间戳、JWT 状态等精确字符串
- 每次写回会带上 `last_sync_action`，例如一键初始化、手动绑定、Bot 配置、Sheet schema 更新或 App Script 元数据更新；手动绑定冲突时会把这个来源和字段差异一起展示，方便判断最近是谁改过配置
- 写回时只替换系统管理键，保留用户或后续功能添加的自定义 Config 键；重复的系统管理键会收敛成单行，重复 `last_sync_time` 会按真实时间取最新值
- 写回前会比较远端 `last_sync_time`：远端更新时暂停写入并要求重新读取；同表但本机较新、时间相同或时间缺失且关键字段不同，会展示字段级差异让用户选择保留本机或使用 Sheet
- 管理页“同步”会先读取 Sheet Config；只有 Sheet 明确更新时才刷新本机缓存，并在页面横幅展示同步时间、最近动作和采用的配置来源。时间相同但内容有差异时不会静默覆盖。
- 当同步时间相同或无法判断但关键配置不同，管理页会继续采用本机缓存，同时在横幅里展示最多 3 条已脱敏的 `本机` vs `Sheet` 字段差异和“重新绑定查看全部差异”的恢复路径；Webhook、JWT、client secret 等敏感值仍只显示配置状态。
- 管理页“同步”按钮在 hover / 读屏里会提前说明点击后会读取 Sheet Config、按新鲜度决定是否刷新本机缓存、只在缺少子表定位时写回 Config Sheet，随后读取 Messages / Logs；不会发送消息、执行队列、改 Logs、批准或删除计划。
- 同步横幅会明确本次采用的是 `Sheet Config` 还是本机缓存，并写出读写边界和下一步动作；例如 Sheet 读取失败时会说明仍在用本机缓存刷新 Messages，而不是把失败误看成已拿到 Sheet 最新配置。
- 手动“同步”有单飞保护：同步进行中会保留当前列表、禁用同步按钮并显示运行中回执；连续点击不会启动第二个 Config 读取、Messages 刷新或子表定位写回，也不会立即发送任何消息。
- 运行中回执会先说明“采用配置待确认”：此时只是读取 Sheet Config，尚未决定是否采用 Sheet；只有确认 Sheet 更新时才写本机缓存，只有缺少子表定位时才写回 Config Sheet，运行中不会改 `Messages` / `Logs` 或执行队列。
- 手动同步完成后，横幅会把 Config 阶段和 `Messages` / `Logs` 刷新阶段合在一起说明：如果 Config 采用成功但消息列表读取失败，会显示“Messages 刷新失败”，保留采用来源、Config 阶段结果、失败原因和“未发送 / 未执行队列 / 未改 Logs”的边界；如果消息列表成功读取，会显示本次读取到的消息数，避免把 Config 阶段成功误看成整次同步完成。
- 管理页打开后不会为了 AgentTask 执行入口自动读取或写回 Sheet Config；如果当前 `Messages` 快照里已有 `AgentTask` 行但本机 Config 缺少 `agent_task_webhook_url`，只显示“帮我做执行入口待确认”回执，说明页面打开只检查本机缓存和当前列表，未写 Config、未领取任务，下一步是手动同步或保存“帮我做”时补齐。
- 手动绑定支持 Google Sheets / Drive URL、`/spreadsheets/u/0/d/...` 路径和完整 Sheet ID；非 Google URL 不会因为普通 `id` 参数被误识别为维护表
- 切换到另一张维护表前会进入确认流程；Webhook、JWT、client secret 等敏感值只显示配置状态，不展示原文
- App Script 版本元数据也走 Sheet-first 完整同步；升级成功并确认当前 Web App URL 已返回目标版本后，才把 Sheet / Storage 标记为最新
- Bot / Jira rule 配置流程会先完成 Jira 规则更新，再把 updater 返回的最新 rule metadata 纳入最终 `bot_config_update`；中途不会提前写 Sheet 或本机缓存，避免同一次保存里的旧本机基准覆盖 Sheet 新配置
- 旧版 `bot_executor_*` 配置键不再写入 Sheet 或本机缓存；读取旧表时仍会用它们做一次性迁移兜底，但任意新版 Config 写回都会清理这些旧键，只保留 `bot_automation_executor_*`

### 10. Timeline 缓存与 Jira Groovy Map 兼容

- Timeline Sync Rule 每天 05:00 按项目读取内网 release info，并把每个项目缓存到 Apps Script Script Properties；Executor Rule 每分钟只读取缓存，不再在执行请求里携带完整 releaseInfo
- 当前生成的 Timeline Sync Rule 对 App Script `WEB_APP_URL` 回调必须保持 `GET`，URL 包含 `action=cacheReleaseInfo`、`project` 和 URL 编码后的 `releaseInfo`；不要改成 POST，Jira Automation 对 Apps Script `ContentService` 的 POST 302 重定向兼容性仍有风险
- Apps Script 仍保留 POST JSON、旧 inline 参数和 Groovy/Java Map fallback parser，主要用于旧 Rule、手工诊断或兼容输入；当前可维护路径以生成的 GET Rule 为准
- `cacheReleaseInfo` 会校验项目、schema、嵌套深度、字符长度、Script Properties 单值约 9KB 限制，以及至少一个 `MM/DD/YYYY` milestone 日期；非法日期、空日期或非字符串 milestone 不会出现在 UI 可选项里
- Timeline 项目在界面和执行端会兼容项目显示名与 Jira Sync Rule 参数名，旧 Sheet 或手工行里保存的 `jupiterWeb` 这类参数不会因为状态面板或执行器只认 `Jupiter web` 而静默跳过
- Timeline 缓存状态面板默认只显示当前项目缓存“可用 / 不可用 / 待检查”的结论；不可用或可用但有同步警告时才显示 `i` 信息按钮，点击或悬浮查看诊断范围、最近同步摘要、错误码、`requestId`、执行影响和下一步排障建议
- 信息按钮展开后提供“复制诊断”，把当前项目状态、`requestId`、缓存 Milestone、GET 修复模板、dry-run curl 和 Jira Sync Rule 链接复制到本机剪贴板；它不会刷新缓存、不会写 Timeline 缓存，也不会保存或发送消息
- 扩展里的 dry-run 也走 GET + `dryRun=true`，不会写入缓存或覆盖真实 Jira 同步诊断，也不会保存或发送当前消息
- 如果项目缓存仍可用但最近一次真实同步失败，状态面板主状态会直接显示“当前使用已有缓存，最近同步失败”；执行影响会继续区分 Timeline 触发仍按旧缓存命中、项目变量仍按旧缓存替换，但后续发布节奏可能停在旧 release info
- dry-run 成功只说明 Apps Script Web App 可访问且样例 payload 通过预检；面板会显示验证范围，并继续提示它不会写 Timeline 缓存、也不代表真实 Jira Sync Rule 已同步，下一步仍要在 Jira 手动运行 Rule 后刷新状态确认真实缓存
- 新增 / 编辑不会因为缓存缺失而阻止保存，但会明确说明执行后果：Timeline 触发会跳过到项目缓存可用且包含所选 Milestone，普通定时消息里的项目变量会在缓存不可用时保留原样
- 如果看到 `INVALID_POST_JSON`，通常说明手工规则仍在用 POST 或 body 不是合法 JSON；当前修复方向是把 Apps Script 写缓存请求改回生成规则的 GET URL

### 11. App Script 自动更新

- App Script 自动更新使用 Google Apps Script API 的 `deployments.update` 更新现有 Web App deployment，保持 Web App URL 不变，避免用户重新配置 Jira Automation
- 当前模板版本来自 [app-script-template.gs](/Users/Esone/git/personal-ai/src/scheduled-messages/app-script-template.gs)：

  ```javascript
  var APP_SCRIPT_VERSION = '2.12.1';
  var APP_SCRIPT_LAST_UPDATED = '2026-08-17';
  ```

- 后台静默检查只复用已缓存授权，不在页面加载时弹出授权窗口；它只读取线上版本，不会在打开管理页时回写 Config 或触发 Sheet 写保护。用户手动点击“检查脚本”或“升级调度系统”时才触发交互式授权，并保留必要的 Sheet-first 元数据同步。
- 升级前会验证模板版本是合法 SemVer、匿名读取当前 Web App `getVersion`、匹配正式 deployment 的 Web App URL、通过 `projects.getContent` 确认远端项目属于 Personal AI 调度脚本，并预检 Project History 200 个版本上限
- Config 表里的 `app_script_version` 只是最近一次同步缓存；排查线上行为时以 Web App `?action=getVersion` 返回为准
- 版本探测会使用不携带 Chrome profile cookie 的匿名请求，避免 Google 多账号登录态重定向到错误的 `/u/N/` 账号上下文；版本探测临时失败或非 JSON 响应不会被当成旧版脚本，非 JSON 响应也不会按旧版脚本继续升级
- 如果“检查脚本”无法确认版本，管理页会保留当前脚本不变，并提供直接打开 `getVersion` 版本端点和 Apps Script 项目的排障入口，方便确认 Web App URL、访问权限或 deployment 状态
- 若线上 Web App 已是最新或更高版本时直接跳过脚本写入和版本创建；自动静默检查只更新页面提示，手动检查或升级路径才会同步配置状态
- 写入前会预检是否存在可更新的正式 Web App deployment、确认 Web App URL 匹配、读取远端项目代码确认 Personal AI 调度脚本标记，并检查 Project History 版本额度
- 当 Project History 已满或接近 200 个版本上限时，升级提示会同时提供 Project History 入口和“重新检查”，用户清理旧版本后不用刷新页面就能重新读取额度并继续升级
- “检查脚本”“重新检查”“打开 Project History”“打开版本端点”“打开 Apps Script”“升级调度系统”和升级结果里的“打开检查页面”按钮都会在 hover / 读屏中说明本次点击是只读检查、打开恢复页面、清理版本入口，还是会进入升级确认；按钮文案同时保留当前/目标版本、Project History 额度、是否写 Sheet/Script/Jira Rule、是否确认 Web App 新版本和失败回退边界
- 可升级横幅会在点击前显示“升级证明回执”：版本历史已满时说明主操作只是打开 Project History；可升级时说明只有 Web App `getVersion` 返回目标版本才会把 Sheet / Storage 标记最新，未确认时保留旧配置并进入回退 / 检查页面，不发送消息或改 Logs
- 用户确认“升级调度系统”后会先显示“App Script 升级请求回执”，说明 Sheet、App Script deployment 和 Jira Automation 正在依次检查，并明确 Web App URL 新版本、Sheet / Storage 最新标记、Jira rule 更新和渠道投递都还没有确认
- 只有写入代码、创建版本、`deployments.update` 成功，并且当前 Web App URL 的 `getVersion` 已确认返回目标版本后，才同步 Sheet / Storage 里的版本字段
- 部署生效确认未确认返回目标版本时，不会把配置标记为最新
- 如果 deployment 已提交但版本端点无法确认目标版本，系统会尝试把 deployment 回退到升级前的 versionNumber，并在 UI 中保留可恢复的错误说明
- 用户执行“升级调度系统”后，页面会留下“App Script 升级结果回执”：汇总 Sheet、App Script、Jira Automation 三段结果，说明“已是最新时跳过脚本写入、失败项保留现有版本”的边界；如果需要清理 Project History、检查 deployment 或确认版本端点，回执会保留检查入口，避免只靠弹窗记忆恢复步骤
- **Google Workspace 域策略可以整体禁用 Web App 的匿名访问**（`webapp.access: ANYONE_ANONYMOUS`），此时升级会收到 Google 400 `"ANYONE access has been disabled by your domain administrator"`（`AppScriptDomainPolicyAccessError`，errorCode `APP_SCRIPT_DOMAIN_POLICY_ACCESS`）。已部署的旧版本可能仍在“祖父条款”豁免下继续匿名可用（`?action=getVersion` 仍能匿名访问），但**新部署会被拒绝**——这不是一次性故障，域策略没变之前每次升级都会复现
  - manifest 里的 `executionApi` 字段是死配置（项目只走 `/v1/projects` API 和 Web App `/exec`，从不调 `scripts.run`），升级不再声明它；升级写 manifest 时会**保留线上已部署的 `webapp.access` 原值**而不是重新声明成 `ANYONE_ANONYMOUS`，因为已部署的值可能正处在豁免状态，重新声明反而更容易被拒
  - 遇到这类域策略拒绝后，自动升级会退避 24 小时（写 `appScriptDomainPolicyBlockedUntil`），避免反复失败白白消耗 Project History 200 个版本的额度；手动点击“升级调度系统”不受此退避限制，域管理员刚放开时可以立即重试
  - 之所以 Web App 必须匿名：真正的调用方是 Jira Automation（`jira-rule-template.json`），它只能发静态请求头，无法完成 Google OAuth、也拿不到/刷新不了短期 access token。这意味着只要 Jira 还需要直接读写这个 Web App，匿名访问就是硬需求，域策略和这个需求天然冲突
  - **风险**：现有部署的匿名豁免可能随时被 Workspace 回收，届时整条「Jira Automation → Apps Script → memory-service」触发链路会立即中断，且在域策略不变的前提下无法重新部署恢复。根治方向是让 Jira 直接带鉴权头调用 memory-service、不再依赖 Apps Script 做匿名中转——这条迁移在 [agent-task-ledger-plan.md](../progressing/agent-task-ledger-plan.md) 里展开，本文档只记录域策略本身的行为事实

## 使用方法

### 首次使用

1. 点击 Personal AI 插件图标
2. 选择"⏰ 定时消息管理"
3. 点击"🚀 一键生成维护表"按钮
4. 等待系统创建维护表、Apps Script 项目和 Web App；页面会显示初始化收据，包括 Messages / Logs 子表定位和 Web App deployment
5. 打开授权页面并授权 Apps Script，然后回到管理页继续初始化
6. 初始化完成后，分钟触发器、示例消息和 Config 会写入维护表；刷新到管理页后会显示一次性完成收据，如果组织内共享失败，维护表仍保持仅创建者可编辑
7. 一分钟后，您将收到测试消息

### 创建定时消息

#### 方式一：在 Google Sheet 中添加

1. 点击"打开 Sheet"按钮
2. 在 Messages 表中添加新行
3. 填写必要字段：

   - **ID**: 唯一标识（如 msg_001）
   - **Topic**: 消息主题
   - **Content**: 消息内容
   - **Schedule_Date**: 执行日期（YYYY-MM-DD）
   - **Schedule_Time**: 执行时间（00:00-23:59，本地时间，可选）
   - **Push_Method**: 推送方式（AsMe/Bot/AI/Outreach）
   - **Owner**: 创建者
   - **Status**: 状态（Active/Paused/Completed）

   **AsMe 推送额外字段**：

   - **Glip_User_Name**: 接收人用户名（如"Esone Qiu"）

   **Bot 推送额外字段**：

   - **Glip_User_Name**: 私聊时的用户名（填写则为私聊）
   - **Glip_Team_ID**: 群组推送时的群组 ID（填写则为群组推送）
   - 💡 **推送类型自动判断**：系统根据 Glip_User_Name 和 Glip_Team_ID 自动识别私聊还是群组

   **AI 推送额外字段**：

   - **AI_Endpoint**: API 端点（必填），格式：`POST https://example.com/api`、`GET https://example.com/api` 或仅 URL（默认 GET）
   - **AI_Headers**: HTTP 请求头（可选），每行一个，格式：`name: value`
   - **AI_Body**: 请求体（必填），JSON 格式，支持使用 `{Topic}`、`{Content}` 变量

   **Outreach / 帮我问额外字段**：

   - **Content**: 实际要问的问题
   - **Glip_User_Name**: 目标是某个人时填写
   - **Glip_Team_ID**: 目标是某个群时填写
   - 信息目标/完成标准、目标解析、追问策略和运行态结果下沉到 memory-service；新表不再把这些运行态字段作为 Sheet 主 schema 保存

#### 方式二：通过管理界面创建

1. 点击管理页面右上角的“➕ 新增”按钮
2. 先在弹窗顶部 tab 选择任务类型：左侧 `AsMe / Bot / AI Report`，右侧 `帮我问 / 帮我做`
3. 填写消息主题、内容以及执行时间
4. 按当前任务类型填写对应字段：
   - **AsMe**：按接收人添加人名标签
   - **Bot**：选择私聊或群组，并填写 Glip 用户名或群组 ID
   - **AI Report**：选择模板（AI report / PEP report / Multiple Jira Query / 自定义），系统会为每个模板分别记住 Endpoint / Headers / Body
   - **帮我问**：选择问某个人还是某个群，填写问题、信息目标和追问策略；缺少 Outreach / RingCentral 配置时可先填草稿，保存会被阻止
   - **帮我做**：填写任务描述（写入 `Content`），可选开启结果通知（私发/群组目标 + 可选模板 + Bot/AsMe 发送身份）与成功回执；失败回执始终由 Bot 私发本人。缺少 Bot executor / OpenClaw 时可先填草稿，保存会被阻止；选 AsMe 身份时还需要与顶部 AsMe tab 同一套 RingCentral sender 配置
5. AI Report 模式下默认选中 **AI report** 模板，切换到 **自定义** 时可以手动填写并保存专属配置
6. 执行日期 / 时间支持快捷选择：1 分钟后、下个整点、下次默认时间（AsMe 09:00，Bot / AI / JiraAutomation 08:00）或清空时间
7. 表单会简洁显示预计下次执行日期时间；一次性任务若已经错过可执行窗口，会提示改成未来时间
8. 周期任务若因为结束日期或重复星期设置导致没有下一次执行机会，会在预计执行区域显示“暂无可执行时间”，并阻止保存
9. 未填写执行时间时，AsMe 默认按 09:00 执行；Bot / AI / JiraAutomation 默认从 08:00 后进入队列，每分钟执行一条
10. 点击“✅ 创建消息”完成创建；保存成功后列表会自动定位到刚创建的行，并显示持久回执，确认写入行、下一次执行时间和发送前仍可编辑 / 暂停 / 删除的恢复路径

#### 方式三：从 Glip 输入框快速创建

1. 在 RingCentral/Glip 消息输入框中写好草稿，点击工具栏里的闹钟按钮。
2. 选择快捷时间或自定义未来时间；扩展自动识别当前私聊或群组目标。
3. 创建成功后草稿清空，消息列表底部显示虚线未来消息；需要编辑、改期或删除时点击“管理”进入 Scheduled Messages。
4. 到点后以 Logs 中同一 `Message_ID` 的 `Success` 为发送完成依据；正常情况下虚线卡片会等下一轮约 5 分钟的 marker 同步后消失，授权或 Sheet 读取失败时可能更久。

### 管理列表筛选

- “只看待审核”用于快速处理自动答复审核队列
- 类别筛选支持多个类别，按并集匹配
- “过滤掉仅发我的”用于隐藏只发给当前账号的个人提醒
- 打开筛选后先看“列表筛选回执”：它会告诉你当前显示多少条、隐藏多少条，以及隐藏来自待审核 / 类别 / 个人提醒中的哪类条件
- 如果回执标题是“后台补齐中”，当前数量只是 `Messages` 快照；等 Jira / Outreach / Done 回填结束后列表会自动刷新，不代表已经确认最终执行状态
- 从自动答复通知打开时，页面会优先展示目标消息；如果该消息已处理或不满足当前筛选，仍会显示当前状态和被覆盖的筛选条件，避免用户在待审核列表中找不到记录
- 如果筛选后没有结果，页面会提示当前筛选条件并提供一键清除筛选
- 需要批量调整维护数据时，页面底部和空状态的 Google Sheet 链接会直接打开 `Messages` 工作表；需要查看发送历史时使用顶部“推送记录”按钮打开 `Logs`

### 队列健康查看

- 顶部队列提示只在存在同槽排队时出现；没有排队风险时不会占用界面
- 普通排队提示默认只显示摘要；需要最大同槽数量、预计延后时间和建议依据时再展开详情
- 明确时间槽出现排队时可以直接定位、编辑或把最晚受影响消息改到建议时间
- 队列提示默认折叠具体槽位，只显示排队总量、拥挤槽位数、最大同槽、最大预计延后和是否需要调整；展开后每个拥挤槽位会标出“建议处理”的最晚消息，同时显示前面会先执行的数量、前序样例、未展开前序数量和建议原因
- 展开后的定位 / 编辑按钮会在可访问标签里带上消息、槽位、队列位置和无写入边界，键盘操作时也能确认当前动作不是改期或发送
- 风险提示表示至少一个时间槽可能超过 30 分钟补偿窗口，建议改成未来明确时间，或清空执行时间进入 08:00 后队列
- 未填写时间的执行器队列会扣除同一天未来明确执行时间占用的分钟；如果剩余可用分钟不足，卡片会显示已避开的明确时间分钟数，并建议保留空时间移动到下一可用队列日
- 创建或编辑消息时，如果系统已经能算出可避开拥挤队列的空闲分钟，预计执行区域会提供“使用建议时间”；未设时间的队列排满当天时会优先建议下一天 08:00 后队列，并保持执行时间为空
- 如果顶部提示“有定时消息需要改期”，表示有 Active 一次性消息已经错过实际执行窗口或时间格式异常；这些消息不会只靠等待自动恢复，需要从列表行进入编辑并改成未来时间
- 健康告警行只保留消息主题、错过的发送窗口和建议操作，并提供定位、编辑、一键改期；不再在顶部展开 triage、诊断线索或写回边界长文
- 健康提示里的“一键改期”会直接把目标消息恢复到可执行窗口：明确时间改到下一分钟，未设时间的执行器消息改到今天的默认队列，AsMe 默认时间已过时会移到下一个默认发送日
- 如果今天的执行器默认队列已经没有剩余分钟，或同批恢复会让后面的未设时间消息排到今天结束后，健康提示会把后续项改到下一个可用默认队列日
- 当需要处理的健康告警超过 4 条时，先显示前 4 条和隐藏数量；点击“显示全部”后可逐条处理其余消息
- 表单打开时会自动刷新时间判断，长时间停留后仍能正确阻止已错过的执行时间
- 点击队列建议的“改到建议”前先看该区域操作边界：它只改维护表里的排程字段，不代表消息已经发出，也不代表队列已重新计算完成；写入后使用同步刷新或等待下一轮执行器轮询确认

### 消息类型说明

#### Daily（按日期）

- 在指定日期执行一次
- 必填字段：Schedule_Date

#### Hourly（按时间）

- 在指定日期的指定时间执行一次
- 必填字段：Schedule_Date, Schedule_Time

#### Periodic（周期性）

- 按固定周期重复执行
- 必填字段：Schedule_Date, Repeat_Every, Repeat_Unit
- 可选字段：End_Date（结束日期）, Repeat_Count（重复次数）, Repeat_Days（多选日期）
- End_Date 表示最后允许执行的日期，结束日当天仍会执行匹配的任务
- Repeat_Count 表示最多成功发送次数，适用于天 / 周 / 月 / 年重复任务
- Repeat_Unit 可选值：
  - Day: 每 N 天（排除周末）
  - Week: 每 N 周
    - 支持多星期选择：可通过 Repeat_Days 指定一周多天执行（如周一、三、五）
    - Repeat_Days 格式：逗号分隔的数字（0=周日, 1=周一...6=周六）
    - 示例：`1,3,5` 表示每周一、三、五执行
    - `Repeat_Every > 1` 时会按开始周计算间隔，例如每 2 周的周一/三/五不会退化成每周执行
    - 特殊情况：工作日（1,2,3,4,5）、周末（0,6）会显示为"工作日"、"周末"
  - Month: 每 N 个月
  - Year: 每 N 年

### 推送方式说明

#### AsMe（以我的身份发送）

- 默认通过 Google Mail 发送邮件到 Glip 邮箱，在 Glip 中显示为用户本人发送的消息
- 自动生成 fallback 邮箱地址：
  - `Esone Qiu` → `esone.qiu@reply.ringcentral.glip.com`
  - 或直接使用群组 ID：`{teamId}@reply.ringcentral.glip.com`
- 如果 Bot 初始化时配置了 RingCentral Client ID / Client Secret / JWT，AsMe 会改由 **Jira Automation** 调内网 Dify RingCentral sender workflow 发送
- RingCentral sender 的 Dify 导出在 [src/scheduled-messages/dify/ringcentral_dify_workflow_split_credentials.yml](../../src/scheduled-messages/dify/ringcentral_dify_workflow_split_credentials.yml)；Jira Rule 使用 `RINGCENTRAL_SENDER_DIFY_API_BASE_URL` / `RINGCENTRAL_SENDER_DIFY_API_KEY`，不直连 RingCentral API
- RingCentral sender 路径继续复用 `Glip_User_Name` / `Glip_Team_ID` 作为 Dify `chatId`；例如 `Glip_User_Name = esone.qiu` 会传给 Dify 的 `chatId`
- 创建 RingCentral app / JWT 时至少需要 `ReadAccounts`、`ReadMessages`、`EditMessages` 权限；`ReadAccounts` 用于读取公司通讯录，把 `esone.qiu` 这类 personName 解析成 person id。缺少该权限时 OAuth 仍可能成功，但 directory endpoint 会返回 `403 InsufficientPermissions`，并导致 sender workflow 报 `Cannot resolve target personName`
- RingCentral sender 不再在领取消息时预标记完成；Jira Rule 会在 Dify workflow 返回 `data.status = succeeded` 后通过 GET 调用 `markBotMessageExecuted` 写回 Done 和 Logs，返回 `failed` 时写入失败日志避免当天重复发送；发送成功后的 `chatId/postId/sentAt` 记录在 Logs 单次执行行中，用于 Glip message marker
- 未配置或关闭 RingCentral sender 时，仍由 **AppScript 引擎**执行邮件 fallback
- 2026-05-26 起，表单和列表会直接显示当前 AsMe 实际执行路径，避免用户误以为所有 AsMe 都走同一个引擎。
- 老版本 Sheet 如果已有 Bot executor rule 但没有 `ringcentral_sender_*` 配置，新建消息弹窗选择 AsMe 时会提示配置 @ 人发送能力；提交完整 RingCentral credentials 后，会先删除低于 v1.4.0 的旧 executor rule，再创建支持 Dify sender 的新版 rule

#### Bot（机器人身份发送）

- 通过 Jira Automation 调用 Bot API；因 Jira 出站限制，私发 / 群发改为经 Dify botman jumpboard 转发，导出见 [src/scheduled-messages/dify/botman-jumpboard.yml](../../src/scheduled-messages/dify/botman-jumpboard.yml)
- 在 Glip 中显示为机器人（SM AI）发送的消息
- Bot 路由和凭据由扩展配置 / Jira Automation 规则 / Dify 环境变量维护，不需要在单条消息里额外填写专属 endpoint 字段
- 群组消息需要先把 “SM AI” 加到目标群；私发不需要
- 由 **Jira Automation 引擎**执行（同时负责 AI 推送），解决内网访问限制

#### AI Report（AI 报告推送）

- 通过 Jira Automation 调用外部 API，发送结构化报告
- 提供 **AI report / PEP report / Multiple Jira Query / 自定义** 四种模板，并为每种模板保留独立配置
- 默认 AI report 模板对应 Dify advanced-chat 应用，导出见 [src/scheduled-messages/dify/AI report.yml](../../src/scheduled-messages/dify/AI%20report.yml)
- `AI_Endpoint` 与 `AI_Headers` 会根据模板自动填充，可随时切换；`AI_Body` 可直接编辑并支持 `{Topic}`、`{Content}` 变量
- 自定义模板支持完全自由填写 Endpoint / Headers / Body，切换模板时系统会记住各自的输入

#### Outreach（帮我问 / 主动询问）

- 这不是普通消息推送，而是一个 **主动询问计划**
- Sheet 中保留的是计划入口；真正的运行时状态在 memory-service 的 `outreach_templates / outreach_sessions / outreach_events`（表名沿用内部 template 命名）
- 发送前会先做 **目标解析**，确认应该问谁
- 真正触发时会先做 **答案预检**
  - 第一层：检查目标群 / 目标私聊在本次计划窗口内的最近会话消息
  - 第二层：检查全局记忆中是否已经存在其他群里的相关答复
- 如果在发送前已经命中答案，则 **不发出消息**
- 如果在等待回复期间仍未收到直接回复，每次追问前也会再次做同一套预检；若已命中答案，则 **不再追问**
- `Outreach_Context` 在兼容层仍沿用旧列名，但产品语义是 **信息目标 / 完成标准**：答案预检、直接回复判断和外部查证都必须判断证据是否满足这个目标；只拿到部分线索时保持等待或继续追问，不把 `partial` 当成 `resolved`
- 用户在定时消息列表中看到的是计划状态和最近结果；更完整的证据、命中阶段、来源与相关消息会在“主动询问 / Outreach Sessions”页面中查看
- 系统会为 Outreach 动态挂载内部观察规则用于证据采集，但这些规则不会显示在“记忆入口规则”或 “Follow Threads” 列表中
- 周期性 Outreach 计划复用定时消息的本地日历语义：Day 排除周末，Week 支持多星期，End_Date 包含当天，Repeat_Count 达到后不再生成下一次发问
- 循环计划本身会留在“待触发计划”里；每个周期会独立创建一个 `outreach_sessions` occurrence，已发出 / 已完成的 occurrence 进入历史记录
- 每个 occurrence 会记录 `scheduled_for`、`occurrence_key` 和 `occurrence_start_at`；循环计划的 `occurrence_start_at` 优先取上一条 occurrence 的终态时间，发送前答案预检只把本次窗口内的证据当成本周期答案，避免用上一周的结论误判本周已经完成
- `scheduleSpec.timezone` 记录创建计划时的本地时区，服务端会按该时区解释 `Schedule_Date` / `Schedule_Time`，避免本地 10:36 被服务端时区漂移成 18:36

#### Outreach 典型状态

- `pending_approval`：目标未解析完成，或需要人工批准后才能发出
- `scheduled`：已排程，等待发送
- `waiting_reply`：已经发出，正在等答复
- `deferred`：对方表示稍后回复，系统等待新的时间点
- `resolved`：已获得满足信息目标的可用结果，可能来自直接回复，也可能来自发送前 / 追问前的答案预检
- `no_reply`：达到等待和追问上限，仍然没有有效答复
- `escalated`：需要人工介入处理
- `failed`：发送、轮询或配置异常

**预设模板默认值**：

- **AI report（Dify）**

  - Endpoint：`POST https://dify.int.rclabenv.com/v1/chat-messages`
  - Headers：
    - `Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y`
    - `Content-Type: application/json`
  - Body：
    ```json
    {
      "response_mode": "blocking",
      "user": "default-user",
      "query": "{Topic}",
      "inputs": {
        "title": "{Topic}",
        "outputs": "tickets",
        "jql": "{Content}",
        "extraText": "",
        "teamId": "",
        "mentionList": "",
        "ticketIncludes": "summary, status, assignee, reporter"
      }
    }
    ```

- **PEP report（GitLab Reviewer）**

  - Endpoint：`POST https://gitlab-reviewer.int.rclabenv.com/pep_daily_report`
  - Headers：`Content-Type: application/json`
  - Body：
    ```json
    {
      "jira_query_id": 111,
      "sheet_id": "",
      "sheet_name": "",
      "team_id": "",
      "mention_list": [],
      "overallFilterId": "",
      "bugFilterid": "",
      "ignore_due_soon": true,
      "force_running": true,
      "missing_due_check_scope": "all",
      "language": "",
      "milestones": [
        {
          "abbreviation": "MR",
          "full_name": "Code Merge",
          "goal": "提测所有功能及安排在本Release的Production Bug"
        },
        {
          "abbreviation": "FF",
          "full_name": "Feature Freeze",
          "goal": "1）完成所有功能测试；2）完成安排在本Release的所有Production和Release Bug (接近FF 2天内的P2 bug可以Regression阶段修复）"
        },
        {
          "abbreviation": "CF",
          "full_name": "Code Freeze",
          "goal": "完成所有本Release的功能开发、测试和Bug修复。完成Sign off。提供Dogfooding Build"
        }
      ]
    }
    ```

- **Multiple Jira Query report**

  - Endpoint：`POST https://pep.int.rclabenv.com/multiple_jira_query_notify`
  - Headers：`Content-Type: application/json`
  - Body 默认包含 `team_id` 和多条 Jira query 配置，可按团队报告需求调整

- **自定义**：Endpoint / Headers / Body 均由用户填写，模板切换后仍会保留已输入内容

- 🎯 **单条消息推送**：每分钟执行一条（覆盖 Bot / AI），避免批量失败
- 📊 **三级优先级**：当前分钟 > 过去 30 分钟 > 未指定时间（8 点后）
- 🛡️ **智能过滤**：自动跳过今日已成功/已失败的消息
- 🔄 **自动重试**：失败消息第二天自动重试

## 技术架构

### 数据流

```
用户操作
    ↓
Chrome Extension 管理界面
    ↓
Google Sheets（统一数据源）
    ↓
    ├─→ AppScript Trigger（AsMe 邮件 fallback）
    │   └─→ minuteTrigger（每分钟统一检查时间 / 周期 / Timeline）
    │
    └─→ Jira Automation Executor Rule（Bot / AI / AsMe RC sender / AgentTask）
        ├─→ 每分钟读取 Sheet，只有命中 due 行才继续
        ├─→ Bot 私发/群发 → Dify botman jumpboard → botman
        ├─→ AsMe RingCentral sender → Dify RingCentral sender workflow → RingCentral
        ├─→ AI Report → 行级 AI_Endpoint（默认 Dify AI report app）
        └─→ AgentTask → Dify agent-task jumpboard → memory-service /agent-tasks/execute
    ↓
memory-service runtime（Outreach）
    ├─→ 模板同步 / runtime overlay
    ├─→ 目标解析
    ├─→ 发送前答案判定
    ├─→ 等待回复 / 追问前答案判定
    └─→ 会话结果与证据展示

memory-service runtime（AgentTask）
    ├─→ 幂等 claim / proposed_actions run 账本
    ├─→ OpenClaw OpenAI-compatible /v1/responses
    ├─→ artifact / transcript / error 保存
    ├─→ 成功或失败 Bot 私发通知
    └─→ AR result cache（仅 AR binding 需要）
```

Dify 应用导出与接线说明集中在 [src/scheduled-messages/dify/](../../src/scheduled-messages/dify/README.md)：`agent-task-jumpboard.yml`、`botman-jumpboard.yml`、`ringcentral_dify_workflow_split_credentials.yml`、`AI report.yml`。Jira 因出站限制不能直连 botman / memory-service 时，由这些 Workflow 做跳板；Chrome AR 即时刷新仍直连 memory-service。

### 核心组件

#### 1. SheetInitializer

- 负责一键创建 Google Sheet
- 创建 AppScript 项目
- 设置触发器
- 部署 Web App

#### 2. ScheduledMessageService

- 封装 Google Sheets API 操作
- 提供 CRUD 接口
- 计算下次执行时间
- **动态列映射**：
  - 读取时：通过 header 动态解析每行数据
  - 写入时：根据 header 顺序动态生成行数据
  - 缓存机制：header 结构缓存，提升性能
  - 自动同步：同步数据时清除缓存，确保获取最新列结构

#### 3. AppScript 执行引擎

- `minuteTrigger()`: 每分钟执行，统一处理一次性、周期性和 Timeline 类型
- `doGet()`: Web App 端点，供 Jira Automation 调用

#### 4. Jira Automation 执行器（v2 架构）

- 由两条 Jira Automation Rule 组成：
  - Executor Rule 每分钟触发一次 Webhook 调用 AppScript
  - Timeline Sync Rule 每天 05:00 按项目刷新 releaseInfo 缓存
- Timeline 缓存状态在创建/编辑相关消息时展示；用户从 Jira 手动同步或修复规则后回到扩展，会自动刷新状态并在诊断中区分“缓存不可用”和“缓存仍可用但最近同步失败”。状态面板可直接运行 Apps Script dry-run 测试，也保留复制 curl 的手工排障路径。
- 302 重定向兼容说明：Google Apps Script `ContentService` 会把文本响应重定向到 `script.googleusercontent.com` 的一次性 URL，Jira Automation Send web request 对第三方 POST 重定向仍有兼容风险（AUTO-2123）。
- 因此 Jira Rule 里所有指向 AppScript `WEB_APP_URL` 的调用都保持为 GET；`markBotMessageExecuted` / `confirmBotMessageTriggered` 使用 `messageId` / `rowIndex` / `executionKey` 的短 URL 写回，避免 Jira 在 POST 302 上停住导致消息重复推送。
- Executor Rule 的 `getBotMessageCurrentTime&autoMarkOnFetch=api` 会让 AgentTask / AI Report / 自定义 API Endpoint **领取时只写 claimed**（`⏳ 已领取待确认` + `Last_Exec`），不增加 `Exec_Count`、不写 Logs 成功、不标 `Done`。下游调用成功后由 `confirmBotMessageTriggered` 写最终 ✅。这样即使 Google Web App 302→echo 404 / 超时导致 Jira 拿不到 payload，Sheet 也不会留下假成功锁死当天。AgentTask 未确认可按 at-least-once 重领（memory-service 幂等吸收）；自定义 API 默认 at-most-once，claimed TTL（2h）后标 `trigger_delivery_failed`。可用 `scanUnconfirmedClaims` 对账。普通 Bot / RingCentral sender 仍按发送结果回调写入。
- Executor Rule ≥ 1.7.0 在 AgentTask 与 4 条 AI/API 转发分支后追加 `confirmBotMessageTriggered`；≥ 1.7.1 进一步区分 Dify workflow 成功与下游业务接受：只有 `data.outputs.accepted=true` 才确认成功，`accepted=false` 或缺失时把 `error/statusCode/queueStatus` 作为 `trigger_delivery_failed` 回写 Sheet。≥ 1.6.1 的领取 audit Log 仍保留。
- `cacheReleaseInfo` 按项目缓存并记录最近同步尝试摘要；`markBotMessageExecuted` 携带 `messageId` / `rowIndex` / `executionKey` 做行定位和幂等写回，避免 Sheet 行移动、Jira 重试或特殊字符导致误标记、重复记账或静默失败。
- Timeline Sync Rule 逐项目调用内网 release info API 并通过 GET 写入 Script Properties；单个项目缓存失败不会阻断后续项目，Apps Script 会拒绝格式异常、未知项目、空 release info 或超出单值大小限制的写入，并返回可读错误。
- 首次配置或修复 Timeline Sync Rule 后，用户可以手动运行一次 Sync Rule 让缓存立即生效；新增/编辑 Timeline 消息或使用 `{currentRelease}`、`{nextPhase}` 等项目变量时，管理页会读取所选项目的缓存状态并展示执行影响，但不会阻止保存草稿。
- 缓存状态接口只暴露项目状态、Milestone key 和最近同步尝试摘要，不暴露具体 release 日期；如果接口返回 HTML、空响应或 Apps Script 错误对象，管理页会显示升级/排查提示，不会把异常响应当成有效缓存。
- 旧 inline `releaseInfo` GET 参数仍保留解析能力，主要用于兼容旧 Rule 或手工调试；维护 Timeline 项目时要保持 `app-script-template.gs` 的 `TIMELINE_PROJECT_PARAM_MAP` 与前端项目清单一致。
- AppScript 执行完整流程：
  1. 按优先级选择单条消息（当前分钟 > 过去 30 分钟 > 未指定时间）
  2. 过滤今日已成功/已失败的消息
  3. Timeline 消息从缓存读取项目 Milestone 信息；缓存缺失时跳过 Timeline，不影响普通时间消息
  4. 调用内网 Bot API 或外部 AI API 发送
  5. 更新执行日志到 Sheet
- **优势**：失败消息不阻塞队列，全天分散推送未指定时间的消息

#### 5. Outreach Runtime

- 将 `Push_Method = Outreach` 的定时消息同步成主动询问计划
- 运行时状态通过 overlay 回写到定时消息列表，例如：
  - `Outreach_Sync_State`
  - `Outreach_Runtime_Status`
  - `Outreach_Last_Session_ID`
  - `Outreach_Result`
  - `Outreach_Last_Updated`
- 对循环计划，只结束本次 occurrence/session，不会因为一次 `resolved` 就把整个计划永久视为 Done
- 真正的会话详情和证据查看入口在 `memory-exploring.html#/outreach`

#### 6. AgentTask Runtime（帮我做）

- 将 `Push_Method = AgentTask` 的 Messages 行视为 Agent task 计划，可一次性执行，也可重复执行。Sheet 保存 `Agent_Task_ID`、`Agent_Executor`、`Agent_Notify_Template`、`Agent_Notify_Success_Receipt`、`Agent_Trigger_Source`、`Agent_AR_Binding_ID` 和最近触发摘要；任务描述统一写在 `Content`（旧列 `Agent_Task_Prompt` 已退役并由 schema updater 物理删除）。不保存完整 run/transcript/artifact。
- Jira Executor Rule 仍每分钟运行，但先通过 AppScript 读取 Sheet 并筛选 due 行。没有到期 AgentTask 时不会访问 memory-service；命中到期行时才返回 AgentTask webhook payload。
- 因 Jira 不能直连 memory-service，Executor Rule ≥ 1.6.0 把 AgentTask 转到 Dify agent-task jumpboard（[src/scheduled-messages/dify/agent-task-jumpboard.yml](../../src/scheduled-messages/dify/agent-task-jumpboard.yml)），由 Dify 再 POST `/api/v1/agent-tasks/execute`。跳板必须带 memory-service 全权 `API_KEY`（Dify 环境变量 `MEMORY_SERVICE_API_KEY` + `X-User-Id`），不是个人 `pak.…`；缺 key 会 401 `authentication_required`。Chrome AR 即时刷新仍直连 memory-service，不受该跳板影响。跳板和 Apps Script **不再**把空 executor 填成 `openclaw`；空值走 Options「Agent Task 默认执行器」，显式实例 id（包括本机 `openclaw`）原样透传。
- Executor Rule ≥ 1.6.1 在领取成功（`executed=true`）后、进入各发送分支前，会用 Log action 把本次 `messageId` / `topic` / `pushMethod` / `targetType` / `executionKey` / `rowIndex` 写入 Jira Automation audit log，方便对照 Apps Script 偶发超时或 404 时实际领到的任务。
- AppScript ≥ 2.12.1 的 webhook payload 以 `Content` 为 `task`（缺列时兜底旧 `Agent_Task_Prompt`），并附带选中的 `executor`（空则省略，由 memory-service 用 Agent Task 默认）、`successReceipt`（读 `Agent_Notify_Success_Receipt`，空/`Y` 默认开）、`notifyVia`（读 `Agent_Notify_Via`，空/`bot` 默认 Bot，`asme` 表示成功结果以本人身份发送）。`notifyVia=asme` 时会附带 Sheet `ringcentral_sender_*` 凭据（与顶部 AsMe 发消息 tab 同一套 token），以及仅在 Glip 目标非空时构造的 `notifyTarget`。
- AppScript 在返回 AgentTask webhook 前检查 `Config!agent_task_webhook_url` 或行级 `AI_Endpoint`。缺失时不会领取该任务，也不会写 `Last_Exec`，避免配置错误导致任务静默跳过。
- 管理页保存 / 更新“帮我做”时会先检查 Config；缺少默认 webhook 时从本机 `MEMORY_SERVICE_BASE_URL` 派生 `/agent-tasks/execute`，并连同 `agent_task_user_id` 写回 Sheet Config 后才保存任务行。
- 管理页普通打开和基础列表加载只是只读检查：不会因为发现本机缺少 AgentTask webhook 就静默写回 Config。只有用户点击手动同步、创建/保存“帮我做”、AR 入口创建重复 AgentTask，或明确运行 schema/规则升级路径时，才会进入 Sheet-first webhook 补齐。
- 打开新建/编辑弹窗且选中“帮我做”时，管理页会用当前 Options/env 里的 `MEMORY_SERVICE_BASE_URL` 和当前用户 id 请求 memory-service `/config`，确认后端 runtime 里 `openClawEnabled/openClawBaseUrl/openClawApiKeyConfigured` 已就绪；这个检查只读，不写 Messages，也不创建可领取任务。
- Options/env 里的 `OPENCLAW_*` 是扩展侧配置，memory-service `/config` 返回的是后端当前用户 runtime 配置。两边可能短暂不一致：例如 Options 已保存但后端 runtime 未同步、请求未带 `X-User-Id` 读到 default 用户、或扩展仍复用旧 memory-service 地址。此时会阻止保存并显示缺失原因，避免创建到期后必然失败的 AgentTask。
- AgentTask webhook 默认是 `POST https://.../api/v1/agent-tasks/execute`，内网环境也可配置 `http://...`；需要 `Config!agent_task_user_id` 填写 memory-service 的用户 id，Jira Rule 模板会把它作为 `X-User-Id` 转发。
- memory-service 是执行账本和结果真源：`/api/v1/agent-tasks/execute` 使用确定性 `idempotencyKey` 创建或复用 `delegate_agent` action（兼容旧 `delegate_openclaw`），入队即返回；由 Options「Agent 执行器」registry 选择 OpenClaw Gateway/Responses 或 ACP 执行。详见 [Agent Executor Runtime](./agent_executor_runtime.md)。
- Apps Script / Jira Rule 模板需在本页手动升级后，claim≠confirm 假成功修复才对真实 Sheet 生效。
- v1 自动执行器通过 registry 配置；帮我做弹窗列出 Options 执行器并默认选中 `executorDefaults.agent_task`。Codex 可通过 `acp-codex` 实例启用。
- 管理页列表加载会额外请求 `GET /api/v1/agent-tasks/runtime-status?ids=<Messages.ID[,Agent_Task_ID]>`，按 `sourceKind=agent_task` + `sourceRefId` 取最近一次 run；列表摘要和 hover 只展示 `result.summary`，不在 hover 里重复展开 artifact。该叠加只改页面展示态，不写回 Sheet。
- **结果通知**与**回执**是两个独立概念：
  - 结果通知：由 Sheet 的 `Glip_User_Name` / `Glip_Team_ID` 是否非空表示开关；开启后 AppScript 构造 `notifyTarget`，memory-service 仅在**成功**时把结果（可套用 `Agent_Notify_Template`）发到该目标。失败**不会**发到结果通知目标。
  - 成功回执：`Agent_Notify_Success_Receipt`（`Y`/空=开，`N`=关，默认开）控制成功时是否额外 Bot 私发本人；若结果通知目标已是本人私发则去重合并为一条。
  - 失败回执：始终 Bot 私发本人（不可关）；唯一例外是 API 级 `notify: false`（AR 等程序化调用），UI 永不产生该值。
  - 成功结果通知的发送身份由 `Agent_Notify_Via` 决定：`bot`（默认）走 SM AI Bot API；`asme` 走与顶部 AsMe 发消息 tab 同一套 Sheet RingCentral sender（`ringcentral_sender_client_id/secret/jwt`）。回执始终 Bot。AsMe 投递失败不会静默改成 Bot。
  - 帮我做弹窗可选 AsMe；Sheet RingCentral sender 未就绪时标「可预览 · 待配置」，保存会被拦截。入口与顶部 AsMe tab 的「配置 @ 人发送能力」相同。
- **通知配置不再单靠 Apps Script 转发**：管理页保存/编辑 AgentTask 行时，除了写 Sheet 列，还会把 `notifyTarget`/`Agent_Notify_Success_Receipt`/`Agent_Notify_Via`/`Agent_Notify_Template` 通过 `SYNC_AGENT_TASK_NOTIFY_CONFIG` 直接注册到 memory-service（`POST /agent-tasks/notify-config`，按 `sheetMessageId` 存表）；`Push_Method` 从 AgentTask 切走时会调用 `DELETE .../notify-config/:sheetMessageId` 清掉这条。`/agent-tasks/execute` 收到请求时，body 里没带的字段会回落读这张表，body 显式给的值仍优先。这样即使线上 Apps Script 版本落后（某个字段还没加进模板转发逻辑），通知配置依然正确——不需要先升级脚本。保存回执里会提示这次同步是否成功。
- `Agent_Notify_Template` 只影响成功结果通知文案；原始 OpenClaw task、artifact 和 payload 不会被通知模板改写。成功回执（无结果目标时）与失败回执均用默认摘要，不套模板。
- **发到结果通知目标的正文，绝不会是回执体**：没配模板、或模板格式化失败时，`result` 类型的兜底文案是「标题 + 清洗后的结果摘要」，若 artifact 里已有列表则按 `Agent_Notify_Template` 本地填空；不含 `Run: <uuid>`/`触发: jira_rule`/`边界: Sheet 只记录计划...` 这类只对 owner 有意义的内部记账字段——那套字段专属 `success_receipt`/`failure_receipt` 两种私密回执。模板格式化走 Memory Service 自己的 LLM（服务端 key），不委派 OpenClaw。模板里若有 markdown 链接占位（`[text](url)`）或写明要带链接，由 LLM 按模板把占位符换成证据里的真实条目和可点击 URL；本地填空只铺列表结构，不臆造站点 URL。下达给 OpenClaw 的是任务本身；`notifyTemplate` 只抽成收据字段提示（key / url / title / assignee），不会让执行器直接填写群消息。LLM 抛异常或输出不可用时记录 warn 后回落到上述本地填空，不会静默换成回执体。
- 推送在 memory-service 拿到执行结果后由代码层完成：Bot 走 `NotificationCenterService` → Bot API；AsMe 走 Sheet RingCentral sender JWT（`RingCentralClient` 显式凭据，不写进 action 账本）。**不会**把“通知到某群”写进任务 prompt，也**不会**为了整理文案再跑一轮 OpenClaw。
- 结果投递（`result` 类型）成功与否会写进 `channel_delivery_records`；管理页 `GET /agent-tasks/runtime-status` 会带回 `resultNotifyDelivery: { delivered, error? }`。投递失败（例如 SM AI Bot 不在目标群）时，除了记录，还会私发 owner 一条「通知投递失败: <原因>」——避免"任务回执显示 success、目标群却什么都没收到"这种情况只能靠翻服务端日志才能发现。

#### 7. AR 绑定来源

- AR 数据的右键入口、DOM 替换、overlay、页面 `ON/OFF` 开关和 binding 语义锚点，以 [Personal AI AR Data](./ar_data_overlay.md) 为 source of truth。
- 本文只定义调度交界：AR 入口勾选“重复执行”时，会创建一条 `Push_Method = AgentTask` 行，并把 `Agent_AR_Binding_ID` 写入 Messages。
- 未勾选重复执行的 AR binding 不进入 Sheet、不出现在“帮我做”列表、不由 Jira Rule 扫描。
- AR 的 `lastResult` 只是页面展示缓存；AgentTask 执行账本、OpenClaw artifact、失败和通知状态仍以 memory-service 为准。

## 配置说明

### Messages 表字段

| 字段               | 类型     | 必填 | 说明                                                 |
| ------------------ | -------- | ---- | ---------------------------------------------------- |
| ID                 | String   | ✅   | 唯一标识                                             |
| Topic              | String   | ✅   | 消息主题                                             |
| Content            | String   | ✅   | 消息内容；AgentTask 时即为 OpenClaw 任务描述         |
| Schedule_Date      | Date     | ✅   | 执行日期 (YYYY-MM-DD)                                |
| Schedule_Time      | Time     | ❌   | 执行时间（00:00-23:59，本地时间）                    |
| End_Date           | Date     | ❌   | 结束日期（包含当天）                                 |
| Repeat_Every       | Number   | ❌   | 重复间隔                                             |
| Repeat_Unit        | Enum     | ❌   | Day/Week/Month/Year                                  |
| Repeat_Count       | Number   | ❌   | 重复次数                                             |
| Repeat_Days        | String   | ❌   | 多选日期（周模式：0=周日,1=周一...6=周六，逗号分隔） |
| Timeline_Project   | String   | ❌   | Timeline 触发项目                                    |
| Timeline_Milestone | String   | ❌   | Timeline 触发里程碑                                  |
| Timeline_Offset    | Number   | ❌   | Timeline 偏移天数                                    |
| Push_Method        | Enum     | ✅   | AsMe / Bot / AI / JiraAutomation / Outreach / AgentTask |
| Glip_User_Name     | String   | ❌   | 接收人用户名（AsMe/Bot 私聊、Outreach 个人目标；AgentTask 作为结果通知目标透传给 memory-service） |
| Glip_Team_ID       | String   | ❌   | 群组 ID（Bot 群推送、AI 报告、Outreach 群目标；AgentTask 作为结果通知目标透传给 memory-service） |
| Attachment         | String   | ❌   | 附件文件名                                           |
| AI_Endpoint        | String   | ❌   | AI API 端点（AI 推送必填）                           |
| AI_Headers         | String   | ❌   | AI API 请求头（多行文本，每行一个 header）           |
| AI_Body            | String   | ❌   | AI API 请求体（JSON，支持 {Topic}/{Content} 变量）   |
| Category           | String   | ❌   | 分类标签                                             |
| Automation_Link    | String   | ❌   | Jira Automation Rule 链接；托管后编辑必须保留，后续改 Topic 靠它同步 Rule 名称 |
| Agent_Task_ID      | String   | ❌   | AgentTask 稳定 ID，通常由管理页或 AR 入口生成        |
| Agent_Executor     | String   | ❌   | 帮我做弹窗选择的执行器实例 id。新建默认 Options `executorDefaults.agent_task`；空值则 memory-service 用该默认 |
| Agent_Notify_Template | String | ❌ | 成功结果通知的文案模板（仅结果通知目标；不改变原始结果） |
| Agent_Notify_Success_Receipt | String | ❌ | `Y`/空=开（默认），`N`=关；只控制成功回执，失败回执始终开启 |
| Agent_Notify_Via | String | ❌ | `bot`（默认）或 `asme`；只影响成功结果通知身份，回执仍 Bot |
| Agent_Trigger_Source | String | ❌   | `jira_rule`，未来可扩展为 `memory_cron`              |
| Agent_AR_Binding_ID | String  | ❌   | 仅 AR 入口创建的重复任务会写入                       |
| Agent_Last_Run_At  | DateTime | ❌   | 最近一次被 Jira Rule 触发 memory-service 的时间；列表打开时可由 runtime-status 叠加覆盖展示 |
| Agent_Last_Status  | String   | ❌   | 最近触发状态摘要；列表优先展示 memory-service run 状态 |
| Agent_Last_Result  | String   | ❌   | Sheet 侧最近结果摘要缓存；列表真源是 runtime-status 的 `summary`，完整 artifact 仍在 memory-service |
| Agent_Last_Error   | String   | ❌   | 最近触发错误摘要；失败 run 的 lastError 会叠加到列表 hover |
| Status             | Enum     | ✅   | Active/Paused/Completed                              |
| Last_Exec          | DateTime | ❌   | 最后执行时间（自动）                                 |
| Next_Exec          | DateTime | ❌   | 下次执行时间（自动）                                 |
| Exec_Count         | Number   | ❌   | 执行次数（自动）                                     |
| Exec_Log           | String   | ❌   | 执行日志（自动）                                     |

说明：`Type` 由程序根据日期、时间和重复字段自动判断，不再作为新表 schema 保存。旧表中的 `Target_Type`、`Outreach_*`、`Outreach_Question`、`Agent_Task_Prompt` 等列会继续兼容读取，但 schema updater 会在打开管理页时物理删除已退役列并补齐 `Agent_Notify_Success_Receipt` / `Agent_Notify_Via`。v2.7 起新表只把 Outreach 入口保存在 `Content / Glip_User_Name / Glip_Team_ID / Push_Method` 等基础列中，运行态以上游 memory-service 为准。AgentTask 的 `Agent_Last_*` 只是计划行上的最近触发摘要，不是执行账本。`Sent_Chat_ID` / `Sent_Post_ID` / `Sent_At` 不属于 Messages 计划定义，发送结果统一写入 Logs。

### Logs 表字段

| 字段          | 类型     | 说明                                        |
| ------------- | -------- | ------------------------------------------- |
| Timestamp     | DateTime | 日志写入时间                                |
| Message_ID    | String   | 对应 Messages.ID                            |
| Topic         | String   | 实际发送主题                                |
| Content       | String   | 实际发送内容                                |
| Push_Method   | Enum     | AsMe / Bot / AI / JiraAutomation / Outreach / AgentTask |
| Target        | String   | 发送目标                                    |
| Status        | Enum     | Success / Failed                            |
| Error         | String   | 错误信息                                    |
| Exec_Count    | Number   | 第几次执行                                  |
| Execution_Key | String   | 单次执行幂等键                              |
| Sent_Chat_ID  | String   | 实际 RingCentral chatId，用于 Glip 标注     |
| Sent_Post_ID  | String   | 实际 RingCentral postId，用于 Glip 标注     |
| Sent_At       | DateTime | 实际发送时间                                |

### Config 表字段

| Key                                  | 说明                                                           |
| ------------------------------------ | -------------------------------------------------------------- |
| minute_trigger_id                    | 分钟触发器 ID                                                  |
| daily_trigger_id                     | 每日触发器 ID                                                  |
| web_app_url                          | Web App 地址                                                   |
| deployment_id                        | Web App deployment ID，用于 `deployments.update` 保持 URL 不变 |
| app_script_version                   | 当前线上 App Script 版本                                       |
| app_script_last_updated              | 当前线上 App Script 模板更新时间                               |
| jira_executor_rule_id                | Jira 执行器规则 ID                                             |
| bot_automation_executor_rule_id      | Bot/AI/AsMe RingCentral sender 执行规则 ID                     |
| bot_automation_timeline_sync_rule_id | Timeline Sync 规则 ID                                          |
| ringcentral_sender_enabled           | 是否启用 AsMe RingCentral sender                               |
| ringcentral_sender_client_id         | RingCentral sender Client ID                                   |
| ringcentral_sender_client_secret     | RingCentral sender Client Secret                               |
| ringcentral_sender_jwt               | RingCentral sender JWT                                         |
| ringcentral_sender_updated_at        | RingCentral sender 配置更新时间                                |
| agent_task_webhook_url               | memory-service AgentTask webhook，例如 `https://.../api/v1/agent-tasks/execute` 或内网 `http://...`；Jira ≥ 1.6.0 实际出站走 `AGENT_TASK_DIFY_*` 跳板 |
| agent_task_webhook_token             | 可选 Bearer token，会作为 `Authorization` 转发给 webhook         |
| agent_task_user_id                   | memory-service 用户 id，会作为 `X-User-Id` 转发                  |
| sheet_version                        | 版本号                                                         |
| created_by                           | 创建者                                                         |
| created_at                           | 创建时间                                                       |
| last_sync_time                       | 最后同步时间                                                   |
| last_sync_action                     | 最近一次写回 Config 的触发来源                                 |

## 常见问题

### Q: 初始化失败怎么办？

A: 请检查：

1. 是否已登录 Google 账号
2. 是否授权了 Google Sheets 和 Apps Script 权限
3. 网络连接是否正常

### Q: 消息没有按时发送？

A: 请检查：

1. 消息状态是否为 Active
2. Schedule_Date 和 Schedule_Time 是否正确，Schedule_Time 必须是 00:00-23:59 的本地时间
3. AppScript 触发器是否正常运行（在 Google Apps Script 控制台查看）

### Q: 如何修改消息内容？

A:

1. 在管理界面点击消息右侧的编辑按钮，或打开 Google Sheet 找到对应行
2. 修改内容 / 时间 / 目标后保存
3. 下次执行时会使用最新配置
4. 托管的 JiraAutomation 行保存时会保留 `Automation_Link`；如果改了主题，会继续把 Topic 同步到对应 Jira Rule 名称

### Q: 为什么列表是空的，但总计不为 0？

A:
这通常是筛选条件没有匹配消息。点击空状态里的“清除筛选”即可恢复全部消息列表。

### Q: 如何暂停消息？

A:

1. 在管理界面点击消息右侧的“暂停 / 恢复”按钮，或在 Sheet 中将 Status 改为 "Paused"
2. 系统将跳过该消息的执行
3. 待审核消息不能直接恢复为 Active，请使用“批准 / 拒绝”；已完成消息要先编辑为未来执行时间，或改成仍有下次执行的重复任务，保存后会自动恢复为 Active

### Q: 如何删除消息？

A:

1. 在管理界面点击删除按钮，或打开 Google Sheet 删除对应消息行
2. 管理界面删除前会显示消息 ID、状态、下次执行、频率和接收目标，避免重复主题误删
3. 托管的 Jira Automation 规则会先按本机时区把本地时间换算为 Jira UTC trigger，尝试恢复原 trigger，再删除 Personal AI 记录；链接解析、项目权限或恢复请求失败时会保留本地行

### Q: 可以调整 Sheet 中列的顺序吗？

A:
✅ **完全支持！** 系统会自动识别列的位置：

1. 可以随意调整列的顺序（如把 Topic 移到第一列）
2. 可以隐藏不需要的列
3. 可以在中间插入新的列
4. 系统通过 header 行（第一行）自动识别每列的含义
5. 读取和写入数据时都会自动适配当前的列顺序

**注意事项**：

- ⚠️ 不要修改 header 行的列名（如 "ID"、"Topic" 等）
- ⚠️ 不要删除必要的列（如 ID、Status 等）
- ✅ 调整顺序后建议点击"同步"按钮刷新数据

### Q: Bot 消息推送失败怎么办？

A:

1. **自动处理**：失败的消息今天不会重试（避免阻塞队列），第二天自动重试
2. **手动重试**：打开 Sheet，清空失败消息的 `Last_Exec` 或修改 `Exec_Log`（移除 ❌）
3. **查看原因**：检查 `Exec_Log` 列的错误信息
4. **常见问题**：
   - Bot Token 过期：重新配置 Jira Automation Rule
   - Bot 路由配置异常：检查扩展中的 Bot 配置或 Jira Automation Rule 是否仍然有效
   - 权限不足：确认 Bot 有权限访问目标群组/用户

### Q: 看到错误 "Cannot read properties of undefined (reading '0')"？

A:
这个错误已在最新版本修复。如果仍然遇到：

1. **原因**：Apps Script 的 `markBotMessageExecuted` API 接收到不完整的参数
2. **解决方案**：
   - 确保 Google Sheet 中的消息有唯一的 `ID` 字段
   - 更新 AppScript 代码到最新版本（支持通过 messageId 自动查找）
   - 如果是从 Jira Automation 调用，确保 webhook 包含 `messageId` 参数
3. **技术细节**：最新版本的 `markBotMessageExecuted` 可以自动通过 `messageId` 查找对应的行，即使缺少 `rowIndex` 参数也能正常工作

### Q: Bot 消息为什么没有立即推送？

A:
Bot 消息采用**单条消息推送策略**，每分钟执行一条：

- ✅ **正常情况**：当前分钟的消息会立即推送
- ✅ **同时多条**：按优先级排队，5-10 分钟内全部推送完
- ✅ **未指定时间**：8 点后全天分散推送
- ⚠️ **超大量**：同时超过 30 条可能部分延迟或遗漏

### Q: 帮我问为什么到了触发时间却没有真的发出去？

A:
这通常不是失败，而是 **发送前答案判定已经命中**：

1. 系统一次性计划会检查计划创建以来的最近消息；循环计划会检查本次周期窗口内的最近消息
2. 如果没有，再检查全局记忆里是否已经在其他群拿到答案
3. 如果两层检测已经能确认证据满足信息目标，session 会直接标记为 `resolved`，不会再重复追问；如果只是部分相关或仍缺目标信息，会继续等待/追问

### Q: 帮我问的系统观察规则在哪里看？

A:
用户不会在“记忆入口规则”里看到这类规则。当前可见入口是：

1. 定时消息列表中的运行态摘要
2. “主动询问 / Outreach Sessions” 页面里的证据状态、命中阶段、命中来源和相关消息

系统内部观察规则是运行时能力，不是用户手动维护的规则列表。

## 最近更新

- 2026-09-02：AgentTask 成功通知模板格式化改走 Memory Service 自己的 LLM；模板若要求链接，由 LLM 按模板输出 markdown 链接。执行器仍交 JSON 信封 + artifact：`notifyTemplate` 只抽成证据字段提示，Jira 收据约定带实际实例的 browse/self URL，不把 Glip 模板当最终回复。
- 2026-08-21：已完成的单次任务改成仍有下次执行的重复任务时，会自动从 `Done` 恢复为 `Active` 并把 `Exec_Count` 归零；执行器只领取 Active 行，已完成行没有单独的“恢复”按钮。
- 2026-08-21：托管 JiraAutomation 行编辑保存会保留 `Automation_Link`；`undefined` 不再把规则入口整行写空。改 Topic 继续同步 Jira Rule 名称，不再只在托管后第一次编辑生效。

- 2026-08-17：帮我做结果通知身份开放 AsMe（v2）。Sheet `Agent_Notify_Via` + Apps Script `2.12.1` 透传 `notifyVia` 与 Sheet `ringcentral_sender_*`（与 AsMe 发消息同一套 token）；memory-service 成功结果以本人身份发送，回执仍 Bot。
- 2026-08-14：帮我做新建弹窗可选择 Agent 执行器（默认 Options `agent_task`）；Apps Script `2.11.1` 透传选中实例 id，空值不再写死 `openclaw`。
- 2026-08-14：v1 `executor=openclaw` 不再钉死本机 `id=openclaw` Gateway；Agent Task 走 Options `executorDefaults.agent_task`。Dify jumpboard 同步去掉该硬编码。
- 2026-08-14：Executor Rule `1.7.1` 读取 Dify AgentTask jumpboard 的 `data.outputs.accepted`；memory-service 401/业务拒绝不再被 Dify workflow `SUCCESS` 掩盖，而是立即写入 Sheet `Agent_Last_Status / Agent_Last_Error / Logs` 失败记录。
- 2026-08-11：新建弹窗统一 5 tab（发消息｜Agent 任务），帮我做/帮我问并入 tab；任务描述统一 `Content` 并退役 `Agent_Task_Prompt`；新增 `Agent_Notify_Success_Receipt`；结果通知与成功回执分离，失败回执始终 Bot 私发；Apps Script `2.11.0` + memory-service 通知矩阵。
- 2026-08-09：Apps Script `2.10.0` + Executor Rule `1.7.0` 拆分 claim/confirm——领取不再写最终 ✅；AgentTask/API 在下游成功后 `confirmBotMessageTriggered`；未确认 claimed 可对账（`scanUnconfirmedClaims`），修复「Sheet 假成功但请求未到 memory-service」主故障。
- 2026-08-04：Executor Rule `1.6.1` 在 `getBotMessageCurrentTime` 返回 `executed=true` 后先写一条 audit Log（messageId / topic / pushMethod / targetType / executionKey / rowIndex），再进入 AgentTask/Bot/AsMe/AI 分支；Apps Script `2.9.2` 对各领取成功返回统一带上 `topic` 与 `pushMethod`，便于对照偶发超时 / 404 时到底领了哪条任务。
- 2026-08-03：帮我做列表结果改为打开时只读叠加 memory-service `/agent-tasks/runtime-status`；列表与 hover 只展示 OpenClaw `summary`，不再把 Bot 通知或 Sheet `Agent_Last_Result` 当唯一真源，也不在 hover 重复展 artifact。
- 2026-08-03：补齐 Dify 跳板目录说明；Bot / AgentTask / AsMe RingCentral sender / AI Report 的 YAML 统一放在 `src/scheduled-messages/dify/`，Jira Executor ≥ 1.6.0 经跳板出站，Chrome AR 仍直连 memory-service。
- 2026-07-13：将 Glip 输入框闹钟快速定时和虚线未来消息收口到正式文档；明确创建门禁、pending 缓存、`Message_ID + Success` 清理、5 分钟刷新、500ms 重绘、6 小时兜底和滚动隐藏边界，并删除对应 progressing 动画原型。
- 2026-05-20：把配置同步、执行匹配 / 补偿 / 幂等、Timeline 缓存排障和 App Script 自动更新规则归并到本文，移除对应子文档。
- 2026-05-20：核对当前 Timeline Sync Rule 仍以 GET 写缓存为准，POST JSON 仅作为旧链路和诊断兼容能力保留。
- 2026-05-22：队列建议会保留未填写时间的执行器队列语义；无时间队列溢出时一键建议清空 `Schedule_Time` 并改到下一可执行日期的 08:00 后队列。
- 2026-05-22：队列可视化补充“前面会先执行”的数量和前序样例，让改期建议的阻塞来源可见。
- 2026-05-25：Timeline 缓存面板补充执行影响提示，区分 Timeline 触发跳过和项目变量保留原样，避免缓存异常时保存看起来像完全可执行。
- 2026-05-28：Timeline 项目标识统一兼容显示名和 Jira paramKey，避免旧 Sheet 行、手工行或状态面板使用不同标识时出现“可见配置但执行跳过”的排障死角。
- 2026-05-26：错过执行窗口的批量一键改期会分配连续未来分钟，并在健康告警中直接显示建议目标与原因。
- 2026-05-27：管理页新增 / 编辑保存后会自动定位刚保存的行；删除当前定位行后会清除 `messageId` 并返回完整列表。该交互参考 Slack / Teams 对已排程消息的集中编辑、改期、删除路径，以及 Gmail 取消排程后回到草稿的可恢复语义。
- 2026-05-28：队列健康的一键改期现在会为未设时间的执行器消息检查当天剩余队列容量；跨日前或批量恢复溢出时改到下一个可用默认队列日。该策略参考 Apps Script time-driven trigger 可能抖动、Twilio scheduled message 的状态/失败可见性、Zapier run history 的错误恢复路径，以及触发-动作规则调试研究中“解释失败位置和下一步”的要求。
- 2026-05-29：08:00 后队列的容量判断会扣除当天未来明确时间及其前序 backlog 占用的分钟；改期建议不再把目标挪到仍会被前序消息占用的分钟，并在风险提示里解释已避开的明确时间分钟。
- 2026-05-27：App Script 自动更新检查失败时会直接提供版本端点和 Apps Script 项目入口；deployment 更新请求体同步带上 `scriptId`，贴合 Google Apps Script API 的 `deployments.update` 契约。
- 2026-05-29：一键初始化授权前后的收据现在会贯通 `messages_sheet_id`、`logs_sheet_id` 和 `deployment_id`，避免第二阶段用新的初始化器保存出缺失子表定位或缺失 deployment 的 Config；这个调整参考 Zapier / Power Automate 把自动化创建、测试和运行历史拆成可审计步骤，以及触发-动作研究中对 mental model 和调试线索的要求。
- 2026-05-30：App Script 自动更新在 Project History 已满或接近上限时增加“重新检查”，清理版本后无需刷新管理页即可恢复升级判断。
- 2026-06-13：App Script 自动更新增加升级结果回执；升级成功、跳过、失败和需要恢复的路径会留在页面上，回执明确失败项不会把配置标记为最新，并保留检查页面入口。
- 2026-06-29：App Script 自动更新增加升级请求回执；用户确认升级后立即看到在途范围和未确认边界，最终成功、部分失败或中断回执仍会覆盖该请求回执。
- 2026-07-12：一键初始化的创建、Apps Script API 设置、重新初始化、授权打开和继续初始化按钮补充 hover / 读屏边界，点击前即可区分第一阶段创建、外部设置恢复、授权页面和第二阶段触发器 / 测试消息 / Config 写入。
- 2026-07-11：App Script 自动更新的检查、重新检查、Project History、版本端点、Apps Script 项目、升级和恢复按钮都补充 hover / 读屏边界，点击前即可区分只读检查、打开恢复页面和真实升级确认。
- 2026-07-14：App Script 可升级横幅增加“升级证明回执”，点击前说明版本历史满载时只打开 Project History，以及可升级时以 `getVersion` 返回目标版本作为 Sheet / Storage 标记最新的唯一证明。
- 2026-05-31：管理页“同步”现在先刷新 Sheet Config，再加载 Messages；当 Sheet Config 比本机更新时会自动应用到本机缓存并展示同步来源，避免跨设备更新后的 App Script / Bot / Timeline 配置继续被旧缓存遮蔽。该调整参考 Airtable Sync 的源/字段/故障排查、Zapier 连接测试/重连，以及 trigger-action programming 研究中对心智模型和可调试性的要求。
- 2026-05-31：删除确认补充消息 ID、状态、目标和执行时间，托管 JiraAutomation 删除恢复 trigger 时改为按本机时区换算 UTC，并在恢复前置检查失败时保留本地行，而不是假设固定 UTC+8 或删除后再补救。这个调整参考 Slack / Gmail / Twilio 对已排程消息的取消、删除和状态边界，以及 end-user debugging 研究中“操作前看清对象和后果”的要求。
- 2026-06-04：一键初始化完成后会把授权前后的 Sheet / Script / Deployment / 子表 / 触发器信息压成一次性完成收据，在刷新后的管理页展示；这延续了 Zapier / Airtable 对自动化运行状态和排障路径的可见性，也避免用户只看到页面刷新而不知道哪些步骤已经成功。
- 2026-06-05：管理页新增 / 编辑提交增加 in-flight 防重复闸门，并在 CRUD E2E 中覆盖连续 submit 只写入一行；这个调整延续 Slack / Teams / Google Chat 对已排程消息作为可管理对象的边界，也贴合 trigger-action 调试研究中“创建阶段减少不可见重复行为”的建议。
- 2026-07-11：行内编辑 / 删除按钮补充按钮级 hover / 读屏边界，点击前直接说明打开本地草稿、托管确认、删除确认、Messages 写入、Jira Rule 恢复、Outreach 模板镜像和不撤回历史发送 / Logs 的范围。
- 2026-07-13：AI Report 自定义版块的添加、编辑、删除补充本地草稿回执和按钮级 hover / 读屏边界，明确保存整个定时消息前不会写 `Messages` / `AI_Body`、发送、改 Logs 或删除已保存计划。
- 2026-06-07：多执行引擎表单不再把缺配置的 Bot/AI 选项硬禁用；用户可以先切换并看到配置动作，但保存仍会被“配置未完成”状态拦截。该调整参考 Zapier / Power Automate 的运行历史与重试状态、Slack scheduled messages 的可管理对象边界，以及 trigger-action 调试研究中对 why/why-not 解释的要求。
- 2026-06-08：Timeline 缓存 dry-run 结果补充验证范围和真实同步边界，明确样例测试不会写缓存、不会证明 Jira Sync Rule 已经把真实 release info 同步成功，并提示手动运行 Rule 后刷新状态确认。该调整参考 Jira Automation audit log、Zapier / Power Automate run history，以及 trigger-action 调试研究中对测试范围和下一步的要求。
- 2026-06-08：Executor Rule 改为通过 `getBotMessageCurrentTime&autoMarkOnFetch=api` 让 AI Report / 自定义 API Endpoint 领取即写 `Last_Exec` 和 Logs，并按原有 schedule 规则决定是否 `Done`，避免长耗时 API 响应期间被下一分钟重复领取；扩展侧整行写入前会强制刷新 live header，避免旧 schema 缓存把 `Status` 写到 `Last_Exec`。
- 2026-06-08：RingCentral sender 配置弹窗补充创建 app / JWT 时需要的 `ReadAccounts`、`ReadMessages`、`EditMessages` 权限说明，并明确缺少 `ReadAccounts` 会让 OAuth 通过但目录查询返回 `403 InsufficientPermissions`，最终无法把 personName 解析成 person id。
- 2026-06-08：新版 Config 写回停止生成 `bot_executor_*` 旧字段，并在 managed-key 清理阶段删除旧行；读取路径保留旧字段迁移兜底，但 Sheet / 本机缓存的持久化字段只保留 `bot_automation_executor_*`。
- 2026-06-08：管理页 Config 同步横幅补充“采用配置 / 边界 / 下一步”回执；Sheet Config 更新成功会标明先写本机再读 Messages / Logs，读取失败或冲突时会明确保留本机缓存和恢复动作。该调整参考 Airtable Sync 的源/字段可见性、Zapier run history 的错误排障路径，以及 trigger-action debugging 研究中对来源和下一步的要求。
- 2026-06-14：管理页 Config 同步在“同步时间相同或无法判断但字段不同”时不再只列差异字段名，会直接展示最多 3 条已脱敏的本机 / Sheet 值对照，并保持不自动覆盖的边界；这个调整参考 Zapier / Power Automate 对连接状态、最近修改和修复路径的展示，以及 trigger-action debugging 研究中对故障定位和修复预览的要求。
- 2026-06-17：手动 Config 同步增加运行中回执和单飞闸门；连续点击只保留当前同步，不再并发读取 Sheet Config、刷新 Messages 或补齐子表定位。这个调整参考 Airtable 对手动/自动同步状态的区分、Zapier/Power Automate 对重放/取消操作状态的展示，以及 trigger-action debugging 研究中对“当前动作是否真的执行”的要求。
- 2026-06-21：手动 Config 同步的运行中回执补充“采用待确认 / 尚未写入”边界；Sheet Config 响应返回前，页面会明确当前还没有写本机缓存、没有写 Config Sheet、没有改 `Messages` / `Logs`、没有发送或执行队列，重复点击也只是等待当前任务结果。这个调整参考 Airtable Sync 的源/目标可见性、Zapier replay/troubleshooting、Power Automate resubmit/run history、Google Sheets `RAW` 写入语义和 trigger-action debugging 研究中对恢复动作范围的要求。
- 2026-07-01：手动 Config 同步增加整次同步完成 / 失败回执；Config 阶段结束后会继续说明 `Messages` / `Logs` 是否成功刷新、读取到多少条消息，或在消息读取失败时保留错误原因和未执行边界。这个调整参考 Airtable Sync 故障排查、Zapier/Power Automate run history 和 trigger-action debugging 研究中对阶段定位与恢复动作边界的要求。
- 2026-07-08：队列详情里的“定位最晚”和“编辑”按钮补充可访问标签和 title，直接说明目标消息、时间槽 / 队列位置，以及点击只定位或打开编辑草稿，不写 Sheet、不改期、不发送、不跳过前序消息。
- 2026-07-06：管理页打开时不再自动读取或写回 AgentTask webhook Config；已有 AgentTask 行但本机缺 webhook 时只显示只读待确认回执，把页面打开、手动同步、保存“帮我做”和真实执行领取分开。
- 2026-06-09：队列建议和健康告警的一键改期不再只依赖浏览器弹窗确认；成功后会在页面顶部保留可关闭回执，标明改期来源、写入行、明确时间或 08:00 后队列边界，方便用户回到目标消息继续检查。
- 2026-06-11：执行引擎回执补充领取/写回边界：Bot 按当前分钟、30 分钟补偿、08:00 后队列领取并在发送回调后写回；AI/API 和托管 JiraAutomation 领取时即标记本次已处理，避免长耗时 endpoint 被重复领取，但 endpoint 失败排查要看 Jira/API 运行记录。该调整参考 Apps Script trigger 抖动、Slack scheduled message 可管理对象、Zapier replay/recovery 状态，以及 trigger-action 调试研究中对“为什么没触发/为什么不重试”的解释需求。
- 2026-06-15：Timeline 缓存状态面板把“缓存可用但最近同步失败”的旧缓存边界提升到主状态，避免用户误读为最新 Jira Sync Rule 已成功；该调整参考 Atlassian audit/debug、Zapier run history 与 trigger-action debugging 研究中对运行历史和当前生效状态分开的要求。
- 2026-06-12：队列建议和健康告警的一键改期失败时改为页面内持久回执，明确未写入 `Messages`、未改动 `Schedule_Date` / `Schedule_Time`，并给出同步刷新、检查 Sheet 权限或手动编辑的恢复路径；这个调整延续 Zapier / Power Automate run history 对失败恢复状态的可追踪设计，也避免一次性浏览器弹窗让用户丢失失败原因。
- 2026-06-16：队列健康告警和队列建议在操作前补充写回边界，明确一键按钮只修改 `Messages` 排程字段，不会立即发送、不会改 Logs 或跳过前序消息，写入后仍需同步刷新或等待 Jira Automation 轮询确认；该调整参考 Apps Script 触发器抖动、Slack/Twilio 排程消息管理、Zapier/Power Automate/Airtable run history 与 trigger-action debugging 研究中对“恢复动作和真实执行结果分开”的要求。
- 2026-06-18：队列建议新增可持久化的建议原因；卡片、按钮 title 和“已应用改期建议”回执都会保留同一条原因，说明队列位置、前序阻塞、补偿窗口或默认队列容量判断，避免恢复动作完成后只剩写入结果而丢失推荐依据。
- 2026-06-18：新增 / 编辑表单中的“使用建议时间”会保留草稿回执，说明建议原因、目标时间和未写入 / 未发送边界，避免用户误以为点击建议已直接改了维护表。
- 2026-06-18：队列健康告警增加顶部 triage 摘要，直接展示优先处理对象、可一键恢复数量、需手动检查数量和写回边界；该调整参考 Power Automate / Databricks 这类自动化监控把运行状态和可恢复动作放在一起，以及 AI-powered reminders 研究中“提醒要贴合用户工作流”的发现。
- 2026-06-24：队列健康告警补充诊断分布和每条告警的诊断线索，区分补偿超窗、时间异常、默认队列日期过期与 Apps Script 默认发送已过，让用户先判断卡在哪条执行路径，再决定一键改期、编辑还是同步刷新。
- 2026-06-25：暂停 / 恢复行内状态动作新增持久“定时消息状态回执”，明确 `Messages` 写入、Jira Rule / Outreach runtime 同步结果，以及不会立即发送、不会改 Logs、不会绕过待审核批准 / 拒绝流程。
- 2026-06-26：多执行引擎表单把缺 Bot executor 的 Bot / AI Report 选项从“像禁用”的灰态改成“可预览 · 待配置”的 warning 态；用户可以先切换并填写草稿，但保存仍会被阻止，不会写 Messages、发送消息或创建 Jira Rule。
- 2026-06-24：Timeline 缓存状态面板增加“复制诊断”本机剪贴板 handoff，失败时可直接带走 requestId、GET 修复模板、dry-run curl、缓存 Milestone 和 Jira Sync Rule 链接；回执明确只写本机剪贴板，不会刷新缓存、写 Timeline 缓存、保存或发送消息。该调整参考 Jira Automation audit/debug、Zapier/Power Automate run history 和 trigger-action debugging 研究中对故障位置、证据和下一步恢复动作可携带的要求。
- 2026-06-29：新增 / 编辑 Timeline 消息时，缓存状态面板改为默认只显示可用性结论；详细诊断范围、dry-run 边界、真实 Jira Sync Rule 刷新路径和执行后果收进 `i` 信息按钮，避免正常可用状态占用表单空间。
- 2026-06-29：新增 / 编辑表单收敛执行信息，默认只展示预计下次执行日期时间；执行引擎、领取口径和时区说明不再占用主路径，缺配置时才显示简短“发送配置待完成”提醒。列表、健康告警和诊断回执仍保留完整执行路线。
- 2026-06-29：新增 / 编辑弹窗将推送方式提升为顶部 tab，让用户先选 AsMe / Bot / AI Report，再填写主题、内容、时间和目标；下方不再重复显示“推送方式”label。
- 2026-06-22：队列可视化的每个改期建议增加“建议依据”行，把槽位类型、目标位置、前序阻塞数量、已展示 / 未展开样例、建议写入目标和“不自动处理前序或发送消息”边界放在操作按钮前；这个调整参考 Slack Scheduled 消息的集中管理入口、Power Automate run history 的可恢复操作状态，以及 trigger-action programming 研究对 timing / expectation bug 的解释需求。
- 2026-06-29：管理列表的执行器队列提示改为默认折叠，只展示简短排队摘要；操作边界、建议依据、前序样例和改期按钮收进“查看详情”，避免列表首屏被队列诊断占满。
- 2026-06-23：执行引擎回执旁新增“领取口径”，在列表、健康告警和诊断回执中区分明确时间槽、30 分钟补偿、`08:00 后队列`、AsMe、外部 JiraAutomation 和 Outreach；同时显示 Bot 回调写回与 AI/API 领取时先写回的证明边界，避免用户把领取、补偿、写 Logs 或真实发送混为一个状态。
- 2026-06-27：改期建议补充“写入后领取口径”，队列卡片、表单草稿和成功回执都会说明建议落点进入明确时间槽还是 `08:00 后队列`，并继续强调不会立即发送或改 Logs。
- 2026-07-02：队列卡片折叠摘要补充最大同槽、最大预计延后和风险下一步，用户不展开也能先判断这只是轻微排队还是需要处理的执行窗口风险。
- 2026-07-05：队列卡片展开详情时新增本地快照回执，显示计算口径、展示 / 未展开槽位和无写入边界；该调整参考 Slack scheduled messages 的 list/delete/status 边界、Twilio scheduled message 状态、Power Automate run history 排障路径，以及 trigger-action debugging 研究中对时间和触发后果的解释需求。
- 2026-07-06：队列建议 / 健康告警改期成功回执新增“确认口径”，明确本回执只证明 `Schedule_Date / Schedule_Time` 已写入，不代表 Jira Automation / AppScript 已领取、发送、写 `Last_Exec / Logs` 或产生 AgentTask run；用户需要看目标行、同步刷新或等待下一轮执行记录确认。
- 2026-06-28：列表筛选回执改为按每个开启条件独立解释隐藏行，并在同一行被多项条件挡住时显示重叠提示；这延续 Zapier filter chips / run history 和 trigger-action debugging 研究中“why / why-not”可见性的原则，实际筛选结果、Sheet 写入和发送路径不变。
- 2026-06-30：`过滤掉仅发我的` 改为身份归一匹配，兼容旧表显示名、邮箱本地名和多人分隔写法；筛选回执同时显示当前账号识别口径，避免用户误以为旧格式个人提醒没有被筛选或已被执行/删除。
- 2026-07-04：列表筛选回执在后台补齐 Jira / Outreach / Done 状态时显示“后台补齐中”快照边界，避免用户把基础 Messages 计数误当最终执行状态。
- 2026-08-03：顶部健康告警收敛为首屏摘要 + 可操作卡片；去掉 triage / 诊断线索 / 写回边界长文，每条只保留消息主题、错过的发送窗口和建议操作，以及定位 / 编辑 / 一键改期。

## 未来规划

### Phase 2: Bot API 支持 ✅

- [x] Jira Automation 统一执行器（v2 单条消息推送）
- [x] 优先级调度系统（当前分钟 > 过去 30 分钟 > 未指定时间）
- [x] 失败消息智能过滤（避免阻塞队列）
- [ ] 从 Jira Automation 导入规则
- [ ] 批量导入 Scheduled 规则
- [ ] 每日同步 Jira rules 到 Sheet

### Phase 3: 高级功能

- [ ] AI 建议回复时间
- [x] 在管理界面直接创建/编辑消息
- [ ] 消息模板管理
- [ ] 执行历史查看

## 参考资料

- [Google Sheets API 文档](https://developers.google.com/sheets/api)
- [Google Sheets API values.update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update)：写 Config 时需要显式 `valueInputOption`；本功能使用 `RAW` 保留 URL、rule id、ISO 时间和密钥状态字符串
- [Google Apps Script 文档](https://developers.google.com/apps-script)
- [Google Apps Script Authorization](https://developers.google.com/apps-script/guides/services/authorization)：Web App 和 installable trigger 的运行身份会随部署和创建者变化，初始化收据要明确哪个 deployment 和触发器链路被记录
- [Google Apps Script Properties Service](https://developers.google.com/apps-script/guides/properties)：Apps Script 常用 key-value 字符串保存配置，说明 Config 表也应保留明确 key、value 和同步来源
- [Apps Script API 文档](https://developers.google.com/apps-script/api)
- [Google Apps Script deployments.update](https://developers.google.com/apps-script/api/reference/rest/v1/projects.deployments/update)：更新现有 deployment 时应明确 deployment config、版本号和 manifest，适合保持 Web App URL 不变的自动升级
- [Google Apps Script Versions](https://developers.google.com/apps-script/guides/versions)：版本是不可变快照，项目最多 200 个版本，管理页需要在升级前暴露额度和 Project History 清理路径
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)：Properties 单值大小上限为 9KB，Timeline 缓存需要提前提示 payload 大小和修复方向
- [Jira Automation 文档](https://support.atlassian.com/cloud-automation/docs/jira-automation/)
- [Jira Automation JSON smart values](https://support.atlassian.com/jira-software-cloud/docs/smart-values-json-functions/)：Send web request / JSON body 中的文本需要按 JSON 字符串转义，适合把 Timeline dry-run 和修复模板做成可复制诊断
- [Google Drive sharing permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing)：Drive 权限以 `type` + `role` 表达，维护表初始化只尝试域内 writer；不能自动升级为 `anyone` writer
- [Google Apps Script installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)：time-driven trigger 允许分钟级/周期执行，但实际触发时间可能有抖动，产品侧需要补偿窗口和可恢复改期
- [Google Apps Script ClockTriggerBuilder](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)：`nearMinute()` 仍是近似分钟，未指定时会使用随机分钟，说明 UI 不应把底层触发器包装成绝对准点保证
- [Jira Automation scheduled triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/)：Scheduled trigger 可按固定频率或 cron 运行，连续失败会自动禁用，适合在管理页暴露健康和恢复路径
- [Airtable Sync settings](https://www.airtable.com/guides/scale/sync-data-into-airtable)：同步产品会让用户看到源、目标、字段和频率等设置，支持 Config 绑定时展示来源与差异
- [Airtable Sync](https://support.airtable.com/docs/getting-started-with-airtable-sync)：同步入口应让用户理解来源、目标和预期行为，支持手动 Config 同步在采用前显示待确认状态
- [Automating Spreadsheet Discovery & Risk Assessment](https://arxiv.org/abs/0809.3016)：电子表格作为最终用户应用容易缺少工程控制，关键配置应有可持续的识别、风险和来源线索
- [Zapier Filters & Paths](https://help.zapier.com/hc/en-us/sections/16074338520461)：面向用户的自动化产品会把条件分支和路径显式化，Scheduled Messages 的多引擎路由也应让用户看到当前走哪条路径
- [Power Automate retry / run history limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config)：成熟自动化平台会暴露运行历史、重试限制和失败后的恢复语义，支持这里的执行引擎回执与缺配置提示
- [Power Automate bulk resubmit](https://learn.microsoft.com/en-us/power-automate/how-tos-bulk-resubmit)：重放 / 取消是明确选择后的动作，支持把“等待当前同步结果”和“尚未追加第二次执行”区分展示
- [Power Automate monitoring and alerting](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/monitoring-and-alerting)：自动化不是 set-and-forget，监控面需要暴露失败、指标、运行历史和可行动恢复路径
- [Databricks Jobs monitoring](https://docs.databricks.com/aws/en/jobs/)：作业监控会把 last run、任务状态、日志、指标和告警集中展示，支持队列健康把影响和下一步放在同一提示区
- [Understanding provenance black boxes](https://link.springer.com/article/10.1007/s10619-009-7058-3)：工作流 provenance 只记录“哪个黑盒跑过”仍不够，用户还需要能理解每个步骤做了什么；因此执行引擎名称和简短说明保留在列表、健康告警和诊断 UI 中，新增 / 编辑表单默认只呈现下一次执行和必要阻塞
- [Quartz misfire instructions](https://www.quartz-scheduler.net/documentation/quartz-4.x/tutorial/more-about-triggers.html)：成熟调度器会显式建模 missed fire，补偿策略应可见而不是靠用户猜
- [Twilio Message Scheduling](https://www.twilio.com/docs/messaging/features/message-scheduling)：排程消息需要明确状态、可取消标识和发送前校验，说明恢复路径要暴露目标时间和后续状态
- [Zapier troubleshooting](https://help.zapier.com/hc/en-us/articles/8496037690637-How-to-troubleshoot-errors-in-Zaps)：成熟自动化产品会区分 errored / on hold / scheduled retry 等运行状态，并提供 replay / recovery 路径，支持把队列健康提示做成可直接处理的恢复入口
- [Zapier replay Zap runs](https://help.zapier.com/hc/en-us/articles/8496241726989-Replay-Zap-runs)：manual replay 是独立恢复动作，支持 Config 同步把重复点击和实际重放 / 写回分开说明
- [Zapier Zap history](https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history)：自动化平台会让用户按状态和步骤查看 run 结果，支持一键初始化后用简短收据保留完成证据
- [Airtable automation troubleshooting](https://support.airtable.com/docs/troubleshooting-airtable-automations)：自动化调试应能回到 trigger / action 测试和 run history 状态，支持把初始化拆成可解释步骤
- [Airtable automation run history](https://support.airtable.com/docs/getting-started-with-airtable-automations)：Run History 支持按状态过滤并展开失败细节，支持在筛选视图里保留可追踪的目标状态和恢复路径
- [Helping Users Debug Trigger-Action Programs](https://www.blaseur.com/papers/imwut22-debuggingtap.pdf)：终端用户从“看到异常自动化行为”到“定位并修复问题”会遇到多阶段障碍，支持在深链定位时直接解释筛选覆盖和非执行边界
- [Slack scheduled messages API](https://docs.slack.dev/messaging/sending-and-scheduling-messages/)：已排程消息需要可列出、删除，更新时可用删除后重建策略
- [Slack send and read messages](https://slack.com/help/articles/201457107-Send-and-read-messages-in-Slack)：Drafts/Scheduled 集中入口支持编辑、改期、发送、取消或删除
- [Slack recurring messages workflow](https://slack.com/help/articles/23814859584659-Automations--Schedule-recurring-messages-in-a-channel)：周期消息应把开始时间、频率、发送目标和正文配置放在同一个可编辑 workflow 中
- [Microsoft Teams schedule chat messages](https://support.microsoft.com/en-gb/office/schedule-chat-messages-in-microsoft-teams-2fc5ea77-7bb4-4511-8f59-e62bac1c0f6a)：已排程消息支持编辑、改期和删除
- [Gmail Schedule Send](https://support.google.com/mail/answer/9214606?hl=en-GB)：取消已排程邮件会回到草稿，说明取消 / 删除前后的可恢复上下文要明确
- [Google Chat schedule messages](https://support.google.com/chat/answer/16059642?co=GENIE.Platform%3DDesktop&hl=en)：Drafts 入口集中管理待发送消息，并显示发送人与接收人时区
- [Analyzing and Predicting Task Reminders](https://www.microsoft.com/en-us/research/publication/analyzing-predicting-task-reminder/)：提醒时间会受创建时间和文本内容影响，调度系统要让用户能明确控制实际触发日历
- [AI-Powered Reminders for Collaborative Tasks](https://erichorvitz.com/AI_powered_collaborative_reminders_CSCW_2024.pdf)：知识工作者对提醒的使用方式差异很大，提醒设计应贴合工作流并帮助找回被遗忘任务
- [Intelligent Notification Systems survey](https://arxiv.org/abs/1711.10171)：通知系统应结合时间、上下文和偏好提高接收时机的可接受度
- [Empowering End Users in Debugging Trigger-Action Rules](https://iris.polito.it/retrieve/handle/11583/2724318/231604/euddebug.pdf)：非程序员容易误解 trigger-action 规则，调试线索和运行前/运行后可见性有助于建立正确心智模型
- [Snooze! Investigating the User-Defined Deferral of Mobile Notifications](https://doi.org/10.1145/3229434.3229436)：用户常把人和事件相关通知推迟到当天稍后或次日早上，说明“默认队列”和清晰改期入口比隐藏失败更符合实际使用
- [Iqbal & Bailey CHI 2007 interruption timing](https://www.interruptions.net/literature/Iqbal-CHI07.pdf)：不合适的通知时机会增加恢复成本，调度工具应让发送时间和上下文更可预期
- [The Update Framework specification](https://theupdateframework.github.io/specification/v1.0.17/)：自动更新系统需要明确目标、完整性和信任边界；本功能用版本端点、deployment 匹配和项目归属预检降低误更新风险
- [Betrayed by Updates](https://doi.org/10.1145/2556288.2557275)：负面更新体验会降低用户后续接受更新的意愿，因此升级失败时要解释风险、恢复动作和当前系统是否被改动
- [Adaptive notification scheduling study](https://www.sciencedirect.com/science/article/abs/pii/S1574119217304388)：真实生产环境中延迟到更合适时机发送通知能改善响应体验
- [Supporting End-User Debugging of Trigger-Action Rules](https://giove.isti.cnr.it/AssetsSitoLab/publications/ijhcs-rev-final-very-last-24%20september-very-final.pdf)：触发-动作自动化需要把失败原因、位置和下一步恢复动作放到用户能看到的诊断路径里
- [TAPInspector](https://arxiv.org/abs/2102.01468)：触发-动作系统的并发、延迟和迟到属性会带来安全/活性问题，调度 UI 应把这些风险前置成可理解的状态
