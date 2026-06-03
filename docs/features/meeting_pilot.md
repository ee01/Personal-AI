# Meeting Pilot

_最后更新: 2026-06-01_

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
5. 会议结束归档：停止 capture 后的摘要、行动项、Panorama 依赖已收集转写和事件是否完整。

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
  - `语音`
  - `时间线`
  - `行动项`
  - `设置`

### 4. 停止录制与会后结果

- 停止录制后：
  1. 录制视频上传到 `POST /api/v2/upload/video`
  2. 请求 `POST /api/v3/generate_digest`
  3. background 持续轮询 `GET /api/v3/digest/{id}`
- 同时，会议结构化数据会**在停止录制时立即写入 memory-service**，不等待 PDF 完成。
- PDF 就绪后，后台会补全 meeting record 中的 `pdfUrl`。

## 主要能力

### 会中提醒

- P0 / P1 / P2 分层提醒
- 记忆关联以 P2 弹幕 + side panel feed 形式出现
- hover 参会者头像可查看 stance / key quote

### 会中面板

- 当前话题
- Catch Up 轻量快照
- Today Pilot / Context Assist 会前准备 handoff（目标、问题、Rehearsal 预演提醒、证据来源）
- 时间线（支持展开详情）
- 行动项列表（owner / deadline / transcript 依据）
- readiness 状态

### 会后 Panorama

