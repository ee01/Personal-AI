# Meeting Pilot v1 Plan

## Product Summary

- 产品名统一为 `Meeting Pilot`。
- 目标场景是 `https://v.ringcentral.com/conf/on/:meetingId` 的 RingCentral Web 会议。
- v1 的核心不是"静默录制机器人"，而是三层体验：
  - `In-Meeting Alerts`：低打扰但强触达的会中提醒
  - `Live Meeting Map`：用户主动打开的会议全貌视图
  - `Post-Meeting Panorama`：会后 digest 结果页
- Chrome Extension 的边界保持明确：
  - 自动检测会议页可做
  - 纯扩展静默自动开始录制不可做
  - v1 核心动线是：注入 Idle 界面 -> 用户主动点击「授权 Capture」获取录像权限 -> 切换为 Active 会中状态

## Implementation Status

### 已落地的 v1 骨架

- `manifest / webpack / popup / background` 已接入 `Meeting Pilot`
- 新增 `RingCentral meeting content script`
- 新增 `Meeting Pilot side panel`
- 新增 `Meeting Pilot live map`
- 新增 `Meeting Pilot offscreen capture page`
- 新增 `meeting-shell` 运行时 registry，用于同步：
  - meeting 检测
  - share/speaker 状态
  - capture 状态
  - digest 状态
- popup 已新增 `Meeting Pilot` 卡片
- memory-service 已补 `meeting` sourceType

### 当前 v1 仍属于骨架+主链路版本

- 已有主链路：
  - 会议检测
  - side panel / live map 入口
  - offscreen `MediaRecorder`
  - 停止录制后：
    - `POST /api/v2/upload/video`
    - `POST /api/v3/generate_digest`
    - 轮询 `GET /api/v3/digest/{id}`
- 仍为第一版骨架的能力：
  - 实时转写 `whisper-1` 还没有完整接入录制链路
  - 视觉 observation 还没有接入远端 vision model
  - 记忆联动还没有接入真实 recall 结果，只保留了架构位置
  - active speaker 仍是 DOM-first best effort，不承诺精确实名 diarization

### Demo 已实现 (HTML 原型)

- `docs/demo/meeting-danmaku-alerts.html`：
  - 弹幕/P0 居中提醒/侧边栏完整交互原型
  - **已新增**：时间线 tab 支持点击展开详情（描述、发言人、行动项、截图占位）
  - **已新增**：hover 视频头像展示参会者对各话题的立场/态度/关键发言
  - **已新增**：记忆关联以紫色 P2 弹幕混入实时 feed，带可点击链接，hover 暂停
  - **已新增**：侧边栏 Alert Feed 中以「记忆」标签展示记忆关联（含超链接）
  - **已新增**：设置 tab 弹幕速度控制（快/中/慢），存储 envConfig 下次生效
  - **已新增**：设置 tab Provider API Key 字段、Minutes API URL 字段
  - 设置 tab、行动项 tab、Debug tab (?debug=1)
- `docs/demo/meeting-panorama-view.html`：
  - 会后全景结果页完整原型
  - **已新增**：侧边栏「立场与态度」区块，每个参会者按话题展示立场、关键引言、时间段
  - **已新增**：Meeting Minutes PDF 预览区块（含下载/新窗口打开/预览按钮）
  - **已新增**：顶栏「📄 会议纪要 PDF」快捷按钮，点击滚动到 PDF 区块

## Architecture

### Extension Runtime

- `contentScriptRingCentralMeeting`
  - 识别 meeting URL
  - 读取 DOM 信号
  - 注入页内双状态浮动入口（Idle 状态显式展示授权/开启 Capture 按钮，Active 状态展示统计/收集中光效）
  - 打开 side panel
- `background`
  - 持有 session registry
  - 管理 badge / title / side panel
  - 管理 offscreen capture 生命周期
  - 同步 digest 状态
- `meeting-offscreen`
  - 持有 `MediaRecorder`
  - 录制 `webm`
  - 停止后上传视频并发起 digest

### Pages

- `meeting-sidepanel.html`
  - 会中主控制面
  - 当前已支持：
    - 实时 (Catch Up modal 入口)
    - 时间线
    - 行动项
    - 设置
    - Debug (仅开发模式显示，监控 capture 数据流)
- `meeting-offscreen.html`
  - 隐藏页
  - 承载 `MediaRecorder`

## Detection Strategy

### In Meeting

- 主信号：URL 命中 `/conf/on/:meetingId`
- 辅信号：
  - `Leave meeting`
  - `Participants`
  - `Chat`
  - `Notes`

### Share State

- DOM-first
- 关键元素：
  - `#screen-sharing-panel`
  - `section#screensharing`
  - `video.screencast`
- 文本兜底：
  - `Waiting for ...'s screen`
  - `is sharing`
  - `Shared application was minimized`

### Sharer Identity

- 优先读 share panel 文本
- 读不到则降级为 `unknown participant`

### Self Sharing

- 优先用本地 share 操作状态
- 再结合 DOM 中 `(You)` 或 `your screen`
- 否则标记为 `unknown`

### Speaker Identity

- v1 不做实时纯音频实名 diarization
- 优先：
  - RingCentral DOM speaker highlight
  - captions / AI notes speaker label
- 失败时降级为 `unknown participant`

---

## Whisper Integration (详细)

### 核心作用

- **主要**：实时语音转文字 (speech-to-text)，产出带时间戳的 transcript
- **次要用途**：
  - transcript 是后续所有智能功能的基础输入（话题检测、行动项提取、立场分析、记忆关联）
  - 配合 speaker diarization 信号，实现「谁说了什么」的结构化数据
  - 为 Catch Up / 实时摘要 提供文本来源
- **不做**：whisper 本身不做语气/情绪分析，它只负责 transcript

### 架构设计

- **直连，不经过 memory-service**。理由：会中低延迟优先，5s chunk 需要 <2s 返回
- 链路：`meetingOffscreen` → 5~10s 滑动窗口 chunk → FormData → `MEETING_PROVIDER_BASE_URL/v1/audio/transcriptions`
- `MEETING_PROVIDER_BASE_URL` 是 OpenAI-compatible endpoint（可以是 OpenAI 官方、self-hosted whisper、Groq whisper 等）

### 用户配置

- 用户需要在 `options.tsx` / side panel 设置中填写：
  - `MEETING_PROVIDER_BASE_URL`：OpenAI-compatible 的转写服务地址
  - `MEETING_PROVIDER_API_KEY`：对应的 API Key
  - `MEETING_TRANSCRIBE_MODEL`：模型名，默认 `whisper-1`
- 这组配置独立于现有的 LLM 设置（`OPENAI_API_KEY` 等），因为转写服务和 LLM 可能用不同的 provider

### 降级策略

