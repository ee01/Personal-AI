# Meeting Pilot

_最后更新: 2026-05-07_

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
- LLM 行动项和启发式行动项都会尽量保留 transcript 依据，但仍需要用户复核后再当作正式任务。

## 当前实现补充

- 行动项抽取已从 background 主链路拆到 `src/meeting-shell/actionItems.ts`，便于单测覆盖中英文 owner / deadline / evidence。
- Side Panel、Live Map、Panorama 都会展示行动项依据；时间线展开后也能看到同一章节行动项的证据句。
- Side Panel 行动项支持 `待复核 → 已确认 / 已忽略 / 已完成` 的轻量 review 流程，并提供 `处理中 / 待复核 / 已确认 / 已完成 / 已忽略 / 全部` 筛选；用户确认、忽略或完成后的状态会在实时分析刷新后保留。
- 行动项 review 状态只会按稳定身份（owner / title / deadline）继承，避免实时分析刷新后把同一列表下标的新行动项误标为已忽略或已完成。
- Side Panel 每条行动项支持一键复制结构化文本（行动项、负责人、截止、识别时间、状态和依据），也支持按当前筛选批量复制，方便快速贴到聊天、任务系统或会后纪要里。
- Side Panel 每条行动项支持人工校正标题、负责人和截止时间；保存后会自动进入已确认状态，并在后续实时分析刷新时按 AI 原始身份继续继承，避免用户修正被新一轮结构化分析覆盖。
- 被忽略的行动项不会进入会议记忆 recap 的主行动项列表，但仍会保留在 session 的完整结构化数据里，方便排查 AI 误判。
- LLM 结构化分析 prompt 要求输出 `actionItems.evidence`，启发式路径会把触发行动项的 transcript 句子写入 `evidence`。
- LLM 返回的行动项 / 决议会补齐当前 chapterId，避免时间线展开时找不到同章行动项。
- 实时分析刷新时优先保留当前识别到的行动项；已确认/已忽略的旧项只在容量有余时继续保留，避免旧复核记录挤掉新任务。
- 从会议历史归档打开 Panorama 时，会保留行动项的 evidence、timestamp、source、chapterId 和 review 状态。

## 行业与论文参考方向

- Zoom AI Companion 和 Teams Intelligent recap 都把会议 AI 的启动/停止、转写质量、会后 recap 分享作为显性状态，而不是隐藏后台动作。
- Otter 的 Meeting Summary 把 topics、action items、highlights、slides 放在同一封会后摘要里，说明行动项最好和会议材料/上下文并列呈现。
- Granola 的 AI-enhanced notes 支持回看增强笔记来自 transcript / raw notes 的依据，并允许用户编辑单次会议笔记；Meeting Pilot 的行动项 review 因此把证据、确认/忽略/完成状态和人工校正入口放在同一条任务上。
- Otter 的 Conversation / Summary 体验支持复制单条或全部 action items；Teams Facilitator 把 AI 会议笔记放到可编辑的 Loop 页面。Meeting Pilot 的行动项卡片因此需要保留低摩擦的“带依据复制”能力，先满足会后跟进，再考虑写入外部任务系统。
- Action Item Detection 相关论文强调行动项依赖 local/global context；Meeting Pilot 因此不应只显示一句“任务”，而应保留 owner、deadline 和证据句。
- LLM-powered meeting recap 研究建议提供结构化 minutes 和 highlights 两种视图，并允许用户编辑/删除 AI recap；Meeting Pilot 当前先落地了行动项确认、忽略、完成和人工校正，后续再补编辑正文与导出到任务系统。

参考：

- [Zoom: Meeting Summary with AI Companion](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013)
- [Microsoft Teams: Intelligent recap](https://learn.microsoft.com/en-gb/microsoftteams/intelligent-recap-calls-meetings)
- [Granola: AI-enhanced notes](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes)
- [Otter: Meeting Summary Overview](https://help.otter.ai/hc/en-us/articles/9156381229079-Meeting-Summary-Overview)
- [Otter: Export Summary](https://help.otter.ai/hc/en-us/articles/39503855767191-Export-Summary)
- [arXiv: Meeting Action Item Detection with Regularized Context Modeling](https://arxiv.org/abs/2303.16763)
- [Microsoft Research: Detecting Actionable Items in Meetings](https://www.microsoft.com/en-us/research/publication/detecting-actionable-items-in-meetings-by-convolutional-deep-structured-semantic-models-2/)
- [arXiv: Summaries, Highlights, and Action items](https://arxiv.org/abs/2307.15793)

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
