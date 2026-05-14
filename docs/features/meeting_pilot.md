# Meeting Pilot

_最后更新: 2026-05-14_

## 是什么

`Meeting Pilot` 是面向 `https://v.ringcentral.com/conf/on/:meetingId` 的 RingCentral Web 会议副驾。

它不是静默录制机器人，而是围绕一次会议提供三层能力：

1. **会中提醒（In-Meeting Alerts）**
   - 在页面内用低打扰方式提示你被点名、被 assign、话题变化、相关历史记忆等关键信息。
2. **会中主控面（Side Panel / Live Map）**
   - 用于查看当前话题、时间线、行动项、摘要状态与配置状态。
3. **会后复盘（Panorama）**
   - 查看归档后的会议摘要、时间线、行动项、决议、参会者立场，以及 PDF 会议纪要状态。

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
  - Digest / PDF 状态
  - 摘要
  - 结构化数量（话题 / 行动项 / 决议）
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
- Side Panel 每条行动项支持回跳到同章时间线证据；点击 `时间线` 后会切到时间线 tab、展开并高亮最相关的 action / chapter 事件，便于从任务回看会议上下文。
- Side Panel 的 Live 卡片和页脚会在 Capture 未开启时提供 `查看开启步骤`，直接在会议页打开扩展 icon / popup 授权 coachmark，避免用户只看到静态说明。
- Side Panel 的实时页会在存在待复核或处理中行动项时显示 `Action Review` 卡片，直接跳到行动项复核筛选，避免用户只看实时提醒而漏掉会后跟进。
- Side Panel 行动项工具栏支持一键确认当前筛选中信息完整的待复核项；未复核项的完成按钮会显示为 `确认并完成`，避免用户无意绕过 AI 建议复核。
- Side Panel 会在行动项卡片、实时页下一项提示和复制文本里标出 `补负责人` / `补截止` / `缺依据`，提醒用户在把 AI 建议流入外部任务系统前补齐关键信息。
- Side Panel 行动项增加 `需补信息` 筛选；批量确认只处理当前筛选里已具备负责人、截止和依据的待复核项，缺信息项仍可单条确认，作为用户明确接受的例外路径。
- 被忽略的行动项不会进入会议记忆 recap 的主行动项列表，但仍会保留在 session 的完整结构化数据里，方便排查 AI 误判。
- LLM 结构化分析 prompt 要求输出 `actionItems.evidence`，启发式路径会把触发行动项的 transcript 句子写入 `evidence`。
- 启发式行动项需要明确 owner / 第一人称承诺 / 显式行动项标签之一才会生成；owner 不明确的显式行动项会以待分配状态进入复核，而不是直接绑定到发言人。
- LLM 返回的行动项 / 决议会补齐当前 chapterId，避免时间线展开时找不到同章行动项。
- 实时分析刷新时优先保留当前识别到的行动项；已确认/已忽略的旧项只在容量有余时继续保留，避免旧复核记录挤掉新任务。
- 从会议历史归档打开 Panorama 时，会保留行动项的 evidence、timestamp、source、chapterId 和 review 状态。

## 行业与论文参考方向

- Zoom AI Companion 和 Teams Intelligent recap 都把会议 AI 的启动/停止、转写质量、会后 recap 分享作为显性状态，而不是隐藏后台动作。
- Otter 的 Meeting Summary 把 topics、action items、highlights、slides 放在同一封会后摘要里，说明行动项最好和会议材料/上下文并列呈现。
- Granola 的 AI-enhanced notes 支持回看增强笔记来自 transcript / raw notes 的依据，并允许用户编辑单次会议笔记；Meeting Pilot 的行动项 review 因此把证据、确认/忽略/完成状态和人工校正入口放在同一条任务上。
- Otter 的 Conversation / Summary 体验支持复制单条或全部 action items；Teams Facilitator 把 AI 会议笔记放到可编辑的 Loop 页面。Meeting Pilot 的行动项卡片因此需要保留低摩擦的“带依据复制”和“确认后跟进清单复制”能力，先满足会后跟进，再考虑写入外部任务系统。
- Otter 的行动项支持回看 transcript 位置，也支持手动新增、改名和分配；Granola 也强调每条增强笔记可追溯到 transcript / raw notes；Meeting Pilot 因此把行动项和时间线章节互链，并允许用户手动补充 AI 漏掉的跟进项。
- Teams Facilitator 的 follow-up tasks 需要用户接受后同步到 Planner，Zoom / Teams recap 也会把 action items、转写、共享材料和摘要状态显性放在 recap 里；Meeting Pilot 的行动项因此先走“待复核 → 补信息/确认/完成”的显性状态机，再考虑写入外部任务系统。
- Notion AI Meeting Notes 把 transcript citation 和 consent 放在会议笔记体验里；Meeting Pilot 的行动项也应持续保留依据、待分配/缺依据标记和用户确认路径，而不是把 AI 猜测当成正式任务。
- Read AI 的 meeting intelligence 强调跨会议检索 action items、decisions 和 transcript；Meeting Pilot 的会议归档因此要保持可检索结构化字段，同时避免把低置信泛泛承诺写成错误 owner。
- 业内会议助手普遍把用户编辑后的 notes / tasks 视为会后协作材料的一部分；Meeting Pilot 因此需要把人工补录和 AI 识别的行动项放进同一条“可复核、可回看、可复制”的路径，而不是把人工记录降级成一次性备注。
- Action Item Detection 相关论文强调行动项依赖 local/global context；Meeting Pilot 因此不应只显示一句“任务”，而应保留 owner、deadline 和证据句。
- LLM-powered meeting recap 研究建议提供结构化 minutes 和 highlights 两种视图，并允许用户编辑/删除 AI recap；Meeting Pilot 当前先落地了行动项确认、忽略、完成和人工校正，后续再补编辑正文与导出到任务系统。
- Meetalk 等会议纪要研究强调从用户校正中学习并标记不确定内容；Meeting Pilot 当前优先把校正和确认行为保存在单次会议行动项上，后续可再用于个性化模板或质量反馈。