1. **Whisper API 不可用**：自动降级为「仅录屏不转写」，结束录制后交由 V3 Digest 处理全量
2. **浏览器 Web Speech API fallback**：
   - 如果用户未配置 whisper provider，可尝试 `SpeechRecognition` (Web Speech API) 作为零成本降级
   - 限制：仅 Chrome 支持、精度较低、不支持中文方言混合、无法拿到 word-level timestamp
   - 标记为 `low_confidence_transcript`，不参与精细分析（如立场判断），仅用于粗粒度话题检测
   - **已决策 ✅**：实现 Web Speech API fallback。零成本降级，标记为 `low_confidence_transcript`

---

## Realtime Intelligence Plan

### Visual Observation

- v1 不在浏览器本地跑重型多模态模型
- 本地只做：
  - 抽帧
  - 变更检测
  - 质量筛选
- 远端 vision model 负责把关键帧转成 `structured observation text`

### Memory Join

- 不使用 transcript-only
- recall 输入应为：
  - `recent transcript summary`
  - `latest stable visual observation`
  - `meeting metadata`
- 当前代码里已给出接入位置，但真实 recall 还未完全接上

### 语气/情绪分析

- **当前能力**：v1 不具备原生语气分析。whisper 只输出文本，不输出 tone/emotion metadata
- **可行路径**：
  - 方案 A：在 transcript 文本上跑 LLM 推断语气（纯文本分析，精度有限但零额外成本）
  - 方案 B：保留原始音频 chunk，用专门的 emotion detection model（如 Hume AI、emotion2vec）分析
  - 方案 C：结合 transcript 文本 + 说话节奏/音量变化（需要在 offscreen 中做音频特征提取）
- **已决策 ✅**：v1 走方案 A（文本推断），语气推断结果作为参会者立场分析的输入维度之一
  - 在立场分析 prompt 中加入语气推断维度
  - 语气推断结论（如：强硬、犹豫、支持、质疑）直接影响 stance 判断结果
  - 后续可升级为音频情绪模型

---

## Alert Design

### Reminder Priorities

- `P0`
  - 被点名
  - 被明确提问
  - 被 assign action
  - 你在 share screen 且对方要求你滚动/切页/开链接
  - 高置信度 memory conflict
- `P1`
  - 高相关 memory match
  - 话题切换
  - 风险/ETA/owner 变化
- `P2`
  - 周期摘要
  - 非阻断型结构更新

### UX Guardrails

- P0 支持多条卡片垂直堆叠 (Stacking)，并附带计时器
- 其余 P1/P2 进入队列和 panel feed
- `Catch Up 视图` 必须显著轻于会后全景图报告，只展示 current chapter 状态

---

## Side Panel 各 Tab 数据源与展示规范

### 实时 Tab (Live)

**展示内容**：
1. **Catch Up 入口** — 快速查看近 5/10/15 分钟错过的内容
2. **当前话题卡片** — 实时更新的话题名称
3. **Alert Feed** — 按时间倒序的 P0/P1/P2 提醒卡片
4. **记忆关联** ← **已改为 P2 弹幕混入**
   - 展示 memory-service recall 返回的关联记忆
   - **不再作为独立区块**：原设计的底部记忆卡片区块会被实时卡片推到很下面，体验差
   - **改为 P2 弹幕**：记忆关联以紫色 P2 弹幕形式混入实时 feed，用户在讨论中即可看到
   - 弹幕文本包含摘要 + 置信度 + **可点击的超链接**（跳转到原始文档 URL）
   - hover 弹幕暂停动画（CSS `animation-play-state: paused`），方便用户点击链接
   - 弹幕速度略慢（10s vs 普通 7s），给用户更多阅读时间
   - 同时在侧边栏 Alert Feed 中以「记忆」标签展示（含可点击链接）
   - 数据来源：每次话题切换或周期性（30~90s），将 `transcript_summary + visual_observation + meeting_metadata` 发送给 memory-service `/api/v1/recall`

**数据来源**：
| 数据 | 来源 | 刷新频率 |
|---|---|---|
| 当前话题 | whisper transcript → LLM 话题检测 | 话题切换时 |
| Alert Feed | transcript + observation → 规则引擎 + LLM 判断 | 实时 |
| 记忆关联 | memory-service `/api/v1/recall` | 30~90s 或话题切换时 |

### 时间线 Tab (Timeline)

**展示内容**：
1. **时间线节点列表** — 按时间正序排列的事件节点
2. **可展开详情** — 点击节点展开描述、发言人、关联行动项、截图占位
3. 节点类型：话题、决议、行动项、提及你、共享画面

**数据来源**：
| 数据 | 来源 |
|---|---|
| 话题节点 | transcript → LLM 话题分割 |
| 决议节点 | transcript → LLM 决议提取 |
| 行动项节点 | transcript → LLM action item 提取 |
| 提及你节点 | transcript → 关键词/NER 匹配 |
| 共享画面节点 | visual observation 变更检测 |

### 行动项 Tab (Actions)

**展示内容**：action items 列表，含 owner、DDL、状态
**数据来源**：transcript → LLM 提取，与时间线共享提取结果

### 设置 Tab (Settings)

**展示内容**：个性化设置（Hotwords、Name Aliases、Summary Interval、Screenshot Interval、Memory Context、Privacy Notice）
**注意**：核心服务配置（Provider URL、API Key 等）不在此 tab，统一在 `options.tsx` 管理（见下方「配置同步」章节）

### Catch Up Modal

**展示内容**：
1. **关键决议** — 时间窗口内的决议摘要
2. **提到了你** — 被提及的关键发言
3. **新行动项** — 新增的 action items
4. **话题变化** — 话题流转摘要

**设计原则**：Catch Up 是「轻量快照」，不展示记忆关联、不展示完整 transcript。只展示最高价值的结构化信息。

**数据来源**：全部来自已结构化的会议数据（话题、决议、行动项、提及），不额外调用 memory-service。

### Debug Tab (开发模式) ← 更名为 Capture Log

**展示内容**：
1. Capture 状态（recording/idle、stream ID、chunks、blob size、duration）
2. 最新截图 OCR 结果
3. API 请求日志（whisper、memory recall、vision）
4. 结构化文本解析结果

**构建策略**：
- `npm start` (开发模式)：完整渲染 Debug tab，包括所有日志组件
- `npm run build` (生产构建)：**不打包 Debug tab 的组件代码**
  - 实现方式：用 `webpack.DefinePlugin` 注入 `__DEV__` 变量
  - Debug tab 的组件用动态 `import()` 包裹在 `if (__DEV__)` 条件内
  - 生产构建中 webpack tree-shaking 会完全移除这些代码，不只是 CSS hidden
  - 对应 `meeting-sidepanel.html` 的 tab 按钮也用 `__DEV__` 条件渲染
- **不要**只用 CSS `display:none` 或 URL 参数控制，要确保生产包不包含 debug 组件代码