- 会议摘要
- 时间线
- 行动项（保留 owner、deadline、识别时间和原始依据句，方便复核 AI 是否误判）
- 决议
- 参会者发言分布
- 参会者立场与态度
- PDF 纪要区块与状态
- 从历史归档重新打开

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
- 可以按标题、摘要、参会者、会议 ID 或归档转写/观察文本搜索，并按可打开 / 需处理 / 生成中 / 仅归档筛选；筛选在会议归档 API 层先执行，再分页展示，避免只搜索当前第一页或只搜索卡片可见字段。
- 可直接打开 Panorama 或 PDF

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
- 人工新增行动项的时间线锚点会在后续实时分析刷新后继续保留；用户修改标题、负责人或截止时间后，回跳时间线仍会定位到同一条人工记录，避免补录任务失去上下文依据。
- Today Pilot / Context Assist 带入的会前准备问题或目标可以在实时页一键加入行动项；系统会默认归给自己、截止标记为本次会议、保留会前证据，并按当前会议去重，避免用户会中手动抄写准备事项。
- RingCentral Video Home 的 Today Pilot 卡片初始只读取预生成 meeting prep；用户点击刷新时会先为当前日期 backfill meeting prep，再把缓存结果写入 Meeting Pilot handoff，避免缺少 nightly 预生成缓存时会中面板拿不到准备内容。
- Side Panel 每条行动项支持回跳到同章时间线证据；点击 `时间线` 后会切到时间线 tab、展开并高亮最相关的 action / chapter 事件，便于从任务回看会议上下文。
- Side Panel 的 Live 卡片和页脚会在 Capture 未开启时提供 `查看开启步骤`，直接在会议页打开扩展 icon / popup 授权 coachmark，避免用户只看到静态说明。
- 会议页浮动入口支持当前页面临时隐藏或保存为“永不展示”；保存成功后当前会议页会立即隐藏入口，之后可在 Options 的 Meeting Pilot 配置里重新打开，避免入口关闭像失败一样停留在页面上。
- popup 开始 Capture 失败时会直接展示阻断原因、已有录制冲突或授权失败的下一步；配置阻断时可从提示里直达 Meeting Pilot 配置页。
- offscreen 实际启动 tab capture / MediaRecorder 失败时，background 会保持 `capture.kind='error'` 并保留真实错误，不会再把失败会话覆盖成 `recording` 或打开成功态面板。
- Capture 停止后重新开始会重置本次 `startedAt` 并清空旧 `stoppedAt`，避免 REC 计时、归档时长和会后记录沿用上一段录制时间。
- Side Panel 的实时页会在存在待复核或处理中行动项时显示 `Action Review` 卡片，直接跳到行动项复核筛选，避免用户只看实时提醒而漏掉会后跟进。
- Side Panel 行动项工具栏支持一键确认当前筛选中信息完整的待复核项；未复核项的完成按钮会显示为 `确认并完成`，避免用户无意绕过 AI 建议复核。
- Side Panel 会在行动项卡片、实时页下一项提示和复制文本里标出 `补负责人` / `补截止` / `缺依据`，提醒用户在把 AI 建议流入外部任务系统前补齐关键信息。
- Side Panel 行动项增加 `需补信息` 筛选；批量确认只处理当前筛选里已具备负责人、截止和依据的待复核项，缺信息项仍可单条确认，作为用户明确接受的例外路径。
- 缺负责人、截止或依据的待复核项在单条确认/完成时会显示 `确认例外` / `确认例外并完成`，避免用户把低置信 AI 建议误当成已完整复核的正式任务。
- Side Panel 实时页会把本轮最重要的关联记忆提升到顶部 `会中关联记忆` 卡片；如果命中 `type='rehearsal'`，文案显示为“预演提醒”，并解释参会人、会议、项目或 issue 等命中线索。只有未来会议场景和预演内容都清楚时才按 Rehearsal 展示；单纯事实、状态或弱联想仍按普通记忆/Reflection/Dream 处理。这些已提升的记忆不会再重复进入下方提醒 feed；会议页记忆弹幕和 side panel feed 都会过滤 `displayPriority: hidden` 或无解释价值的记忆，并且记忆弹幕只暴露安全的记忆库/来源链接，避免同一条 context 在会中主控面重复或不安全地打扰用户。
- 行动项更新会同时校验 `tabId` 和 `meetingId`；如果会议标签页已经切换到另一场会议，旧 side panel / 独立窗口不能继续改写新会议的行动项。
- 被忽略的行动项不会进入会议记忆 recap 的主行动项列表，但仍会保留在 session 的完整结构化数据里，方便排查 AI 误判。
- LLM 结构化分析 prompt 要求输出 `actionItems.evidence`，启发式路径会把触发行动项的 transcript 句子写入 `evidence`。
- 启发式行动项需要明确 owner / 第一人称承诺 / 显式行动项标签之一才会生成；owner 不明确的显式行动项会以待分配状态进入复核，而不是直接绑定到发言人。
- LLM 返回的行动项 / 决议会补齐当前 chapterId，避免时间线展开时找不到同章行动项。
- 实时分析刷新时优先保留当前识别到的行动项；已确认/已忽略的旧项只在容量有余时继续保留，避免旧复核记录挤掉新任务。
- Local ASR session 启动后如果 desktop app chunk stream 连续失败，provider 会把它升级为 fatal ASR 错误并触发下一层 fallback；TierBadge tooltip / toast 和 capture log 会保留本次降级原因，避免用户看到“本地 ASR 运行中”但一直没有 transcript。
- 从会议历史归档打开 Panorama 时，会保留行动项的 evidence、timestamp、source、chapterId 和 review 状态。
- 会议历史归档会透出 Digest 的真实状态和错误码：PDF 生成失败、完成但 URL 缺失、或 PDF 链接不是安全 http(s) 地址时，不再显示成“等待 PDF”，并且不会把不安全链接带入 Panorama 或打开动作。
- 会议历史归档会显示已加载数量和总数，超过 50 条时提供 `加载更早会议`；加载第二页失败时保留当前列表并显示可重试错误，避免用户误以为历史归档只有第一页。
- 会议历史归档支持关键词和状态筛选；关键词会覆盖标题、摘要、参会者、会议 ID、错误码以及同一会议下归档的转写/观察文本。`ready` 表示有安全 PDF 或 Digest 完成，`attention` 表示 Digest/PDF 失败、缺失或链接不可安全打开，`processing` 表示 Digest 仍在生成，`archived` 表示只有基础归档记录。
- Panorama 会单独展示 `会后跟进状态`：区分可直接跟进、待复核、需补信息和已完成行动项，并支持复制带负责人、截止、状态和依据的 Markdown 跟进清单，避免用户把未复核或缺依据的 AI 行动项直接外发。
- Panorama 顶部 `回放录制` 只在当前会议有真实录制素材 URL 时启用；只有 PDF 的归档会议会继续使用 `会议纪要 PDF` 入口，避免把 PDF 打开误导成录制回放。`复制页面链接`、PDF 链接和录制链接都会走同一套复制 fallback，并给出可见成功/失败反馈。

## 行业与论文参考方向

