# Meeting Pilot Speaker 识别与发言 Tab 方案

## Summary

- 现有代码已经有“尽量拿真实名字”的基础逻辑，可以直接复用，但目前还不够稳定：
  - [contentScriptRingCentralMeeting.ts](/Users/Esone/git/personal-ai/src/meeting-shell/contentScriptRingCentralMeeting.ts:383) 会从页面正文里读 `speaker:` / `currently speaking:`，得到 `speakerLabel`
  - [contentScriptRingCentralMeeting.ts](/Users/Esone/git/personal-ai/src/meeting-shell/contentScriptRingCentralMeeting.ts:284) 会从参会者按钮 `aria-label="X has a good connection"` 提取 roster 真实姓名
  - [background.ts](/Users/Esone/git/personal-ai/src/meeting-shell/background.ts:1401) 已经会优先用 `transcriptChunk.speaker`，否则退回 `session.speakerLabel`
- 当前没有真正基于 mic 图标活跃变化做 speaker 探测，所以你的补充是合理的：应新增 `mic activity` 作为一个信号源，但不能作为唯一依据。
- 设计上不新起一套 speaker 系统，而是在现有 `transcript -> speaker resolve -> turn 聚合 -> participant stances` 管线里补“多信号 speaker resolver”。
- “会议室设备”要单独建模，不把它当普通人名；后续 turn 可以先挂在 `会议室设备`，再由 AI 和用户改名决定是否归并到真人。

## Key Changes

### 1. Speaker 识别改成多信号融合

- 在 content script 增加 `speakerSignals` 采集层，输出给 background：
  - `domSpeakerLabel`
  - `participantRoster`
  - `micActiveParticipantIds`
  - `captionSpeakerLabel`（如果页面已有 caption/AI notes speaker label）
  - `shareOwner`
- background 新增 `resolveSpeakerForTranscriptChunk()`，按优先级判定 chunk 属于谁：
  1. transcript 自带 speaker
  2. caption / AI notes speaker label
  3. DOM `speakerLabel`
  4. mic 活跃且能唯一映射到 roster 的 participant
  5. 当前会议内已有 provisional speaker
  6. 新建匿名 `说话人 N`
- 每次解析都产出 `resolutionSource` 和 `confidence`，后续 UI 可显示“来自 mic / DOM / AI 归并 / 用户改名”。

### 2. 增加 mic activity，但只作为辅助信号

- 在 content script 里新增对 participant tile / mic icon / speaking highlight 的轮询或 MutationObserver 检测。
- mic signal 只在以下条件下可直接映射真人：
  - 活跃 tile 明确绑定某个 roster participant
  - 活跃对象不是“Room / Conference Room / Meeting Room / Poly / Zoom Room / Boardroom / Device / Speakerphone”这类设备名
  - 同时没有多个 tile 并发活跃
- 若 mic 活跃对象像会议室设备，则 participant 标记为 `role: 'Room Device'`、`resolutionState: 'device'`，chunk 先挂到该设备，不直接认定为某个真人。
- 若 mic 活跃对象无法唯一映射，则只提升“正在有人说话”的置信度，不改 speaker identity。

### 3. Transcript 视图与 turn 聚合

- side panel 新增 `发言` tab，默认展示 `transcriptTurns`，不是原始 5 秒 chunk。
- turn 聚合规则：
  - 同一 resolved participant
  - 相邻 chunk gap `<= 12s`
  - 中间没有更高置信度的别的 speaker 插入
- 每个 turn 显示：
  - 发言人名
  - 来源标签：`DOM` / `Mic` / `Caption` / `AI` / `用户`
  - 时间范围
  - 合并后的 transcript
  - `低置信度` 标记
- “Whisper 已配置”之外，再显示 runtime transcript 状态：
  - `等待首条转写`
  - `最近成功时间`
  - `最近错误`
  - `successCount`

### 4. 当前会议内的 speaker identity / 改名 / 归并

- participant 扩展字段：
  - `resolutionState: 'roster' | 'provisional' | 'device' | 'user_named' | 'resolved'`
  - `sourceLabels`
  - `resolutionConfidence`
- 匿名 speaker 命名规则：
  - 人类未知 speaker：`说话人 1/2/...`
  - 设备未知 speaker：`会议室设备 1/2/...`
- 用户点击 `说话人 1` 改名后：
  - 只作用当前会议
  - 历史 `transcriptTurns` 和后续新 turn 都立即用新名字
  - participant 标记为 `user_named`
- AI 自动归并逻辑复用现有 stance 分析调用，不另起服务：
  - 输入最近若干 `transcriptTurns`、roster、当前 provisional participants、device participants
  - 输出 `participantResolutions`
  - 只允许：
    - `provisional -> roster`
    - `device -> roster` 但要求高置信度且有明显上下文证据
  - 不允许自动把两个不同 `user_named` participant 合并
- 现有 `participantStances` 继续保留，但挂到 canonical participant 上，Panorama 和发言 tab 用同一份 participant 数据。

### 5. 记忆弹幕噪音修复

- recall 结果先过滤当前会议自回显：
  - `metadata.meetingId === current meetingId`
  - `sourceUrl` 指向当前 meeting panorama
- `meeting_pilot` 展示改为只用清洗后的 `previewText`，不直接铺开 `fullSnippet`
- 清洗掉运行态样板句：
  - `No active screen share is detected.`
  - `Meeting Pilot is recording this meeting.`
  - `决议 - 暂无`
  - `行动项 - 暂无`
- 清洗后为空的 recall item 不显示在 live feed / 弹幕里。

## Test Plan

- 单元测试
  - DOM speaker / mic / transcript speaker 的优先级解析正确
  - mic 命中设备名时不会直接映射真人
  - turn 聚合在 speaker 切换和长时间 gap 时正确断开
  - 用户改名后历史和后续 turn 同步更新
  - AI resolution 只会把 `provisional/device` 合并到 canonical participant，不会误合并两个 `user_named`
  - recall 自回显和 boilerplate preview 被正确过滤
- 集成测试
  - Whisper 正常返回时，`发言` tab 持续增长
  - 只有 DOM speaker label 时，speaker 仍可落到 roster 真人
  - 只有 mic 活跃且对象是会议室设备时，speaker 显示为 `会议室设备`
  - 用户把 `会议室设备` 或 `说话人 1` 改成真人名后，后续展示沿用新名字
- 手工验证
  - 单人远程发言
  - 多人轮流发言
  - 多人共用会议室设备发言
  - 页面能读到 `speaker:` 但 mic 无法可靠识别
  - 页面只能看到 mic 高亮，没有可读 speaker 文本

## Assumptions

- 当前代码里的 DOM `speakerLabel` 和 roster 提取会继续保留，并作为第一批可复用信号。
- mic activity 是新增辅助层，不会替代现有 DOM / caption / transcript speaker 逻辑。
- 第一版只做当前会议内 identity 管理，不写回全局别名配置。
- “会议室设备”先作为独立 participant 类型处理，不默认拆分成多个人。