---

## Participant Stance & Attitude (参会者立场分析)

### 功能定义

- 对每个参会者，按会议中出现的各话题，分析其：
  - **立场** (stance)：主导 / 支持 / 中立 / 质疑 / 反对
  - **关键发言** (key quotes)：1-2 句代表性引言
  - **参与度**：该话题下的发言占比

### In-Meeting 呈现

- **hover 视频头像**：紧凑型立场卡片
  - 参会者姓名 + 角色
  - 每个话题一行：立场标签 + 话题名 + 缩略引言
  - 底部提示「点击查看完整记录」
  - **信息量判断**：3-5 个话题 × 1 行 ≈ 可在 hover 卡片中完整展示，无需额外展开
  - 若话题 > 5 个，卡片内 max-height 滚动

### Post-Meeting 呈现

- **侧边栏「立场与态度」区块**
  - 按参会者分组
  - 每人默认展示 2 个最重要话题的立场+引言
  - 可「展开更多」查看所有话题
  - 包含时间段标注

### 数据来源

- transcript (按 speaker diarization 分段) → LLM 分析 prompt
- prompt 输入：话题列表 + 各 speaker 在各话题下的发言段落
- 输出：结构化 JSON `{ participant, topic, stance, keyQuote, timeRange }`
- **在哪里执行**：offscreen 或 background 中，每次话题切换或周期性触发
- **不需要额外模型**：复用现有 LLM（whisper 的 provider 或 memory-service 的 LLM），只是一个分析 prompt

---

## Timeline 可视化扩展

### 当前状态

- 时间线目前为纯文本+badge 列表形式（可展开详情）

### 可视化方向

- **数据表格**：行动项汇总表、预算数据等
- **流程图/决策树**：决议链路、讨论分支
- **脑图**：话题关联图
- **甘特图**：排期相关话题自动识别

### 生成策略

- **不使用图片**，使用结构化数据 + 前端渲染
- 方案：LLM 分析 transcript → 输出 **Mermaid 图语法** 或 **结构化 JSON** → 前端用 `mermaid.js` 或自定义组件渲染
- 优点：可交互、可编辑、轻量、无需额外 model
- 渲染库候选：
  - `mermaid.js`：流程图、甘特图、脑图
  - 自定义 HTML/CSS：数据表格、简单 timeline 图
  - `chart.js` 或内联 SVG：能量曲线、发言占比饼图

### 执行位置

- **LLM 分析**：在 offscreen/background 中，复用现有 LLM provider
- **不需要额外模型能力**：标准 LLM 已足够生成 mermaid 语法
- **不经过 memory-service**：这是会中实时渲染，直连 LLM provider
- **会后 panorama**：可由 V3 Digest 在 memory-service 端生成更精细的 mermaid，通过 digest 结果返回

### 触发时机

- **会中**：仅在用户打开 Live Map 或时间线 tab 时按需生成，不主动消耗 token
- **会后**：V3 Digest 生成时一并输出可视化数据

- **已决策 ✅**：话题切换时自动生成 mermaid 图，无需手动触发

---

## 配置同步 (Options ↔ Side Panel Settings)

### 问题

- Side Panel 设置 tab 中有 `Provider URL`、`Meeting Minutes API URL`、`Transcribe Model` 等核心配置
- 这些配置需要在 `options.tsx` 中也能配置，且双向同步

### 配置拆分

| 配置项 | 含义 | 配置位置 | 存储 |
|---|---|---|---|
| `MEETING_PILOT_ENABLED` | Meeting Pilot 总开关 | `options.tsx` | `chrome.storage.local` |
| `MEETING_PROVIDER_BASE_URL` | Whisper 转写服务地址 (OpenAI-compatible) | `options.tsx` + side panel 设置 | `chrome.storage.local` |
| `MEETING_PROVIDER_API_KEY` | Whisper 转写服务 API Key | `options.tsx` | `chrome.storage.local` |
| `MEETING_TRANSCRIBE_MODEL` | 转写模型名 | `options.tsx` + side panel 设置 | `chrome.storage.local` |
| `MEETING_MINUTES_API_URL` | Meeting Minutes API 地址（独立外部服务） | `options.tsx` | `chrome.storage.local` |
| `MEETING_DANMAKU_SPEED` | 弹幕速度 `fast` / `medium` / `slow` | side panel 设置 | `chrome.storage.local` |
| `MEETING_SUMMARY_INTERVAL` | 摘要生成间隔 | side panel 设置 | `chrome.storage.local` |
| `MEETING_SCREENSHOT_INTERVAL` | 截图间隔 | side panel 设置 | `chrome.storage.local` |
| `MEETING_HOTWORDS` | 热词 | side panel 设置 | `chrome.storage.local` |
| `MEETING_NAME_ALIASES` | 姓名别名 | side panel 设置 | `chrome.storage.local` |
| `MEETING_MEMORY_CONTEXT` | 是否启用记忆联动 | side panel 设置 | `chrome.storage.local` |
| `MEETING_PRIVACY_NOTICE` | 隐私提示文案 | side panel 设置 | `chrome.storage.local` |

### 配置说明

- **Provider URL** (`MEETING_PROVIDER_BASE_URL`)：
  - 用于 Whisper 实时转写的 OpenAI-compatible endpoint
  - **直连，不经过 memory-service**，因为会中低延迟要求
  - 用户需要单独配置此地址和 API Key
  - 示例：`https://api.openai.com`（会自动拼接 `/v1/audio/transcriptions`）
  - 也可以用 Groq、self-hosted whisper 等兼容服务

- **Meeting Minutes API** (原 Digest API)：
  - **独立外部服务**，不是 memory-service 的一部分
  - API 文档：`https://10.32.45.219:9527/api.html`（注意：自签名证书）
  - 用于会后视频分析 → 输出 **PDF 格式会议纪要**
  - 需要用户单独配置 `MEETING_MINUTES_API_URL`
  - **视频传输流程待定**：需分析外部 API 确定是前端直传还是经由 memory-service 中转
  - **PDF 展示**：panorama 页面中以内嵌预览展示（`<iframe>` 或 PDF.js），支持下载和新窗口打开

### options.tsx 新增

- 在 `options.tsx` 中新增一个「Meeting Pilot」form-section
- 包含：
  - **总开关** (`MEETING_PILOT_ENABLED`)：关闭后不显示浮动图标、不注入 content script
  - `MEETING_PROVIDER_BASE_URL`：whisper 服务地址
  - `MEETING_PROVIDER_API_KEY`：whisper 服务 API Key
  - `MEETING_TRANSCRIBE_MODEL`：转写模型名
  - `MEETING_MINUTES_API_URL`：Meeting Minutes API 地址
- 其余个性化设置（hotwords、intervals 等）保留在 side panel 设置 tab 中

### 同步机制

