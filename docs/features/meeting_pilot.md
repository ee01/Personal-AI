# Meeting Pilot

_最后更新: 2026-07-16_

## 是什么

`Meeting Pilot` 是面向 `https://v.ringcentral.com/conf/on/:meetingId` 的 RingCentral Web 会议副驾。

它不是静默录制机器人，而是围绕一次会议提供三层能力：

1. **会中提醒（In-Meeting Alerts）**
   - 在页面内用低打扰方式提示你被点名、被 assign、话题变化、相关历史记忆等关键信息。
2. **会中主控面（Side Panel / Live Map）**
   - 用于查看当前话题、时间线、行动项、摘要状态与配置状态。
3. **会后复盘（Panorama）**
   - 查看归档后的会议摘要、时间线、行动项、决议、参会者立场，以及 PDF 会议纪要状态。

## 大白话运行逻辑

Meeting Pilot 的主线是“用户主动开始一次会议 capture 后，系统把会前上下文、实时转写、会中事件和会后复盘串起来”。它不会静默录制，也不会在没有 readiness 检查时假装完整可用。

结果主要受这些因素影响：

1. 用户是否主动开始 Capture：这是最强门槛，没有开始就只显示入口和准备状态。
2. Readiness 状态：Meeting Pilot 开关、ASR、memory-service、分析模型、Minutes API 任一不可用都会影响能力完整度。
3. 会前 handoff：Today Pilot / Video Home 提前准备的 meeting prep 和 Rehearsal 预演提醒会影响会中 cue cards 和目标提示；Rehearsal 只表示“这场未来会议里应该想起/说/做什么”，不是普通事实记忆。
4. ASR 层级：RingCentral Transcript、Desktop Local ASR / Whisper fallback、远端分析可用性决定实时文本质量和延迟。
5. 会前目标证据：Today Pilot 的 `MeetingOutcomeBinder` 决定 side panel 要跟踪哪些“本场要闭环”事项；没有 binder 时不伪造目标。
6. 会议结束归档：停止 capture 后的摘要、行动项、Panorama 和结果装订依赖已收集转写和事件是否完整。

## 用户主流程

### 1. 自动识别会议

- 当标签页进入 RingCentral meeting URL 时，页面会注入 `Meeting Pilot` 浮动入口。
- popup 中也会显示当前会议卡片。

### 2. 用户主动开始 Capture

- 扩展不会静默自动录制。
- 用户点击浮动入口或 popup 中的开始动作后，Meeting Pilot 会先做 **readiness / preflight** 检查：
  - `Blocked`：不允许开始录制（当前主要是 Meeting Pilot 功能被关闭）
  - `Degraded`：允许录制，但部分智能能力降级（例如 ASR / memory-service / analysis model / Minutes API 不可用）
  - `Ready`：完整能力可用
- 当缺少必须配置时，浮动入口、popup、side panel 都会引导用户前往 `options` 配置页。

### 3. 会中查看与操作

- 浮动入口可打开 Meeting Pilot 面板。
- popup 可打开：
  - side panel
  - Live Map
  - Panorama
  - 会议记录归档页
- side panel 当前包含：
  - `实时`
  - `发言（Speech）`
  - `时间线`
  - `行动项`
  - `设置`

### 4. 停止录制与会后结果

- 停止录制后：
  1. 录制视频上传到 `POST /api/v2/upload/video`
  2. 请求 `POST /api/v3/generate_digest`
  3. background 只在本次 capture 生成的有效 lookup 窗口内轮询 `GET /api/v3/digest/{id}`；超过 30 分钟仍未完成会停止轮询并标记 PDF 生成失败，避免旧会话在后台无限探测 Minutes API。
- 同时，会议结构化数据会**在停止录制时立即写入 memory-service**，不等待 PDF 完成。
- 写入会议归档前，background 会把当前 transcript、决议、章节和行动项交给 Memory Service 装订会前 binder；装订失败不会阻止原始会议归档，Panorama 会保留可重试的失败边界。
- PDF 就绪后，后台会补全 meeting record 中的 `pdfUrl`。

## 主要能力

### 会中提醒

- P0 / P1 / P2 分层提醒
- Side panel 中每条会中提醒都会展示 `为什么 / 下一步 / 边界`：说明它为什么打扰、用户接下来该看哪里，以及它不会自动发言、发送消息、写外部任务或确认决策
- Side panel 和 Live Map 都会显示 `提醒可见口径`：说明当前显示了多少可操作提醒、哪些纯上下文刷新已被降噪、哪些关联记忆已提升或隐藏；这是当前页面可见切片，不是全量会议审计，也不会标记提醒已处理、写行动项或外发纪要
- Live Map 的 `Alerts and Context` 也复用同一套会中提醒边界回执和过滤口径；用户在会议地图里看到 P0/P1/P2 提醒时，同样能判断它只是提示、复核或召回入口，不代表已经发言、写外部任务、确认事实或发送给他人
- 记忆关联以 P2 弹幕 + side panel feed 形式出现
- hover 参会者头像可查看 stance / key quote

### 会中面板

- 当前话题
- Catch Up 轻量快照
- Today Pilot / Context Assist 会前准备 handoff（目标、问题、Rehearsal 预演提醒、证据来源）
- `本场要闭环`：对同一份会前 binder 显示 `未提到 / 已提到 / 待会后核验 / 最终结果`；会中不直接把目标改成 resolved
- 时间线（支持展开详情）
- 行动项列表（owner / deadline / transcript 依据）
- readiness 状态
- tab、会前 cue、行动项筛选、确认、完成、忽略、复制、编辑和人工补录按钮都会在 hover / 读屏文案里说明当前动作只影响本场侧栏状态、当前会议 session 或本机剪贴板，不会自动创建外部任务、发送纪要或写回 Calendar / Jira / RingCentral。

### 会后 Panorama

- 会议摘要
- 时间线
- 行动项（保留 owner、deadline、识别时间和原始依据句，方便复核 AI 是否误判）
- 决议
- 参会者发言分布
- 参会者立场与态度
- `会后结果装订`：逐项展示 resolved、partially resolved、unresolved、carried over、证据不足或移出议程，以及支撑证据
- PDF 纪要区块与状态
- 从历史归档重新打开

### 会前目标到会后结果装订

