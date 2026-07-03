# Quick Ask 语音提交回执

## 目标

本轮随机抽中 `Quick Ask 语音输入` / Doubao Bridge。现有语音 sheet 已经说明本机识别、草稿确认、权限恢复和不会自动发送，但用户点箭头提交后，对话里只留下普通文本气泡，后续回看时不容易判断这条输入来自听写、提交范围是什么，以及是否发送了原始音频。

## 外部参考

- Raycast Dictation 把授权、接受 / 取消、波形反馈、本地历史和隐私边界放在同一路径。
- ChatGPT macOS Chat Bar 保持轻量入口，并通过箭头或 Return 明确提交。
- Apple Speech 授权模型要求用户可在系统设置中随时改变权限。
- ASR 研究和 Voice Typing / Typist Experiment 都提示听写需要覆盖 composition、review、editing，而不只是追求转写结果。

## 计划

1. 不改 Speech helper、权限请求或 Memory Service，只在 Quick Ask renderer 增加提交后回执。
2. 点击语音箭头提交后，在用户消息下展示 `语音草稿已确认发送`，说明当前范围、只提交转写文本、不发送或保存原始音频。
3. 保持普通文本输入、候选话题点击、独立记忆保存路径不受影响。
4. 更新 `docs/features/doubao_bridge.md`，只写行为边界，不写过细实现。
5. 扩展现有 Quick Ask Playwright 检查，覆盖 final transcript、点击发送、Ask payload、用户消息和回执。

## 验证

- `npm --prefix desktop-app run test:quick-ask-status-card`
- `npm --prefix desktop-app run build`
- `npm start` 首次 webpack dev compile 成功后停止 watcher
- `git diff --check -- desktop-app/app/quick-ask.js desktop-app/app/quick-ask.css desktop-app/app/i18n.js desktop-app/scripts/quick-ask-status-card-check.mjs docs/features/doubao_bridge.md .planning/2026-06-18-automation-quick-ask-voice-submit-receipt/plan.md`