- 所有配置统一存储在 `chrome.storage.local` 的 `envConfig` 对象中
- side panel 和 options 页面都通过 `chrome.storage.local.get/set` 读写
- 变更时通过 `chrome.runtime.sendMessage({ type: 'UPDATE_ENV_CONFIG' })` 通知 background
- side panel 监听 `chrome.storage.onChanged` 实时更新 UI

---

## Backend Contracts

### Current Digest Flow

- `POST /api/v2/upload/video`
  - `multipart/form-data`
  - 字段：`file`
  - 返回：`videoUrl`
- `POST /api/v3/generate_digest`
  - body:
    - `id`
    - `videoUrl`
    - `sessionName?`
    - `output?`
    - `needClips?`
    - `callbackUrl?`
- `GET /api/v3/digest/{id}`
  - 当前返回字段仍然是 `pdfUrl`
  - 即便 `output=webpage` 也沿用这个字段名

### Transcript Upload

- `POST /api/v2/upload/transcript`
- 返回 `filePath`
- 当前更直接服务于 `V2 Digest` 的文件路径模式
- 不是默认 `V3` 主链路的一部分

### Not Yet First-Class

- screenshot upload helper
- transcript-aware `V3` digest
- result 字段从 `pdfUrl` 演进成 `resultUrl / resultType`

## Meeting Minutes API (原 Digest API)

### 服务性质

- **独立外部服务**，不是 memory-service 的子模块
- API 地址由用户配置 `MEETING_MINUTES_API_URL`
- API 文档位于 `https://10.32.45.219:9527/api.html`（自签名证书）

### 输入输出

- **输入**：会议录制视频（webm）
- **输出**：PDF 格式会议纪要

### API 接口（已分析）

来源：`Minutes API Reference.mhtml`（即 `https://10.32.45.219:9527/api.html`）

**V3 Digest (当前版本)**：
- `POST /api/v3/generate_digest`
  - Request: `{ id, videoUrl, sessionName?, output: "pdf"|"webpage", needClips?, callbackUrl? }`
  - Response `202`: `{ taskId, status: "PROCESSING", message }`
- `GET /api/v3/digest/{id}`
  - Response `200`: `{ id, status: "PROCESSING"|"COMPLETED"|"FAILED", pdfUrl, message }`

**V2 Upload Helpers**：
- `POST /api/v2/upload/video` — `multipart/form-data`，字段 `file` → 返回 `{ videoUrl }`
- `POST /api/v2/upload/transcript` — `multipart/form-data` → 返回 `{ filePath }`

### 视频传输流程（已决策 ✅ — 前端直传）

API 原生支持 `multipart/form-data` 上传视频并返回 `videoUrl`，不需要 memory-service 中转。

**完整链路**：
1. 会议结束 → offscreen 停止录制得到 webm Blob
2. 前端 `POST /api/v2/upload/video` → 获得 `videoUrl`
3. 前端 `POST /api/v3/generate_digest` with `{ id, videoUrl, output: "pdf" }` → 获得 taskId
4. 前端轮询 `GET /api/v3/digest/{id}` → 状态变为 `COMPLETED` 后拿到 `pdfUrl`
5. 存储 `pdfUrl` 到 meeting session 数据（chrome.storage 或 memory-service ingest）
6. 用户打开 panorama 页面 → 读取该 session 的 `pdfUrl` → `<iframe src="pdfUrl">` 展示

**CORS 注意**：Minutes API 为内网服务，Chrome Extension 的 offscreen/background 可直接发起请求（不受 CORS 限制）

### PDF 展示（Panorama）（已决策 ✅ — iframe）

- panorama 页面 Digest 结果区块新增 PDF 预览
- 预览方式：`<iframe src="pdfUrl">`
- 顶栏新增「📄 会议纪要 PDF」快捷按钮，点击滚动到 PDF 区块
- 支持：在线预览、下载到本地、新窗口打开、分享链接
- demo 已实现占位 UI

---

## Memory Service

### Current Reality

- `memory-service` 仍是 text-first
- 现在已补 `meeting` sourceType
- 原生图片 ingest 仍未引入

### v1 Usage

- ingest 的是文本化 observation 与 transcript 摘要
- 不直接把 raw screenshot 当作可检索图像记忆

### Meeting 场景的 Memory 交互

- **会中 recall**：
  - 输入：transcript_summary + visual_observation + meeting_metadata
  - 调用：`POST /api/v1/recall`
  - 返回：相关记忆列表（含 confidence、source、text）
  - 展示位置：P2 弹幕 + Alert Feed「记忆」标签
  - **⚠️ sourceUrl 缺失**：数据库中已存储 `source_url`（ingest 时写入），但 RecallEngine 查询时未 SELECT 该字段，`RecallItem` 类型也未包含。**需要扩展**：
    - `RecallEngine.ts` 的 message 查询 SQL 加上 `source_url, source_title`
    - `RecallItem` 类型新增 `sourceUrl?: string; sourceTitle?: string`
    - recall route 的 response schema 新增对应字段
  - 扩展后，记忆弹幕的超链接可跳转到原始文档
- **会后 ingest**：
  - 会议结束后，将结构化会议数据（transcript、decisions、action items、stances）ingest 到 memory-service
  - sourceType: `meeting`
  - 同时存储 Minutes API 返回的 `pdfUrl` 到 metadata 中
- **会后 panorama 数据持久化**：
  - 结构化 meeting 数据（topic timeline、action items、decisions、stances、energy curve）作为一个完整的 meeting record ingest 到 memory-service
  - memory-service 新增 `/api/v1/meetings` 列表接口，返回历史会议列表（id、title、date、participants、pdfUrl）
  - memory-exploring.vue 新增「📡 会议记录」导航项，展示会议列表
  - 每条会议点击后打开对应的 panorama 页面（或在 modal 内渲染）

---

## UX Split

### In-Meeting Alerts

- 页内浮动入口作为发现路径
- 强提醒控制数量
- panel 内保留长期上下文
- **新增**：hover 视频头像展示参会者立场（详见「Participant Stance」章节）
- **新增**：记忆关联以 P2 弹幕 + Alert Feed「记忆」标签混合展示（带可点击链接）

### Live Meeting Map

- 会中使用
- 目标是"当前章节全貌"
- 默认主视图永远有 `Outline`
- `Table / Decision Flow` 只在高置信度时显示

### Post-Meeting Panorama

- 会后使用
- 页面更密、更完整
- 包含：
  - 时间线（可展开详情）
  - 行动项
  - 决议
  - 参会者统计
  - **新增**：参会者立场与态度区块
  - digest 链接
  - **新增**：Meeting Minutes PDF 预览（内嵌 iframe/PDF.js）
  - **未来**：可视化图表（mermaid 流程图、甘特图等）

---

## Deliverables