- Zoom AI Companion 和 Teams Intelligent recap 都把会议 AI 的启动/停止、转写质量、会后 recap 分享作为显性状态，而不是隐藏后台动作。
- Zoom AI Companion 要求 host/co-host 在会中控件里显式开始/停止摘要，并在参与者侧显示 AI Companion 正在运行；Microsoft Teams 的转写也有开始、停止、权限和通知路径。Meeting Pilot 因此保持“用户主动从 popup 授权开始”的路径，并在开始失败时给出可见恢复步骤。
- OpenAI Whisper 和 whisper.cpp 的实践说明本地 ASR 适合做隐私友好的 final transcript fallback，但实时会议体验仍应把 live partial、final engine、模型下载和 fallback 状态拆开展示；浏览器 on-device speech 也仍是实验能力，需要保留显性降级。
- 隐私保护语音转写研究强调 speech 同时包含声纹和文本敏感信息，并建议给用户可调的隐私/可用性控制；Meeting Pilot 因此把 Local only、Auto fallback 和 cloud-only 区分为用户可见模式，而不是隐式上传音频。
- Zoom AI Companion 的会中 side panel 把会议问答、复制、发送到聊天、创建任务/文档放在同一上下文里；Teams Facilitator 则把实时 notes、agenda timer、open questions 和 follow-up tasks 放在会议期间/会后同一条协作路径中。Meeting Pilot 的 side panel 因此应减少重复 context，把“当前要看什么”和“下一步能做什么”分层呈现。
- Zoom 的会中问题预设包含 “Was my name mentioned?” / “What are the action items?”，Teams Facilitator 也会围绕 agenda timer、open questions 和 follow-up tasks 给出实时提示；Meeting Pilot 的会中提醒因此应优先保留点名、行动项、决策和强相关记忆，过滤纯上下文刷新、低置信或无解释线索的噪声提醒。
- RingCentral 自身的 AI Meetings / AI Notes 也把 live recap、action items、transcripts 和 post-meeting notes 串在会议体验内；Meeting Pilot 的会议页入口因此需要保留低摩擦控制，不应让“隐藏/关闭入口”这种基础操作产生不确定状态。
- Teams live transcription、Zoom AI Companion 和第三方会议 AI Companion 都把启动/停止、参与者可见提示、转写状态或机器人状态作为显性状态；Meeting Pilot 的 Capture handoff 因此必须把真实授权/录制启动结果作为状态源，不能在 offscreen 启动失败后继续显示录制中。
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
- Zoom 的 transcript 管理支持按状态、日期、meeting ID、topic 或关键词找回历史；Teams Intelligent recap 也明确列出转写、录制、章节和任务的前置条件/跳过情况。因此 Meeting Pilot 的会议历史不能只显示“有/没有 PDF”，也不能只搜索最新卡片文本或第一页，而要把生成失败、缺失链接、不可用链接、归档转写可检索性、已显示数量和可继续回看 Panorama 的路径一起露出。
- Otter 的会后摘要把 topic、action items、highlights 和 slides 并列到摘要邮件中；CSCW 2024 LLM meeting recap 研究也建议把层级 minutes、highlights、组织 artifact 和个性化上下文结合。会议归档页因此要让用户从搜索/状态筛选直接回到可复核的 Panorama，而不是要求用户先打开每个 PDF 试错。
- 业内会议助手普遍把用户编辑后的 notes / tasks 视为会后协作材料的一部分；Meeting Pilot 因此需要把人工补录和 AI 识别的行动项放进同一条“可复核、可回看、可复制”的路径，而不是把人工记录降级成一次性备注。
- Zoom 的 summary template 和 Teams Intelligent recap 都把不同会议类型的后续动作、推荐任务、章节和录制/转写依赖放在 recap 里；Panorama 因此需要先暴露跟进清单是否可交付，再提供复制或外发入口。
- Teams recap 和 Zoom Summary 都把 recap 分享/管理作为明确动作；Panorama 因此把页面/PDF/录制复制做成可见反馈的链接动作，而不是静默调用剪贴板或把未实现的分享说成已发送。
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
Tier 3: Cloud ASR (Cloud) — 现有远程 /v1/audio/transcriptions
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

### Desktop Local ASR / Whisper fallback 配置

1. 安装 Personal AI Desktop App
2. 首次使用 Auto / Local only 模式时由 Desktop App 准备本地 ASR 模型；live engine 负责低延迟 partial，FunASR 或 Whisper fallback 负责 final transcript
3. 在 Options → Desktop ASR 面板查看 live / final / Whisper fallback 状态；只要 final engine ready，即使 live engine 缺失也可以在静音或停止后产出转写

**平台支持**：仅 macOS（Windows 用户自动 fallback 到云端）

### 故障排查

**No Transcription 徽章**：

- `cloud-only` 模式：检查 Options 中的 API Key 配置
- `local-only` 模式：安装 Personal AI Desktop App，或切换到 cloud/auto
- `auto` 模式：配置云端 API Key 或安装 Desktop App

**Local ASR / Whisper fallback 不可用**：

- 确认 Desktop App 正在运行（`http://127.0.0.1:46321/asr/status`）
- 在 Options → Desktop ASR 面板检查 live / final engine 与 Whisper fallback 状态

## 验证

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/actionItems.test.ts`
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/actionItemReview.test.ts`
- `npm run test:meeting-pilot`
- `npm run test:meeting-pilot-scene1`（含 Today Pilot 会前准备 cue 加入行动项）
- `npm --prefix desktop-app run test:meeting-pilot-scene2`
- `npm start` 首次 dev compile
- `git diff --check -- <Meeting Pilot changed files>`

当前 `npm run test:meeting-pilot-all` 会先跑 `meeting-pilot-build-check`；该脚本仍假设生产 sidepanel bundle 会通过 dead-code pruning 移除 `Capture Log` 字符串，但当前 production webpack 关闭了压缩，因此这个 full-all 验证会在 build-check 阶段失败，需要单独维护验证脚本或恢复生产剪枝策略。