Meeting Outcome Binder 是 Meeting Pilot 对 Today Pilot 会前目标的消费机制，不是另一套 action item 或摘要产品。

1. **会中跟踪**：side panel 从匹配的 handoff 读取 binder。Transcript 关键词命中只显示 `已提到`；出现相关决议或行动项时只显示 `待会后核验`。这两个状态都不等于已解决。
2. **会后装订**：停止 capture 后调用 `POST /api/v1/meeting-outcomes/bind`，输入本场 transcript、决议、行动项和章节。每个结果只保留存在且与 slot 匹配的 evidence ref。
3. **证据守卫**：`resolved` 必须有匹配决议或状态为 done 的行动项；pending 行动项最高是 `partially_resolved`；transcript 单独提及是 `unresolved`；只有证据明确说“下次继续”才是 `carried_over`；不存在或不匹配的引用进入 `blocked_by_missing_evidence`。
4. **归档恢复**：binder 使用独立持久化表，并投影到 meeting detail。用户从会议历史重新打开 Panorama 时，完整归档会恢复同一份结果；如果详情 API 失败，页面不会根据列表计数伪造结果。
5. **无外部写回**：结果是 Personal AI 的只读派生对象。P0 不修改 Calendar agenda，不创建 Jira/外部任务，不发送纪要，也不替用户确认决定。

Panorama 首屏在原有输出范围回执之后展示 compact `会后结果装订`，包括总状态、每个 slot 的结果摘要、证据预览和无写回边界。真实交互可通过内置 `meeting-panorama.html?demo=1` 查看；概念串联参考 [Meeting Outcome Binder demo](../demo/meeting-outcome-binder.html)。

### 会议历史归档

- `memory-exploring` 中提供 `📡 会议记录` 入口
- 每条会议展示：
  - 标题
  - 日期/时间
  - 参会者
  - Digest / PDF 状态（包含生成中、失败、PDF 缺失或链接不可用）
  - 摘要
  - 结构化数量（话题 / 行动项 / 决议）
- 历史页默认加载最新 50 条，并展示“已显示 / 总数”；当归档超过一页时，用户可以继续加载更早会议，避免旧会议只存在于后端但 UI 不可达。
- 列表会显示 `归档完整度回执`：按当前已加载/筛选结果统计完整可交付、需复核、生成中和仅基础归档会议，提醒用户这只是当前显示范围的只读快照，不是全库审计，也不会自动重跑 Minutes API、生成 PDF、发送纪要或写回行动项。
- 可以按标题、摘要、参会者、会议 ID 或归档转写/观察文本搜索，并按可打开 / 需处理 / 生成中 / 仅归档筛选；筛选在会议归档 API 层先执行，再分页展示，避免只搜索当前第一页或只搜索卡片可见字段。
- 可直接打开 Panorama 或安全 PDF；每张卡片都会先说明打开范围、PDF 是否可用，以及这些动作不会重新分析会议、发送纪要、写入 Memory Service 或修改行动项。点击后卡片内会留下本页 `打开回执`，区分已打开 Panorama、已打开安全 PDF，以及这些点击仍只是打开现有材料。

## 配置

Meeting Pilot 的核心配置统一在 `options.tsx` 中维护：

- `MEETING_PILOT_ENABLED`
- `MEETING_PROVIDER_BASE_URL`
- `MEETING_PROVIDER_API_KEY`
- `MEETING_TRANSCRIBE_MODEL`
- 会中结构化分析：与**选项页主 LLM** 相同（`LLM_TYPE` + 对应 `OPENAI_MODEL` / Dify / Ollama 等），不再使用单独的 `MEETING_ANALYSIS_MODEL`
- `MEETING_MINUTES_API_URL`

side panel 的 `设置` 只保留会中体验和个性化配置，例如：

- 弹幕速度
- 自动识别
- 入口方式
- 热词 / 别名
- 摘要间隔 / 采样间隔
- memory context
- privacy notice

## 会议记录如何参与记忆系统

会议归档进入 memory-service 后，默认参与以下检索面：

- **`/ask`**：默认参与
- **普通 `recall()`**：默认参与
- **Meeting Pilot 会中 recall**：默认参与

默认**不直接**进入以下面向其他任务的上下文流：

- `contextMatch`
- 梦境重放
- 自我反思

这些面向更广泛主题的系统，只有在明确需要“会议历史”时才建议把 `meeting` source 纳入。

## 已知边界

- 扩展不能静默自动开始录制。
- `Minutes API` 只影响会后 PDF 纪要；未配置时会中捕获、提醒、结构化归档仍可继续。
- ASR / memory-service / analysis model 为可降级依赖；降级时会中总结、发言建议、历史召回或结构化分析质量会受影响。
- `SpeechRecognition` 的麦克风路径不作为有效的会议转写降级方案。
- 当前会中智能分析以 provider-backed transcript / observation / analysis 为主，仍受外部服务可用性影响。
- 行动项识别会尽量抽取明确 owner 和 deadline；如果 transcript 只有泛泛讨论 owner、没有实际分配动作，则不会生成行动项。
- 启发式行动项不会只因为出现“下周/截止”或单纯确认句就生成待办，避免把议程安排、决议确认误判成行动项。
- 启发式行动项不会把 “we should / 我们需要 + deadline” 这类没有明确负责人的泛泛承诺默认归给当前发言人；显式 `Action item:` / `待办:` 标签但缺 owner 时会进入待分配复核。
- LLM 行动项和启发式行动项都会尽量保留 transcript 依据，但仍需要用户复核后再当作正式任务。

## 当前实现补充

