# Meeting Pilot

_最后更新: 2026-04-14_

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
  - `Blocked`：不允许开始录制（例如 Minutes API 未配置或不可达）
  - `Degraded`：允许录制，但部分智能能力降级（例如 Whisper / memory-service / analysis model 不可用）
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
- 行动项列表
- readiness 状态

### 会后 Panorama

- 会议摘要
- 时间线
- 行动项
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
- `MEETING_ANALYSIS_MODEL`
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
- Meeting Pilot 的阻断依赖是 `Minutes API`；Whisper / memory-service / analysis model 为可降级依赖。
- `SpeechRecognition` 的麦克风路径不作为有效的会议转写降级方案。
- 当前会中智能分析以 provider-backed transcript / observation / analysis 为主，仍受外部服务可用性影响。

## 相关入口

- 页面内浮动入口（RingCentral meeting）
- popup `Meeting Pilot` 卡片
- side panel
- Live Map
- Panorama
- `memory-exploring.html#/meetings`

## 验证

- `npm run build`
- `npm run test:meeting-pilot-real-site`
- `npm run test:meeting-pilot-verify`