- 代码：
  - `src/meeting-shell/*`
  - `static/meeting-sidepanel.html`
  - `static/meeting-offscreen.html`
  - `src/manifest.json`
  - `webpack.common.cjs`
  - `src/background.ts`
  - `src/popup.tsx`
  - `src/options.tsx` — 新增 Meeting Pilot 配置区块
  - `src/utils.ts` — 新增 Meeting Pilot 相关配置字段到 `EnvConfigType`
  - `src/services/MemoryServiceClient.ts`
  - `memory-service/src/types/index.ts`
  - `memory-service/src/routes/ingest.ts`
  - `memory-service/src/routes/ingestBatch.ts`
- 文档：
  - `docs/features/meeting_pilot.md`
  - `docs/demo/meeting-danmaku-alerts.html`
  - `docs/demo/meeting-panorama-view.html`

---

## Audit: 现有实现 vs Plan 对照

<!-- 标记现有实现中可能多余或需要调整的部分 -->

| 现有实现 | 状态 | 备注 |
|---|---|---|
| Side Panel 设置中的 `Provider URL` | 需改名 | 改为 `Whisper Provider URL`，明确是转写服务 |
| Side Panel 设置中的 `Meeting Minutes API URL` | 需改架构 | 独立外部服务，需用户单独配置 `MEETING_MINUTES_API_URL`，不从 memory-service 推导 |
| Side Panel 设置中的 `Entry Mode` (auto/manual) | 保留 | 控制是否自动检测会议页 |
| Side Panel 设置中的 `Auto Detect` | 保留 | 配合 Entry Mode |
| Demo 中的 Debug tab 用 URL `?debug=1` 控制 | 需改进 | 正式实现改为 `__DEV__` 编译时控制，不只是 CSS hide |
| 时间线 tab 原来的静态列表 | 已改进 | demo 已实现可展开详情 |
| `meeting-live-map.html` | 保留 | 会中全貌视图，当前为静态 demo |

---

## Next Phase (实施顺序建议)

### Phase 1: Whisper 接入 + 配置体系

1. 在 `EnvConfigType` 中新增 Meeting Pilot 配置字段
2. 在 `options.tsx` 中新增 Meeting Pilot 配置 section（总开关 + whisper 配置）
3. side panel 设置 tab 读取 `chrome.storage.local`，与 options 双向同步
4. 在 offscreen 中接入 whisper 实时转写链路
5. Web Speech API fallback（如决定实现）

### Phase 2: 实时智能分析

6. transcript → LLM 话题检测 + 行动项提取
7. transcript → LLM 参会者立场分析
8. visual observation → 远端 vision model
9. memory-service recall 接入（实时 tab 记忆关联）

### Phase 3: Debug Tab 工程化

10. `webpack.DefinePlugin` 注入 `__DEV__`
11. Debug/Capture Log tab 组件用条件 import
12. 确认生产构建不包含 debug 代码

### Phase 4: 可视化

13. Mermaid.js 集成（流程图、甘特图）
14. 会中按需生成可视化
15. 会后 Digest 包含可视化数据

### Phase 5: 会后 Panorama 增强

16. Panorama 页面接入真实 digest 数据
17. 参会者立场区块接入真实分析数据
18. 可视化图表嵌入

---

## Resolved Decisions

1. ✅ **Web Speech API fallback**：实现。零成本降级，标记为 `low_confidence_transcript`
2. ✅ **会中 mermaid 生成时机**：话题切换时自动生成
3. ✅ **语气分析**：v1 方案 A（文本推断），语气结论 feed 进立场分析
4. ✅ **记忆关联展示**：改为 P2 弹幕混入实时 feed（带可点击链接），不再作为独立区块
5. ✅ **Meeting Minutes API**：独立外部服务（非 memory-service），输出 PDF，panorama 页面内嵌预览
6. ✅ **视频传输流程**：前端直传。Minutes API 支持 `POST /api/v2/upload/video` multipart 上传，返回 `videoUrl`
7. ✅ **PDF 渲染方案**：`<iframe src="pdfUrl">`
8. ✅ **recall sourceUrl**：数据库已有 `source_url` 但 RecallEngine 未 SELECT、RecallItem 未包含，需扩展 3 处

## Open Decisions

1. **会后 panorama 页面入口**：是在 memory-exploring.vue 新增「会议记录」导航 + 列表页？还是 side panel 内直接打开？还是 popup 中增加历史会议入口？需要确认最佳 UX 方案
2. **弹幕速度配置的 chrome.storage 同步**：demo 中暂用 localStorage，正式实现需写入 `envConfig.MEETING_DANMAKU_SPEED` 并通过 `chrome.storage.local` 同步
3. **Minutes API 认证方式**：API 文档未提及认证（可能是内网无认证），需确认是否需要 API Key / Token

---

## 会议数据沉淀机制 (Meeting Data Sedimentation)

### 设计原则

会议数据的沉淀路径与现有数据类型（消息 `glip`、网页浏览 `web`、手动笔记 `manual`）**完全一致**，复用 memory-service 的 10-phase IngestionPipeline + 4-level 记忆层级 + 4-channel RecallEngine。不引入会议专用的存储或检索通道。

### 数据流概览

```
会议结束
  ├─ 1. 会中实时数据打包为 IngestPayload (sourceType: 'meeting')
  │    └→ POST /api/v1/ingest (或 /api/v1/ingest/batch)
  │         └→ 10-phase IngestionPipeline
  │              ├─ Phase 1: 去重 (content hash)
  │              ├─ Phase 2: LLM 提取 (entities, topics, action items)
  │              ├─ Phase 3: 显著性评分 (SalienceScorer)
  │              ├─ Phase 4: messages_raw 写入
  │              ├─ Phase 5: 384-dim embedding
  │              ├─ Phase 6: chunking → chunks + chunks_vec + chunks_fts
  │              ├─ Phase 7: entity/relationship → entities + relationships
  │              ├─ Phase 8: profile processing
  │              ├─ Phase 9: project matching
  │              └─ Phase 10: daily markdown 追加
  │
  ├─ 2. digestId 写入 meeting metadata (chrome.storage + ingest metadata)
  │    └→ 后续打开 panorama 时轮询 pdfUrl
  │
  └─ 3. 夜间 ConsolidationEngine 自动处理
       ├─ daily summaries → compress
       ├─ denoise (低显著性衰减)
       ├─ project summaries 更新
       ├─ profile consolidation
       ├─ forgetting cycle (temporary → forgotten)
       └─ reindex chunks
```

### Ingest 数据结构

会议结束时，前端将数据打包为 **1 条主记录 + N 条 chunk-ready 段落**：