- 行动项抽取已从 background 主链路拆到 `src/meeting-shell/actionItems.ts`，便于单测覆盖中英文 owner / deadline / evidence。
- Side Panel、Live Map、Panorama 都会展示行动项依据；时间线展开后也能看到同一章节行动项的证据句。
- Side Panel 行动项支持 `待复核 → 已确认 / 已忽略 / 已完成` 的轻量 review 流程，并提供 `处理中 / 待复核 / 已确认 / 已完成 / 已忽略 / 全部` 筛选；用户确认、忽略或完成后的状态会在实时分析刷新后保留。
- 行动项 review 状态只会按稳定身份（owner / title / deadline）继承，避免实时分析刷新后把同一列表下标的新行动项误标为已忽略或已完成。
- Side Panel 每条行动项支持一键复制结构化文本（行动项、负责人、截止、识别时间、状态和依据），也支持按当前筛选批量复制；确认后的未完成项还可以一键复制为 Markdown 跟进清单，避免待复核 AI 建议直接流入外部任务系统。
- Side Panel 每条行动项支持人工校正标题、负责人和截止时间；保存后会自动进入已确认状态，并在后续实时分析刷新时按 AI 原始身份继续继承，避免用户修正被新一轮结构化分析覆盖。
- Side Panel 行动项页支持手动补充 AI 漏掉的行动项；人工新增项默认已确认，会写入当前会话时间线，并在后续实时分析刷新后优先保留；负责人可先留空并标记为 `待分配`，避免会中只想先记录任务时被分配信息阻塞。
- Side Panel 行动项路径的真实控制点都有按钮级边界：tab 切换只改本地视图，会前 cue 只写当前 session 的行动项，筛选只改变可见列表，复制只写本机剪贴板，确认/完成/忽略只改本场 review 状态，编辑/人工补录保存也不会直接创建外部任务、发送纪要或写 Calendar / Jira / RingCentral。
- 人工新增行动项的时间线锚点会在后续实时分析刷新后继续保留；用户修改标题、负责人或截止时间后，回跳时间线仍会定位到同一条人工记录，避免补录任务失去上下文依据。
- Today Pilot / Context Assist 带入的会前准备问题或目标可以在实时页一键加入行动项；系统会默认归给自己、截止标记为本次会议、保留会前证据，并按当前会议去重，避免用户会中手动抄写准备事项。
- RingCentral Video Home 的 Today Pilot 卡片初始只读取预生成 meeting prep；用户点击刷新时会先为当前日期 backfill meeting prep，再把缓存结果写入 Meeting Pilot handoff，避免缺少 nightly 预生成缓存时会中面板拿不到准备内容。
- Meeting Pilot 读取 Today Pilot handoff 时，会优先展示 `本场关注`：它来自会前准备的 action cue、建议问题、摘要或 brief cue。旧缓存如果没有显式目标，side panel 会从 cue cards 兜底提炼，避免用户进入会议后只看到证据和卡片，却看不到本次会议应确认的核心问题。已经打开的 side panel 会监听单条 handoff 和候选集合两种本机缓存刷新；Video Home 刷新同一会议准备后，侧栏会重选最新匹配的 handoff，并继续保留匹配方式、缓存年龄、剩余有效期和无外部写入边界。
- Side Panel 每条行动项支持回跳到同章时间线证据；点击 `时间线` 后会切到时间线 tab、展开并高亮最相关的 action / chapter 事件，便于从任务回看会议上下文。
- Side Panel 的 Live 卡片和页脚会在 Capture 未开启时提供 `查看开启步骤`，直接在会议页打开扩展 icon / popup 授权 coachmark，避免用户只看到静态说明。
- Side Panel 的 Capture 起步卡主按钮和底部 sticky Capture / 配置按钮都有 hover / 读屏边界，区分打开 Options、显示 popup 授权步骤、增强 Transcript-only 低配运行、重试/重新开启和停止当前 Capture；点击前会说明不会直接开始录制、上传音视频、通知参会者、发送纪要或创建外部任务。
- popup 点击 `开启会议全貌` 后会先显示本机 Capture 启动提交回执：提交中不代表录制已开始，也不会通知参会者、发送会议内容、创建纪要、写外部任务或代表用户取得录制同意；失败回执也保留同一非效果边界。
- Side Panel 的 Capture 起步卡会显示 `当前 / 范围 / 下一步` 回执，区分等待授权、配置阻断、部分降级、启动失败、已停止和 Transcript-only 低配运行，并说明本机 Capture 不会自动通知参会者或代表用户取得录制同意，避免用户把“未录制”“低配可用”或“需要从 popup 重新授权”混在一起。
- 会议页浮动入口支持当前页面临时隐藏或保存为“永不展示”；保存成功后当前会议页会立即隐藏入口，之后可在 Options 的 Meeting Pilot 配置里重新打开，避免入口关闭像失败一样停留在页面上。
- 会议页入口请求内嵌面板时，如果目标 tab 无法接收内嵌面板消息，background 会返回 `surface='unavailable'` 和可恢复错误码；页面不再显示“已打开”，而是提示用户保留会议页、从 popup / Chrome 侧边栏重试或去 Options 修复配置。
- 会议页内嵌面板顶部会显示 `页内面板` 回执，区分加载中、已载入和加载未确认；回执说明当前面板绑定的是本场会议页，打开或关闭面板不会自动开始、停止或外发 Capture，并提供父级关闭按钮。
- 会议页父级只接受当前受控内嵌面板 iframe 发出的关闭和 Catch Up 消息；同源但不是当前面板的 extension iframe 不能伪造关闭动作，避免会议页入口状态被误改。
- popup 开始 Capture 失败时会直接展示阻断原因、已有录制冲突或授权失败的下一步；配置阻断时可从提示里直达 Meeting Pilot 配置页。
- offscreen 实际启动 tab capture / MediaRecorder 失败时，background 会保持 `capture.kind='error'` 并保留真实错误，不会再把失败会话覆盖成 `recording` 或打开成功态面板。
- Capture 停止后重新开始会重置本次 `startedAt` 并清空旧 `stoppedAt`，避免 REC 计时、归档时长和会后记录沿用上一段录制时间。
- Side Panel 实时页顶部会先显示 `现在先看`：把 Capture 状态、P0/P1/P2 提醒、行动项复核和当前话题压缩成一屏内可扫的重点栏，并保留“只提示，不代你发言或外发”的边界。用户可以直接从这里跳到开启步骤、配置修复或行动项复核，避免会中被会前准备、记忆卡和提醒 feed 淹没。
- Side Panel 的实时页会在存在待复核或处理中行动项时显示 `Action Review` 卡片，直接跳到行动项复核筛选，避免用户只看实时提醒而漏掉会后跟进。
- Side Panel 行动项工具栏支持一键确认当前筛选中信息完整的待复核项；未复核项的完成按钮会显示为 `确认并完成`，避免用户无意绕过 AI 建议复核。
- Side Panel 会在行动项卡片、实时页下一项提示和复制文本里标出 `补负责人` / `补截止` / `缺依据`，提醒用户在把 AI 建议流入外部任务系统前补齐关键信息。
- Side Panel 行动项增加 `需补信息` 筛选；批量确认只处理当前筛选里已具备负责人、截止和依据的待复核项，缺信息项仍可单条确认，作为用户明确接受的例外路径。
- 缺负责人、截止或依据的待复核项在单条确认/完成时会显示 `确认例外` / `确认例外并完成`，避免用户把低置信 AI 建议误当成已完整复核的正式任务。
- Side Panel 实时页会把本轮最重要的关联记忆提升到顶部 `会中关联记忆` 卡片；如果命中 `type='rehearsal'`，文案显示为“预演提醒”，并解释参会人、会议、项目或 issue 等命中线索。只有未来会议场景和预演内容都清楚时才按 Rehearsal 展示；单纯事实、状态或弱联想仍按普通记忆/Reflection/Dream 处理。这些已提升的记忆不会再重复进入下方提醒 feed；会议页记忆弹幕和 side panel feed 都会过滤 `displayPriority: hidden` 或无解释价值的记忆，并且记忆弹幕只暴露安全的记忆库/来源链接，避免同一条 context 在会中主控面重复或不安全地打扰用户。
- Side Panel 和 Live Map 的 P0/P1/P2 会中提醒卡会显示原因回执：`mention` 提醒说明只提示点名不代发言，`action` 提醒说明需去行动项页复核 owner / deadline / transcript 依据，`memory` 提醒说明只是召回不改写记忆，`share` / `summary` 提醒说明 OCR 或摘要可能延迟且不会确认事实或通知他人。回执还会显示 `信号` 新鲜度：刚刚/几分钟前/较旧/缺时间戳，并按 transcript、会中事件、记忆召回、共享画面/OCR 或摘要变化说明当前提醒的依据口径，避免旧提醒或无时间戳提醒被误认为本轮刚发生的事实。这样用户能在会中判断要不要处理，而不是只看到一个等级标签。
- Side Panel 和 Live Map 共用同一套会中提醒过滤与可见口径：纯主讲人切换 / context refresh 不再作为可操作提醒展示；顶部回执会把降噪数量、已提升关联记忆和隐藏记忆边界说清楚，避免用户把“无新提醒”理解成会议没有任何后台信号。
- Side Panel 顶部会显示 `侧栏状态源回执`：区分按 `tabId` 绑定真实会议页、无 `tabId` 时读取当前活跃会议、`demo=1` 本地演示数据，以及请求的旧 `tabId` 已无会议 session 的未绑定状态。带旧 `tabId` 的独立窗口不会再回退展示其他活跃会议，避免用户在旧会议窗口里误改当前会议的行动项。
- 行动项更新会同时校验 `tabId` 和 `meetingId`；如果会议标签页已经切换到另一场会议，旧 side panel / 独立窗口不能继续改写新会议的行动项。
- 被忽略的行动项不会进入会议记忆 recap 的主行动项列表，但仍会保留在 session 的完整结构化数据里，方便排查 AI 误判。
- LLM 结构化分析 prompt 要求输出 `actionItems.evidence`，启发式路径会把触发行动项的 transcript 句子写入 `evidence`。
- 启发式行动项需要明确 owner / 第一人称承诺 / 显式行动项标签之一才会生成；owner 不明确的显式行动项会以待分配状态进入复核，而不是直接绑定到发言人。
- LLM 返回的行动项 / 决议会补齐当前 chapterId，避免时间线展开时找不到同章行动项。
- 实时分析刷新时优先保留当前识别到的行动项；已确认/已忽略的旧项只在容量有余时继续保留，避免旧复核记录挤掉新任务。
- Local ASR session 启动后如果 desktop app chunk stream 连续失败，provider 会把它升级为 fatal ASR 错误并触发下一层 fallback；TierBadge tooltip / toast 和 capture log 会保留本次降级原因，避免用户看到“本地 ASR 运行中”但一直没有 transcript。
- Speech 面板会展示 `ASR 链路回执`：把转写模式、当前层级、本轮探测路径、最近转写来源、上传边界和 fallback/恢复动作放在同一块里；回执卡本身的 hover / 读屏文案也会汇总当前层、上传边界、新鲜度和下一步，并说明它只是当前会议 session 的转写状态快照，查看不会开始/停止 Capture、切换 ASR 模式、额外上传音频、请求 RingCentral 保存/下载完整 transcript、发送纪要或创建外部任务。Chrome On-Device / Web Speech 启动后会直接显示首条转写 watchdog，说明空 transcript 不等于会议无人发言、超时会按当前模式切层，以及可改用 Desktop App / Cloud ASR。Local ASR 如果只有 Whisper / final engine 可用，会直接说明“无实时预览、final transcript 可能延迟到静音或停止后出现”；本地 chunk stream 警告会额外显示 `本地流状态`，把重试计数、距离 fatal fallback 的剩余失败次数、实时 partial preview 暂停、已收到 final / 历史 transcript 保留、当前音频仍只发给本机 Desktop App，以及继续失败后的切层边界拆成可扫的一行。Local ASR 尚未可用时，回执会把 Desktop App 未连接、模型下载中、模型安装失败、live engine 已就绪但 final/Whisper 兜底未就绪、final engine 未就绪或 Whisper binary 未安装这类准备状态翻译成 `本地准备` 与具体恢复动作，不再只暴露 raw readiness code。Cloud ASR 会显示实际 endpoint 风格（`/v1/audio/transcriptions` 或 `chat/completions + input_audio`）、模型、语言和单片音频上传限制，同时保留“为什么切到云端”和“本轮哪些层已不可用/失败/被选中”的 probe trail。这样用户不用只靠徽章 hover 或 capture log 判断当前是会议页转写、本机 ASR，还是已经切到云端转写。
- Capture 前的 readiness / preflight 也会复用同一套 Local ASR 可恢复口径：如果模型下载中、Whisper binary 缺失、Desktop App 未连接，或只有 live engine ready 但 final transcript 兜底未 ready，入口会直接说明当前本地准备状态、下一步恢复动作，以及 `local-only` 不会调用云端、`auto` 只有实际切到 Cloud 层时才上传音频；不会再把这些状态压成泛化的 “Local ASR unavailable”。
- 从会议历史归档打开 Panorama 时，会保留行动项的 evidence、timestamp、source、chapterId 和 review 状态。
- 会议历史归档会透出 Digest 的真实状态和错误码：PDF 生成失败、完成但 URL 缺失、或 PDF 链接不是安全 http(s) 地址时，不再显示成“等待 PDF”，并且不会把不安全链接带入 Panorama 或打开动作。
- 会议历史归档会显示已加载数量和总数，超过 50 条时提供 `加载更早会议`；加载第二页失败时保留当前列表，并在读取回执里标明本次未更新、仍显示上次成功读取的只读快照，避免用户误以为历史归档只有第一页或已经成功追加。
- 会议历史归档支持关键词和状态筛选；关键词会覆盖标题、摘要、参会者、会议 ID、错误码以及同一会议下归档的转写/观察文本。`ready` 表示有安全 PDF 或 Digest 完成，`attention` 表示 Digest/PDF 失败、缺失或链接不可安全打开，`processing` 表示 Digest 仍在生成，`archived` 表示只有基础归档记录。任何非 http(s) 或无法解析的 PDF URL 都会进入 `attention`，卡片内显示 `处理建议`，让用户先回 Panorama 复核结构化归档，再排查 Minutes API / PDF URL 写回。
- 会议历史归档在初始加载、手动刷新、搜索/状态筛选、清除筛选和加载更早会议后都会显示 `会议归档读取回执`，说明本次读取来源、筛选范围、已显示/总数和只读边界；读取失败时同一区域改为 `failed` 回执，明确本次没有更新数据、当前是空状态或旧快照。这些操作只读取历史列表，不会重新分析会议、生成 PDF、写入 Memory Service、发送纪要或修改行动项。
- 会议历史归档会在列表上方显示 `归档完整度回执`，把当前已显示会议分成完整可交付、需复核、生成中、仅基础归档四类。该回执只统计当前页或当前筛选范围；如果只加载了最新 50 条，会明确标为当前页快照，加载更早会议后再重新计算，避免把未加载历史误当成已审计。
- 会议历史归档筛选成功但返回 0 条时，会显示 `空结果回执`：说明服务端已按同一关键词/状态读取、关键词覆盖标题/摘要/参会者/会议 ID/错误码/归档转写与观察文本、0 条不代表读取失败或历史被删除，并给出清除筛选、放宽关键词或切换状态的恢复路径。
- 会议历史归档卡片在打开按钮前显示 `打开范围`：安全 PDF 会明确只打开 http(s) 外部链接；PDF 失败、缺失、生成中或被安全规则拦截时，按钮保持禁用并说明可先用 Panorama 只读复核结构化归档，不会催跑 Minutes API、补发 PDF、发送纪要、写回归档或修改行动项。`打开 Panorama` / `打开 PDF` 按钮本身也带 hover / 读屏边界，说明当前卡片快照、外部 PDF 安全检查和禁用原因，避免只依赖相邻说明。
- 会议历史归档点击 `打开 Panorama` 或 `打开 PDF` 后会在当前卡片留下 `打开回执`：Panorama 回执说明只是打开现有结构化归档；PDF 回执说明只把已通过安全检查的 http(s) 链接交给浏览器。二者都不会分享、发送、重跑 Minutes API、写回会议记录或修改行动项，也不会创建外部任务。
- Panorama 会单独展示 `会后跟进状态`：区分可直接跟进、待复核、需补信息和已完成行动项，并支持复制带负责人、截止、状态和依据的 Markdown 跟进清单，避免用户把未复核或缺依据的 AI 行动项直接外发。
- Panorama 顶部 `回放录制` 只在当前会议有真实且通过安全检查的录制素材 URL 时启用；只有 PDF 的归档会议会继续使用 `会议纪要 PDF` 入口，避免把 PDF 打开误导成录制回放。`复制页面链接`、PDF 链接和录制链接都会走同一套复制 fallback，并给出可见成功/失败反馈。
- Panorama 首屏会显示 `输出范围回执`：汇总页面链接、JSON 本机导出、Markdown 跟进清单、PDF 和录制素材的可用状态，并说明这些动作只会打开、复制、下载或导出现有材料，不会发送纪要、创建外部任务、确认行动项、重跑分析、写回 Memory Service，或修改 Calendar / Jira / RingCentral。PDF 和录制素材的打开、下载、iframe 预览、复制和回放都只接受无凭据的 `http(s)` 链接；`javascript:`、带账号信息或非 http(s) 的素材会显示 `已隐藏` 原因，并且不会进入外部动作。首屏的 PDF 跳转、页面链接复制、JSON 导出、录制回放、跟进清单复制、PDF/录制素材打开/下载/复制和 footer 反馈按钮都会在 hover / 读屏文案里重复对应边界，避免用户把复制/打开现有材料理解成已经分享纪要、创建任务、确认行动项或触发校准。
- 从会议历史打开 Panorama 时，会优先展示 memory-service 的完整归档明细，而不是同 meetingId 的活跃 session 缓存；页面顶部会标出完整归档是否已载入，并显示 `归档来源回执`。如果完整归档加载失败，回执会说明当前只来自历史列表带入的基础信息，行动项/决议/时间线为空不等于会议没有这些内容，也不会自动补发 PDF 或重写归档。归档 action item 会继续保留 AI / 规则 / 手动来源、review 状态、缺信息标签、evidence 和时间线锚点，避免会后复核链路退化成只有摘要/PDF。
- 会议历史打开 Panorama 时，会把列表卡片上的摘要、话题数、行动项数和决议数作为只读快照一起带入。若完整归档详情 API 暂时失败，Panorama 的 `归档来源回执` 会显示这份列表快照，并明确完整行动项正文、决议正文、时间线和立场仍未载入；它不会把这些计数伪造成真实条目，也不会自动重跑分析、补发 PDF、写回 Memory Service 或修改行动项。

