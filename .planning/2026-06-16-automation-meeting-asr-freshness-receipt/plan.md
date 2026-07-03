# Meeting Pilot ASR 新鲜度回执改进计划

## 目标功能

- 随机命中：`分层 ASR`
- 所属文档：`docs/features/meeting_pilot.md`
- 目标体验：用户在会议中打开 `发言` 面板时，不只知道当前 ASR 层级和最近结果数量，还能判断这些结果是否仍然代表当前会议正在被转写。

## 外部参考

- Zoom AI Companion 和 Teams live transcription 都把启动/停止、参与者可见提示、语言或转写状态作为显性会议状态。
- Microsoft Speech privacy 文档把音频和 transcript 都视为可能敏感数据；本地/云端边界必须继续可见。
- ASR 质量研究指出低质量或不可靠的 ASR 输出可能让用户误判可用性；Meeting Pilot 不应把旧 transcript 当作当前可用证明。

## 改进步骤

1. 在 Speech 面板 `ASR 链路回执` 中新增 `新鲜度` 行。
2. 当当前层级仍标记为运行、但最近真实 transcript 超过 live-meeting 阈值未更新时，用 warning 文案说明：旧转写不证明当前仍在收到音频，并给出检查麦克风、语言、Desktop App 或云端网络的恢复方向。
3. 保持本地/云端上传边界、fallback 原因和现有层级说明不变。
4. 扩展 Meeting Pilot scene2 E2E，模拟 active Cloud ASR 但 transcript 已过时，断言 stale receipt 文案。
5. 更新 `docs/features/meeting_pilot.md`，记录该 ASR 新鲜度边界。

## 验证计划

- 运行 ASR/Meeting Pilot 相关 targeted test。
- `npm start` 等待首个 webpack dev compile 成功后停止。
- 运行 `npm --prefix desktop-app run test:meeting-pilot-scene2` 验证真实 built extension side panel。
- 运行 scoped `git diff --check`。