**主记录（会议摘要）**：
```typescript
{
  content: `## 会议: ${meetingTitle}\n日期: ${date}\n参会者: ${participants.join(', ')}\n\n### 摘要\n${summary}\n\n### 决议\n${decisions.map(d => '- ' + d).join('\n')}\n\n### 行动项\n${actionItems.map(a => '- [${a.owner}] ${a.text} (DDL: ${a.deadline})').join('\n')}`,
  sourceType: 'meeting',
  sourceUrl: panoramaPageUrl,  // 会后全景页 URL，供 recall 时跳转
  sourceTitle: meetingTitle,
  sender: 'meeting-pilot',
  groupId: meetingId,
  groupName: meetingTitle,
  metadata: {
    meetingId,
    digestId,
    pdfUrl,       // 可能为 null（生成中）
    participants,
    duration,
    topicCount,
    actionItemCount
  }
}
```

**辅助段落（batch ingest）**：每个主要话题段落作为独立 ingest 条目，确保 chunking 粒度合适：
```typescript
// 每个话题一条
{
  content: `[会议话题] ${topicName}\n时间: ${timeRange}\n发言人: ${speakers}\n\n${topicTranscriptSummary}\n\n立场:\n${stances.map(s => `- ${s.participant}: ${s.stance} — "${s.keyQuote}"`).join('\n')}`,
  sourceType: 'meeting',
  sourceUrl: panoramaPageUrl,
  sourceTitle: `${meetingTitle} — ${topicName}`,
  groupId: meetingId,
  sender: 'meeting-pilot'
}
```

### 为什么这样设计

1. **复用现有管线**：不需要新建表或新建检索通道。`messages_raw` 存原始记录，`chunks`+`chunks_vec`+`chunks_fts` 存语义切片，`entities`+`relationships` 存结构化知识图谱 — 全部复用。
2. **自动可检索**：
   - **ask/context-match (doubao-bridge)**：查询走 RecallEngine 的 4-channel (vector + FTS + graph + time)，会议数据通过 embedding 自然出现在相关结果中
   - **下次会议记忆关联**：recall 时 `sourceTypes: ['meeting']` 可精确过滤会议来源
   - **网页/聊天场景**：不需要特殊处理，embedding 相似度自然召回
3. **显著性衰减自然淘汰**：
   - 会议摘要的 importance 评分较高（含决议、行动项），不会被轻易遗忘
   - 会议中的闲聊段落 importance 较低，会在 ConsolidationEngine 夜间处理中逐渐衰减
   - 4 级记忆层级自动生效：`temporary → working → consolidated → core`
4. **话题粒度 chunking**：每个话题独立 ingest，确保 recall 时能精确匹配到具体话题而非整场会议的大段文本

### 数据量与性能

- 一场 1h 会议约产生 1 条摘要 + 5~10 条话题段落 ≈ 6~11 条 ingest
- 每条经 chunking 后约 2~5 个 chunks ≈ 总共 12~55 个 chunks
- 与日常消息量（每天数十~数百条 glip 消息）相当，不会造成检索性能问题
- RecallEngine 已有 MMR 去重 + top-K 限制，不会因为会议数据多而霸占召回结果

### Digest 轮询与 PDF 状态

**问题**：Minutes API 的 digest 生成可能需要几分钟到十几分钟，会议结束时 `pdfUrl` 大概率还没返回。

**方案**：
1. 会议结束时立即 ingest 会议数据（不等 pdfUrl），metadata 中记录 `digestId`，`pdfUrl: null`
2. 同时启动后台轮询（background service worker 中），间隔 30s 检查 `GET /api/v3/digest/{digestId}`
3. pdfUrl 返回后，更新 `chrome.storage.local` 中该会议的 `pdfUrl`
4. 同时 PATCH memory-service 中对应记录的 metadata（如果支持），或在下次 consolidation 时自然补全

**Panorama 页面打开时**：
1. 读取 `chrome.storage.local` 中该会议的 session 数据
2. 如果 `pdfUrl` 已有 → 直接 iframe 预览（State A: Ready）
3. 如果 `pdfUrl` 为 null → 展示 State B (Generating)：
   - 显示「会议纪要生成中…」+ digestId
   - PDF 预览/下载按钮 disabled
   - 页面主动发起一次 `GET /api/v3/digest/{digestId}` 检查
   - 如果返回 COMPLETED → 切换到 State A
   - 如果仍 PROCESSING → 保持 State B，30s 后自动重试

### 与 memory-exploring.vue 的集成

- memory-exploring.vue 侧边栏新增「📡 会议记录」导航项
- memory-service 新增 `GET /api/v1/meetings` 接口：
  ```sql
  SELECT DISTINCT group_id AS meetingId, group_name AS title,
         MIN(created_at) AS date, metadata
  FROM messages_raw
  WHERE source_type = 'meeting'
  GROUP BY group_id
  ORDER BY date DESC
  ```
- 点击会议 → 在 modal 中渲染 panorama 视图（复用 panorama HTML 模板），或新窗口打开
- pdfUrl 从 metadata 中读取，如果为空则展示生成中状态

---

## Harness Testing (验证与自测)

### 变更分类：是否需要 Chrome Extension Reload

`npm run build` 后，根据变更内容判断是否需要 reload extension：

| 变更类型 | 需要 Reload? | 原因 |
|---|---|---|
| `background.ts` (service worker) | ✅ 需要 | service worker 是 extension 核心，必须重新注册 |
| `manifest.json` | ✅ 需要 | manifest 变更必须 reload 才能生效 |
| `contentScriptRingCentralMeeting.ts` | ✅ 需要 | content script 注入逻辑在 extension 注册时绑定 |
| `popup.tsx` / `options.tsx` | ❌ 不需要 | 每次打开重新加载 HTML，刷新即可 |
| `meeting-sidepanel.html` + JS | ❌ 不需要 | side panel 每次打开重新加载，关闭重开即可 |
| `meeting-offscreen.html` + JS | ✅ 需要 | offscreen 由 background 管理生命周期，需 reload 确保重新创建 |
| `static/*.html` (panorama 等) | ❌ 不需要 | 静态页面刷新即可 |
| `memory-service/**` | ❌ 不需要 | 后端服务独立运行，重启 memory-service 即可 |
| `src/utils.ts` (EnvConfigType) | ✅ 需要 | 被 background/content script import，需 rebuild + reload |
| `src/services/MemoryServiceClient.ts` | ⚠️ 视情况 | 如果只被 side panel 引用则不需要；如果被 background 引用则需要 |
| `docs/demo/*.html` | ❌ 不需要 | demo 文件直接浏览器打开，完全不涉及 extension |

### Extension Reload 策略

**Extension ID**: `hkmimegiefnbeadjoonnlogikcdddcho`（开发环境固定 ID，加载 unpacked extension 时由 Chrome 分配）

**方案 A — chrome.management API（推荐）**：
```javascript
// 通过 Playwright 在 chrome://extensions 页面执行
// 或通过 webpage-mcp chrome_javascript 执行
await chrome.management.setEnabled('hkmimegiefnbeadjoonnlogikcdddcho', false);
await new Promise(r => setTimeout(r, 500));
await chrome.management.setEnabled('hkmimegiefnbeadjoonnlogikcdddcho', true);
```
**限制**：`chrome.management` 需要在 extension 自身的 background 中调用，外部页面无法直接调用。

**方案 B — chrome://extensions 页面 DOM 操作（推荐用于外部自动化）**：
```javascript
// 1. 导航到 chrome://extensions
// 2. 找到对应 extension 的 reload 按钮并点击
// 注意：chrome:// 页面有特殊安全限制，Playwright 和 webpage-mcp 可能无法操作
```

**方案 C — chrome.runtime.reload()（最可靠）**：
在 extension 的 background service worker 中暴露一个 reload 消息：
```typescript
// background.ts 新增
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DEV_RELOAD' && msg.secret === DEV_SECRET) {
    chrome.runtime.reload();
  }
});
```
Playwright/webpage-mcp 通过以下方式触发：
```javascript
chrome.runtime.sendMessage('hkmimegiefnbeadjoonnlogikcdddcho', { type: 'DEV_RELOAD', secret: DEV_SECRET });
```
**需要 manifest.json 中配置 `externally_connectable`**：
```json
{
  "externally_connectable": {
    "matches": ["http://localhost/*", "https://v.ringcentral.com/*"]
  }
}
```

**方案 D — Playwright persistent context + extension reload**：
```typescript
// app/ 目录下已有 Playwright 配置
const context = await chromium.launchPersistentContext(userDataDir, {
  args: [`--load-extension=${extensionPath}`, '--disable-extensions-except=' + extensionPath]
});
// Playwright 可以通过 service worker page 执行 chrome.runtime.reload()
const sw = context.serviceWorkers()[0];
await sw.evaluate(() => chrome.runtime.reload());
```
**这是最可靠的自动化方案**，Playwright 可以直接操作 service worker。

**推荐方案**：开发阶段使用 **方案 D (Playwright)**；如果需要 webpage-mcp 远程调试，使用 **方案 C (onMessageExternal)**。

### 测试场景设计

#### 场景 1: 会议检测与入口

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 1.1 | 导航到 `https://v.ringcentral.com/welcome/join/` | 页面加载完成 | `chrome_navigate` / Playwright `page.goto()` |
| 1.2 | 点击 Start 按钮开始会议 | 跳转到 `/conf/on/:meetingId` | `chrome_click_element` / Playwright `page.click()` |
| 1.3 | 等待 content script 注入 | 页面出现 Meeting Pilot 浮动图标 | `chrome_screenshot` / Playwright `page.waitForSelector()` |
| 1.4 | 截图验证浮动入口状态 | Idle 状态，显示「授权 Capture」 | `chrome_screenshot` |

#### 场景 2: Capture 启动与实时转写

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 2.1 | 点击浮动入口的 Capture 按钮 | 弹出 tab capture 授权对话框 | Playwright `page.click()` |
| 2.2 | 授权后验证状态切换 | 浮动入口变为 Active 状态 | `chrome_screenshot` |
| 2.3 | 等待 5-10 秒 | offscreen 开始录制，whisper 开始转写 | Playwright `page.waitForTimeout()` |
| 2.4 | 检查 side panel 实时 tab | 出现转写文本 / alert feed | `chrome_screenshot` |

#### 场景 3: 弹幕系统

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 3.1 | 注入模拟的 alert 数据到页面 | 弹幕开始滚动 | `chrome_javascript` 调用 `createDanmaku()` |
| 3.2 | 注入 P0 高优先级 alert | 页面中央出现 P0 居中卡片 | `chrome_javascript` |
| 3.3 | 注入 memory 类型弹幕 | 出现紫色弹幕，带下划线链接 | `chrome_javascript` |
| 3.4 | hover 弹幕 | 弹幕暂停滚动 | Playwright `page.hover()` + screenshot |
| 3.5 | 修改弹幕速度为「慢」 | 后续弹幕速度变慢（duration ×2） | `chrome_javascript` 修改 `danmakuSpeedKey` |

#### 场景 4: Side Panel 各 Tab

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 4.1 | 打开 side panel | side panel 正常渲染 | Playwright `page.click()` |
| 4.2 | 切换到时间线 tab | 显示时间线节点列表 | `chrome_click_element` |
| 4.3 | 点击时间线节点 | 展开详情（描述、发言人、行动项） | `chrome_click_element` |
| 4.4 | 切换到行动项 tab | 显示 action items 列表 | `chrome_click_element` |
| 4.5 | 切换到设置 tab | 显示速度选择、hotwords 等设置 | `chrome_click_element` |
| 4.6 | 修改弹幕速度设置 | 保存到 chrome.storage，下次打开仍生效 | `chrome_javascript` 验证 storage |

#### 场景 5: 会议结束 & Digest 流程

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 5.1 | 点击停止录制 | offscreen 停止 MediaRecorder | Playwright `page.click()` |
| 5.2 | 验证视频上传 | `POST /api/v2/upload/video` 发出 | `chrome_network_capture` |
| 5.3 | 验证 digest 请求 | `POST /api/v3/generate_digest` 发出 | `chrome_network_capture` |
| 5.4 | 验证 ingest 到 memory-service | `POST /api/v1/ingest` 发出 | `chrome_network_capture` |
| 5.5 | 模拟 digest 完成（mock response） | pdfUrl 更新到 chrome.storage | `chrome_javascript` mock fetch |

#### 场景 6: Post-Meeting Panorama

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 6.1 | 打开 panorama 页面（pdfUrl 未就绪） | PDF 区块显示「生成中」(State B) | Playwright `page.goto()` + screenshot |
| 6.2 | 模拟 pdfUrl 返回 | PDF 区块切换到 State A，iframe 加载 | `chrome_javascript` 调用 `togglePdfState()` |
| 6.3 | 点击「📄 会议纪要 PDF」按钮 | 页面滚动到 PDF 区块 | `chrome_click_element` |
| 6.4 | 验证时间线、行动项、参会者统计 | 各区块正常渲染 | `chrome_screenshot` |
| 6.5 | 验证参会者立场区块 | 显示各参会者对各话题的立场 + 引言 | `chrome_screenshot` |
| 6.6 | 点击展开立场详情 | 展开更多话题立场 | `chrome_click_element` |

#### 场景 7: 记忆检索验证

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 7.1 | 先 ingest 一条会议数据到 memory-service | 成功返回 | `curl` / Playwright fetch |
| 7.2 | 通过 `/api/v1/recall` 查询相关话题 | 返回包含会议数据的结果 | `curl` / Playwright fetch |
| 7.3 | 验证结果中包含 sourceUrl | 可跳转到原始会议 panorama | 检查 response JSON |
| 7.4 | 通过 doubao-bridge ask 查询 | 会议内容被作为上下文返回 | 在 doubao-bridge 输入框提问 |
| 7.5 | 新开一场会议，验证记忆关联 | P2 弹幕中出现上一场会议的相关记忆 | `chrome_screenshot` |

#### 场景 8: Demo HTML 验证（无需 extension）

| # | 步骤 | 预期结果 | 工具 |
|---|---|---|---|
| 8.1 | 浏览器打开 `meeting-danmaku-alerts.html` | 完整 UI 渲染 | `chrome_navigate` / Playwright |
| 8.2 | 点击 Demo 按钮 | 弹幕 + P0 + 记忆弹幕全部触发 | `chrome_click_element` |
| 8.3 | 验证弹幕速度控制 | 设置 tab 切换速度后弹幕 duration 变化 | `chrome_javascript` 检查 CSS |
| 8.4 | 浏览器打开 `meeting-panorama-view.html` | 完整 UI 渲染 | `chrome_navigate` / Playwright |
| 8.5 | 点击 PDF 按钮 | 滚动到 PDF 区块 | `chrome_click_element` |
| 8.6 | 切换 PDF 状态（Ready ↔ Generating） | UI 正确切换 | `chrome_javascript` 调用 `togglePdfState()` |

### 测试数据注入

在真实会议中（`https://v.ringcentral.com/conf/on/:meetingId`），通过 DOM 操作注入测试数据：

```javascript
// 通过 webpage-mcp chrome_javascript 或 Playwright page.evaluate() 执行

// 1. 模拟 transcript 数据
window.__MEETING_PILOT_TEST__ = {
  transcript: [
    { speaker: 'Alice', text: '我们讨论一下 Q3 预算方案', time: '10:02:30' },
    { speaker: 'Bob', text: '我觉得需要增加 20% 的研发投入', time: '10:03:15' },
    { speaker: 'Charlie', text: '从运营角度看这个方案风险较高', time: '10:04:00' },
  ],
  topics: ['Q3预算', '研发投入', '运营风险'],
  participants: ['Alice', 'Bob', 'Charlie']
};

// 2. 触发 meeting-pilot 的数据处理
// content script 检测到 __MEETING_PILOT_TEST__ 后进入测试模式
window.dispatchEvent(new CustomEvent('meeting-pilot-test-data', {
  detail: window.__MEETING_PILOT_TEST__
}));

// 3. 模拟 Memory Recall 响应
window.__MEETING_PILOT_MOCK_RECALL__ = [
  { text: 'Q2 预算评审中 Alice 提出过类似的增投方案', confidence: 0.91, sourceUrl: 'https://example.com/q2-review' },
  { text: '上季度研发投入增加 15% 后项目延期了两周', confidence: 0.85, sourceUrl: 'https://example.com/q2-report' }
];
```

### 工具能力对照

| 能力 | webpage-mcp | Playwright (app/) | 备注 |
|---|---|---|---|
| 导航到 URL | ✅ `chrome_navigate` | ✅ `page.goto()` | |
| 点击元素 | ✅ `chrome_click_element` | ✅ `page.click()` | |
| 执行 JS | ✅ `chrome_javascript` | ✅ `page.evaluate()` | |
| 截图 | ✅ `chrome_screenshot` | ✅ `page.screenshot()` | |
| 网络捕获 | ✅ `chrome_network_capture` | ✅ `page.route()` / CDP | |
| 表单填写 | ✅ `chrome_fill_or_select` | ✅ `page.fill()` | |
| Service Worker 操作 | ❌ | ✅ `context.serviceWorkers()` | Playwright 独有 |
| Extension Reload | ❌ 直接不行 | ⚠️ 当前环境不稳定，优先“重启 browser context + 重新加载 dist” | `chrome.runtime.reload()` / chrome://extensions reload 可能导致 unpacked extension 被卸载 |
| chrome:// 页面 | ❌ | ⚠️ 受限 | 需 `--allow-file-access-from-files` |
| 多 tab 管理 | ✅ `chrome_tab_*` | ✅ `context.pages()` | |

**结论**：
- **Demo HTML 验证**：webpage-mcp 或 Playwright 均可，webpage-mcp 更轻量
- **Extension 集成测试**：必须用 **Playwright persistent context**（因为需要加载 extension、操作 service worker）
- **Extension Reload / 最新 build 生效验证**：不要依赖 `sw.evaluate(() => chrome.runtime.reload())`；当前环境下更稳定的方式是：
  - `npm run build`
  - 关闭当前 Playwright persistent context
  - 重新拉起一个新的 persistent context，加载最新 `dist/`
  - 在新的 extension 实例中验证修改后的文案 / 数据 / UI
- **网络 mock**：Playwright `page.route()` 可拦截 Minutes API / memory-service 请求，注入 mock response
- **真实站点 E2E（复用本机登录态）**：**可行**。适用于 Scene 1~7 中需要真实 RingCentral 页面和真实登录态的场景

### 真实 RingCentral E2E（复用本机登录态）

可用 **Playwright persistent context** 复用本机已有的 RingCentral 登录态做真实站点验证。

**推荐方式**：

1. 使用一个**专用的浏览器 profile / userDataDir**，该 profile 已手工登录 `https://v.ringcentral.com/`
2. Playwright 用该 `userDataDir` 启动 persistent context，并同时加载 `dist/` unpacked extension
3. 在真实 `v.ringcentral.com` 页面中执行 Scene 1~7 的验证
4. 如果验证前做过 `npm run build`，不要做原地 reload；直接关闭当前 context，重新拉起新的 context 读取最新 `dist/`

**注意事项**：

- 不建议直接复用日常主 profile，优先使用专门的测试 profile，避免污染个人浏览数据
- 登录态过期、SSO、2FA、设备校验等都会影响自动化稳定性
- 这条路径适合“手动触发 + 高保真验证”，不适合作为默认 CI
- 若只是验证 content script 注入 / side panel / popup / background 同步，优先用 `page.route()` 返回 fixture HTML，可获得更稳定的自动化结果

### Playwright 测试运行方式

```bash
# 在 app/ 目录下运行 (已有 Playwright 配置)
cd app && npx playwright test meeting-pilot.spec.ts

# 或单独运行某个场景
npx playwright test meeting-pilot.spec.ts --grep "弹幕系统"
```

测试文件位置：`app/tests/meeting-pilot.spec.ts`（待创建）

### 持续集成建议

1. **每次 build 后自动运行 Scene 8**（Demo HTML 验证）— 不需要 extension，纯静态页面
2. **手动触发运行 Scene 1~7** — 优先使用：
   - fixture URL + Playwright route mock（稳定自动化）
   - 或 Playwright persistent context + 本机已登录的 RingCentral profile（真实站点高保真验证）
3. 可通过 `npm run test:meeting-pilot` 触发完整测试套件