## 行业与论文参考方向

- Zoom AI Companion 和 Teams Intelligent recap 都把会议 AI 的启动/停止、转写质量、会后 recap 分享作为显性状态，而不是隐藏后台动作。
- Zoom AI Companion 要求 host/co-host 在会中控件里显式开始/停止摘要，并在参与者侧显示 AI Companion 正在运行；Microsoft Teams 的转写也有开始、停止、权限和通知路径。Meeting Pilot 因此保持“用户主动从 popup 授权开始”的路径，并在开始失败时给出可见恢复步骤。
- OpenAI Whisper 和 whisper.cpp 的实践说明本地 ASR 适合做隐私友好的 final transcript fallback，但实时会议体验仍应把 live partial、final engine、模型下载和 fallback 状态拆开展示；浏览器 on-device speech 也仍是实验能力，需要保留显性降级。
- 隐私保护语音转写研究强调 speech 同时包含声纹和文本敏感信息，并建议给用户可调的隐私/可用性控制；Meeting Pilot 因此把 Local only、Auto fallback 和 cloud-only 区分为用户可见模式，而不是隐式上传音频。
- Zoom AI Companion 的会中 side panel 把会议问答、复制、发送到聊天、创建任务/文档放在同一上下文里；Teams Facilitator 则把实时 notes、agenda timer、open questions 和 follow-up tasks 放在会议期间/会后同一条协作路径中。Meeting Pilot 的 side panel 因此应减少重复 context，把“当前要看什么”和“下一步能做什么”分层呈现。
- Zoom 的会中问题预设包含 “Was my name mentioned?” / “What are the action items?”，Teams Facilitator 也会围绕 agenda timer、open questions 和 follow-up tasks 给出实时提示；Meeting Pilot 的会中提醒因此应优先保留点名、行动项、决策和强相关记忆，过滤纯上下文刷新、低置信或无解释线索的噪声提醒。
- CHI 2025 会中目标反思研究指出被动提示更不打断会议、主动介入更容易触发行动但有打扰风险；Meeting Pilot 的会中提醒因此在 side panel 给出原因和下一步，让用户自己决定是否立即处理，而不是自动推进外部动作。
- RingCentral 自身的 AI Meetings / AI Notes 也把 live recap、action items、transcripts 和 post-meeting notes 串在会议体验内；Meeting Pilot 的会议页入口因此需要保留低摩擦控制，不应让“隐藏/关闭入口”这种基础操作产生不确定状态。
- Teams live transcription、Zoom AI Companion 和第三方会议 AI Companion 都把启动/停止、参与者可见提示、转写状态或机器人状态作为显性状态；Meeting Pilot 的 Capture handoff 因此必须把真实授权/录制启动结果作为状态源，不能在 offscreen 启动失败后继续显示录制中。
- Teams live captions 明确区分实时字幕和可保存 transcript，Zoom automated captions 也把 host/admin 启用状态作为显性设置；Web Speech API 又不是所有主流浏览器都稳定可用。Meeting Pilot 因此把 Chrome On-Device 首条转写等待、fallback watchdog 和空 transcript 边界直接放进 Speech 面板，而不是只写日志。
- ASR confidence / correction 研究和 live caption stability 研究都提醒用户不能只看“有一个 ASR 层正在运行”，还要知道文本是否新鲜、是否稳定、是否需要改用其他链路。Meeting Pilot 的 ASR 回执因此优先展示最近结果、新鲜度、旧 transcript 边界和可恢复路径。
- AI meeting assistant governance 讨论强调 consent、transparency、accountability 和 audit 应进入系统设计；Meeting Pilot 的 Capture 路径因此优先暴露授权、阻断、降级、单场录制冲突和计时状态，而不是只在后台静默失败。
- CHI 2025 会中目标反思研究指出被动提示更不打断会议、主动介入更容易触发行动但有打扰风险；Meeting Pilot 的浮动入口和 Catch Up 因此保持轻量、可关闭、可恢复，而不是强制常驻。
- Otter 的 Meeting Summary 把 topics、action items、highlights、slides 放在同一封会后摘要里，说明行动项最好和会议材料/上下文并列呈现。
- Granola 的 AI-enhanced notes 支持回看增强笔记来自 transcript / raw notes 的依据，并允许用户编辑单次会议笔记；Meeting Pilot 的行动项 review 因此把证据、确认/忽略/完成状态和人工校正入口放在同一条任务上。
- Otter 的 Conversation / Summary 体验支持复制单条或全部 action items；Teams Facilitator 把 AI 会议笔记放到可编辑的 Loop 页面。Meeting Pilot 的行动项卡片因此需要保留低摩擦的“带依据复制”和“确认后跟进清单复制”能力，先满足会后跟进，再考虑写入外部任务系统。
- Otter 的行动项支持回看 transcript 位置，也支持手动新增、改名和分配；Granola 也强调每条增强笔记可追溯到 transcript / raw notes；Meeting Pilot 因此把行动项和时间线章节互链，并允许用户手动补充 AI 漏掉的跟进项。
- Teams Facilitator 的 follow-up tasks 需要用户接受后同步到 Planner，Zoom / Teams recap 也会把 action items、转写、共享材料和摘要状态显性放在 recap 里；Meeting Pilot 的行动项因此先走“待复核 → 补信息/确认/完成”的显性状态机，再考虑写入外部任务系统。
- Teams Facilitator 会检查会议议程、提示目标并管理议题时间；Meeting Pilot 的 Today Pilot handoff 因此不应只显示会前摘要，还要允许用户把关键问题/目标直接转成会中待处理行动项。
- Notion AI Meeting Notes 把 transcript citation 和 consent 放在会议笔记体验里；Meeting Pilot 的行动项也应持续保留依据、待分配/缺依据标记和用户确认路径，而不是把 AI 猜测当成正式任务。
- Read AI 的 meeting intelligence 强调跨会议检索 action items、decisions 和 transcript；Meeting Pilot 的会议归档因此要保持可检索结构化字段，同时避免把低置信泛泛承诺写成错误 owner。
- Zoom 的 transcript / meeting summary 体验和 Teams Intelligent recap 都把转写、录制、章节、任务、分享与权限/前置条件拆开呈现。因此 Meeting Pilot 的会议历史不能只显示“有/没有 PDF”，也不能只搜索最新卡片文本或第一页，而要把生成失败、缺失链接、不可用链接、归档转写可检索性、已显示数量、点击打开范围和可继续回看 Panorama 的路径一起露出。
- Otter 的会后摘要把 topic、action items、highlights 和 slides 并列到摘要邮件中；CSCW 2024 LLM meeting recap 研究也建议把层级 minutes、highlights、组织 artifact 和个性化上下文结合。会议归档页因此要让用户从搜索/状态筛选直接回到可复核的 Panorama，而不是要求用户先打开每个 PDF 试错。
- Teams Recap、Zoom meeting assets 与 Otter Summary 都把 recording/transcript/summary/action items 的可用性并列展示；会议历史页因此需要先告诉用户当前列表有多少会议还不是完整交付物，再让用户用状态筛选进入 Panorama 复核。
- 业内会议助手普遍把用户编辑后的 notes / tasks 视为会后协作材料的一部分；Meeting Pilot 因此需要把人工补录和 AI 识别的行动项放进同一条“可复核、可回看、可复制”的路径，而不是把人工记录降级成一次性备注。
- Zoom 的 summary template 和 Teams Intelligent recap 都把不同会议类型的后续动作、推荐任务、章节和录制/转写依赖放在 recap 里；Panorama 因此需要先暴露跟进清单是否可交付，再提供复制或外发入口。
- Teams recap 和 Zoom Summary 都把 recap 分享/管理作为明确动作；Panorama 因此把页面/PDF/录制复制做成可见反馈的链接动作，而不是静默调用剪贴板或把未实现的分享说成已发送。
- Teams Recap 把 recording、transcript、shared files、notes、agenda 和 follow-up tasks 放在同一个会后页，但是否分享、下载或创建任务仍是独立动作；Panorama 的输出范围回执因此把“可看/可复制/可下载”与“已发送/已同步/已创建外部任务”分开。
- Teams / Webex 这类 recap 页会把打开、下载、编辑、分享拆成独立动作；会议历史页也应在点击后留下轻量回执，避免用户把“打开了一个归档材料”理解成“已分享纪要、已生成 PDF 或已同步任务”。
- Action Item Detection 相关论文强调行动项依赖 local/global context；Meeting Pilot 因此不应只显示一句“任务”，而应保留 owner、deadline 和证据句。
- LLM-powered meeting recap 研究建议提供结构化 minutes 和 highlights 两种视图，并允许用户编辑/删除 AI recap；Meeting Pilot 当前先落地了行动项确认、忽略、完成和人工校正，后续再补编辑正文与导出到任务系统。
- Meetalk 等会议纪要研究强调从用户校正中学习并标记不确定内容；Meeting Pilot 当前优先把校正和确认行为保存在单次会议行动项上，后续可再用于个性化模板或质量反馈。

