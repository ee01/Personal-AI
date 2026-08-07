# Meeting Pilot ASR 探测路径回执

## 目标

- 随机目标：`docs/index.md` 中的 `分层 ASR` / Meeting Pilot。
- 用户体验缺口：Speech 面板已经显示当前 ASR 层级、上传边界和切层说明，但用户看不到本轮已经检查/跳过了哪些 ASR provider。Auto 模式从本地失败切到 Cloud 时，云端上传像是直接发生，而不是可解释的 fallback。
- Reminder：本机没有 `Personal AI` Reminders 列表，本轮没有 Reminder item 可关联或完成。

## 外部参考

- Microsoft Teams live captions 与 transcription 明确区分实时字幕和可保存 transcript，并由管理员/会议权限控制。
- Zoom AI Companion / Meeting Summary 建议结合 captions、语言设置与 transcript 状态，而不是隐藏摘要前提。
- Whisper 论文支持本地/离线 ASR 作为隐私友好的 fallback，但质量和延迟仍需要可见状态。
- CHI 2025 ASR confidence/error-detection 研究提示单一置信度不足以帮助用户判断转写可靠性，需要更可解释的状态与人工复核路径。

## 实施计划

1. 扩展 `MeetingPilotTierStatus`：新增只读 `probeTrail`，记录 provider tier、结果、原因和时间。
2. 在 `ASROrchestrator` 中维护本次探测路径：
   - start 时记录各 eligible provider 的 unavailable / activated。
   - start failed、fatal fallback、watchdog fallback 和 fallback provider unavailable 时补充路径。
   - No ASR 状态也带上完整路径。
3. 在 `SpeechTab` 的 `ASR 链路回执` 中新增 `探测路径` 行，使用短标签展示最近路径，不改变排序/上传逻辑。
4. 更新 docs/features/meeting_pilot.md，让文档和当前 UI 一致。
5. 扩展现有 ASR unit tests 和 Meeting Pilot scene2 E2E 断言。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/asr/__tests__/orchestrator.test.ts`
- `npm start` 首次成功编译后停止 watch。
- `npm run test:meeting-pilot-scene1` 或更贴近 Speech 面板的 `desktop-app/scripts/meeting-pilot-scene2-runtime-check.mjs`。
- scoped `git diff --check`。