参考：

- [Zoom: Meeting Summary with AI Companion](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013)
- [Microsoft Teams: Intelligent recap](https://learn.microsoft.com/en-gb/microsoftteams/intelligent-recap-calls-meetings)
- [Granola: AI-enhanced notes](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes)
- [Otter: Meeting Summary Overview](https://help.otter.ai/hc/en-us/articles/9156381229079-Meeting-Summary-Overview)
- [Otter: Export Summary](https://help.otter.ai/hc/en-us/articles/39503855767191-Export-Summary)
- [Otter: Action Items Overview](https://help.otter.ai/hc/en-us/articles/25983095114519-Action-Items-Overview)
- [Notion: AI Meeting Notes](https://www.notion.com/help/ai-meeting-notes)
- [Read AI: Ada Meeting Intelligence & Preparation](https://support.read.ai/hc/en-us/articles/49437229480595-Ada-Meeting-Intelligence-Preparation)
- [arXiv: Meeting Action Item Detection with Regularized Context Modeling](https://arxiv.org/abs/2303.16763)
- [Microsoft Research: Detecting Actionable Items in Meetings](https://www.microsoft.com/en-us/research/publication/detecting-actionable-items-in-meetings-by-convolutional-deep-structured-semantic-models-2/)
- [arXiv: Summaries, Highlights, and Action items](https://arxiv.org/abs/2307.15793)
- [OpenReview: Meetalk](https://openreview.net/forum?id=yVXsMxmfEh)

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
Tier 1: Chrome on-device Web Speech (On-Device)
  ↓ 不可用时
Tier 2: Desktop Local Whisper (Local Whisper) — macOS only
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
| On-Device        | Chrome 139+ 本地 Web Speech |
| Local Whisper    | Desktop App 本地 Whisper    |
| Cloud            | 云端 ASR                    |
| No Transcription | 所有层级不可用              |

### Desktop Local Whisper 配置

1. 安装 Personal AI Desktop App
2. 首次使用 Auto 模式时自动下载 multilingual `ggml-base` 模型（~148MB），支持中英文自动识别
3. 在 Options → Desktop ASR 面板查看下载状态

**平台支持**：仅 macOS（Windows 用户自动 fallback 到云端）

### 故障排查

**No Transcription 徽章**：

- `cloud-only` 模式：检查 Options 中的 API Key 配置
- `local-only` 模式：安装 Personal AI Desktop App，或切换到 cloud/auto
- `auto` 模式：配置云端 API Key 或安装 Desktop App

**Local Whisper 不可用**：

- 确认 Desktop App 正在运行（`http://127.0.0.1:46321/whisper/status`）
- 在 Options → Desktop ASR 面板检查模型下载状态

## 验证

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/actionItems.test.ts`
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/actionItemReview.test.ts`
- `npm run test:meeting-pilot`
- `npm run test:meeting-pilot-scene1`
- `npm --prefix desktop-app run test:meeting-pilot-scene2`
- `npm start` 首次 dev compile
- `git diff --check -- <Meeting Pilot changed files>`

当前 `npm run test:meeting-pilot-all` 会先跑 `meeting-pilot-build-check`；该脚本仍假设生产 sidepanel bundle 会通过 dead-code pruning 移除 `Capture Log` 字符串，但当前 production webpack 关闭了压缩，因此这个 full-all 验证会在 build-check 阶段失败，需要单独维护验证脚本或恢复生产剪枝策略。