参考：

- [Zoom: Meeting Summary with AI Companion](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013)
- [Zoom: Asking in-meeting questions with AI Companion](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0057748)
- [Zoom: Accessing meeting transcripts for Meeting Summary with AI Companion](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0076632)
- [Microsoft: Facilitator in Teams meetings](https://support.microsoft.com/en-us/office/facilitator-in-microsoft-teams-meetings-37657f91-39b5-40eb-9421-45141e3ce9f6)
- [RingCentral: AI-powered Online Meetings](https://www.ringcentral.com/video.html)
- [Microsoft Teams: Intelligent recap](https://learn.microsoft.com/en-gb/microsoftteams/intelligent-recap-calls-meetings)
- [Granola: AI-enhanced notes](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes)
- [Otter: Meeting Summary Overview](https://help.otter.ai/hc/en-us/articles/9156381229079-Meeting-Summary-Overview)
- [Otter: Export Summary](https://help.otter.ai/hc/en-us/articles/39503855767191-Export-Summary)
- [Otter: Action Items Overview](https://help.otter.ai/hc/en-us/articles/25983095114519-Action-Items-Overview)
- [Notion: AI Meeting Notes](https://www.notion.com/help/ai-meeting-notes)
- [Read AI: Ada Meeting Intelligence & Preparation](https://support.read.ai/hc/en-us/articles/49437229480595-Ada-Meeting-Intelligence-Preparation)
- [arXiv: Meeting Action Item Detection with Regularized Context Modeling](https://arxiv.org/abs/2303.16763)
- [arXiv: Are We On Track? AI-Assisted Active and Passive Goal Reflection During Meetings](https://arxiv.org/abs/2504.01082)
- [Microsoft Research: Detecting Actionable Items in Meetings](https://www.microsoft.com/en-us/research/publication/detecting-actionable-items-in-meetings-by-convolutional-deep-structured-semantic-models-2/)
- [arXiv: Summaries, Highlights, and Action items](https://arxiv.org/abs/2307.15793)
- [OpenReview: Meetalk](https://openreview.net/forum?id=yVXsMxmfEh)
- [Sciety / Research Square: AI Meeting Assistants: Summarization, Autonomous Participation, and Governance](https://sciety.org/articles/activity/10.21203/rs.3.rs-9271994/v1)
- [OpenAI: Introducing Whisper](https://openai.com/index/whisper/)
- [Microsoft Teams: Use live captions](https://support.microsoft.com/en-us/teams/meetings/use-live-captions-in-microsoft-teams-meetings)
- [Microsoft Teams: Start, stop, and download live transcripts](https://support.microsoft.com/en-us/teams/meetings/start-stop-and-download-live-transcripts-in-microsoft-teams-meetings)
- [Zoom: Enabling or disabling automated captions](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058810)
- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [arXiv: Evaluating ASR Confidence Scores for Automated Error Detection](https://arxiv.org/abs/2503.15124)
- [Google Research: Modeling and improving text stability in live captions](https://research.google/blog/modeling-and-improving-text-stability-in-live-captions/)
- [ggml-org: whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- [MDN: SpeechRecognition processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally)
- [USENIX Security 2020: Prεεch](https://shimaaahmed.github.io/publication/1_preech/)

## 相关入口

- 页面内浮动入口（RingCentral meeting）
- popup `Meeting Pilot` 卡片
- side panel
- Live Map
- Panorama
- `memory-exploring.html#/meetings`

## 分层 ASR 架构（Layered ASR）

Meeting Pilot 支持三层 ASR provider，按优先级依次尝试：

```
Tier 1: RingCentral Transcript（页面已有转写时优先使用）
  ↓ 不可用时
Tier 2: Desktop Local ASR / Whisper fallback — macOS only
  ↓ 不可用时
Tier 3: Cloud ASR (Cloud) — 远程 `/v1/audio/transcriptions` 或 `chat/completions + input_audio`
```

### 转写模式（Transcription Mode）

在 Options → Meeting Pilot → Transcription Mode 中配置：

| 模式               | 说明                           |
| ------------------ | ------------------------------ |
| Auto (local first) | 优先本地，自动 fallback 到云端 |
| Local only         | 只用本地，不联网转写           |
| Cloud only         | 只用云端（需要配置 API Key）   |

### 层级徽章（Tier Badge）

会议 Speech 面板顶部显示当前转写层级：

| 徽章             | 含义                        |
| ---------------- | --------------------------- |
| 检测中           | 正在判断可用转写层级        |
| RC 转写          | RingCentral 内置转写        |
| 本机转写         | Chrome 139+ 本地 Web Speech（仅 Local only 实验兜底） |
| 本地 ASR         | Desktop App 本地 ASR；Whisper 可作为 final fallback |
| 云端 ASR         | 云端 ASR                    |
| 无转写           | 所有层级不可用              |

Speech 面板还会显示 `ASR 链路回执`；整张回执卡也带动态 hover / 读屏边界，先说明这是当前会议 session 的只读 ASR 快照，不会开始/停止 Capture、切换模式、额外上传音频、请求平台保存/下载 transcript、发送纪要或创建外部任务：

- `模式`：说明当前是自动、本地-only 还是云端-only。
- `当前层`：说明当前实际使用哪一层，以及最近一次切换时间。
- `探测路径`：用短链路展示本轮 ASR 已检查的层级，例如 `本地 ASR / Whisper 启动失败 → 云端 ASR 已选中`，让用户知道云端上传是 fallback 结果还是 cloud-only 选择。
- `上传边界`：说明当前是否会把音频片段发往云端 ASR。
- `平台转写`：当 RingCentral 页面已有 caption/transcript 并使 Local / Cloud ASR 跳过时，说明 Personal AI 只读取当前页面已经显示的文本；已读文本仍可进入本场实时摘要、行动项、时间线和归档草稿，但不会请求 RingCentral 保存/下载完整 transcript、发送通知、开启录制或额外上传音频。
- `实时状态`：说明当前是否有 live partial preview、只是在等待 final transcript、正在等首条浏览器转写、还是已经没有可用层级；final-only 本地 ASR 会明确说“没有 live preview 不等于本地 ASR 已坏”。
- `本地流状态`：只在 Local ASR chunk stream 连续失败但尚未 fatal fallback 时出现，显示重试进度、剩余失败次数、本机处理边界和继续失败后的切层后果。
- `云端接口`：当当前层级是 Cloud ASR 时，显示实际 endpoint 风格、模型、语言和单片上传限制；这个运行明细不会覆盖切层原因。
- `本地准备`：当 Local ASR / Whisper 不可用时，把 Desktop App 未连接、模型下载中、模型安装失败、live engine 已就绪但 final/Whisper 兜底未就绪、final engine 未就绪或 Whisper binary 未安装翻译成用户可读状态，并给出留在本地等待、去 Options 检查或临时切到 Auto / Cloud 的恢复路径。
- `最近结果`：说明最近 transcript 来自哪一层。
- `新鲜度`：如果 Chrome On-Device 已启动但还没有首条转写，会说明空 transcript 不等于会议无人发言，并标出超时 fallback；如果当前 ASR 层级仍显示运行、但最近真实 transcript 已超过 live-meeting 阈值未更新，会标记旧转写不代表当前仍在收到音频，并提示检查静音、语言设置、Desktop App 或云端网络。
- `切层说明 / 恢复动作`：说明 fallback 原因、Local ASR final-only 延迟、chunk stream 重试期间实时 preview 可能暂停但已有 final / 历史 transcript 保留，或无转写时下一步该检查什么。

### Desktop Local ASR / Whisper fallback 配置

1. 安装 Personal AI Desktop App
2. 首次使用 Auto / Local only 模式时由 Desktop App 准备本地 ASR 模型；live engine 负责低延迟 partial，FunASR 或 Whisper fallback 负责 final transcript
3. 在 Options → Desktop ASR 面板查看 live / final / Whisper fallback 状态；只要 final engine ready，即使 live engine 缺失也可以在静音或停止后产出转写；如果只有 live engine ready，Capture 前 readiness 和 Speech 面板都会说明本地实时引擎已就绪但 session 仍需 final transcript 兜底

**平台支持**：仅 macOS（Windows 用户自动 fallback 到云端）

### 故障排查

**No Transcription 徽章**：

- `cloud-only` 模式：检查 Options 中的 API Key 配置
- `local-only` 模式：安装 Personal AI Desktop App，或切换到 cloud/auto
- `auto` 模式：配置云端 API Key 或安装 Desktop App

**Local ASR / Whisper fallback 不可用**：

- 确认 Desktop App 正在运行（`http://127.0.0.1:46321/asr/status`）
- 在 Options → Desktop ASR 面板检查 live / final engine 与 Whisper fallback 状态

**ASR 层级显示运行但转写停住**：

- 先看 Speech 面板的 `新鲜度` 行：如果只剩旧 transcript，不要把它当成当前会议仍在转写的证明。
- 如果 Chrome On-Device 还没有首条转写，先看 watchdog 倒计时和 fallback 说明；空 transcript 可能是浏览器没有消费扩展/offscreen 音频轨，不等于会议无人发言。
- 如果 Local ASR 显示 `无实时预览 → Whisper/FunASR final`，先看 `实时状态`：这表示 live partial preview 缺失，但 final transcript 仍可能在静音、句末或停止后出现。
- 检查会议是否长时间静音、转写语言是否匹配；Local ASR 还要检查 Desktop App / 模型状态，Cloud ASR 还要检查 provider 网络和 API style / model 兼容性。

## 验证

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/actionItems.test.ts`
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/actionItemReview.test.ts`
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/asr/__tests__/orchestrator.test.ts`
- `npm run test:meeting-pilot`
- `npm run test:meeting-pilot-panorama`
- `node tools/verify-meeting-live-map-e2e.mjs`
- `npm run test:meeting-pilot-scene1`（含 Today Pilot 会前准备 cue 加入行动项）
- `npm --prefix desktop-app run test:meeting-pilot-scene2`
- `npm start` 首次 dev compile
- `git diff --check -- <Meeting Pilot changed files>`

当前 `npm run test:meeting-pilot-all` 会先跑 `meeting-pilot-build-check`；该脚本仍假设生产 sidepanel bundle 会通过 dead-code pruning 移除 `Capture Log` 字符串，但当前 production webpack 关闭了压缩，因此这个 full-all 验证会在 build-check 阶段失败，需要单独维护验证脚本或恢复生产剪枝策略。
