# Today Pilot 会前准备基础背景边界 Plan

## 随机目标

- 功能：`会前准备`
- 所属能力：Today Pilot
- 主文档：`docs/features/today_pilot.md`

## 调研结论

- Microsoft 365 Copilot 的 meeting prep 把准备内容放在 Outlook meeting event 上方，并允许用户展开查看更多 insight；这说明会前入口应先给可扫描状态，再提供 drill-down。
- Google Meet / Gemini 和 Zoom AI Companion 的 meeting notes、summary、catch-up、action item 能力通常发生在会中或会后，并受 host/admin/meeting enablement 控制；Today Pilot 的 Video Home handoff 不能被误读成自动加入会议、录音或分享摘要。
- AI meeting assistant governance / trust calibration 讨论都指向同一个 UX 要点：把 passive context、generated summary、autonomous action 和 external sharing 分开，让用户知道何时只是本地准备线索，何时跨越了发送/记录/执行边界。

## 发现的问题

Video Home 的 `会前准备回执` 已经展示高置信证据与基础背景数量，但 `isUsefulMeetingPrepEvidence()` 会在日历 evidence 文本包含 dependency、risk、owner 等工作信号时把它算进高置信证据。真实用户会把“日历描述里写了风险”误读成“Personal AI 召回到一条可展开记忆证据”。

同一张回执还没有直接说明 Meeting Pilot handoff 的边界。它确实写入本机 `meetingPrepHandoff` 缓存，但这不是加入会议、录音、发消息、审批或写回 Calendar。

## 实施步骤

1. 增加 calendar-only evidence classifier，让 `calendar:` id、`sourceLabel=calendar` 和 RingCentral calendar 文本始终留在基础背景桶。
2. 在 `会前准备回执` 中加入本机 handoff 边界说明。
3. 更新 Today Pilot 文档和 index。
4. 扩展 `verify-context-assist-meeting-prep.mjs`，让 fixture 的 calendar evidence 包含 dependency/risk 文本也只能显示为基础背景。
5. 运行 `verify:today-pilot-video-home`、`npm start` 首次成功编译、`verify:context-assist-meeting-prep` 和 scoped `git diff --check`。
