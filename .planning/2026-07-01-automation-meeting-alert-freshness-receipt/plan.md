# Meeting Pilot 会中提醒信号新鲜度回执

## 选择依据

- 从 `docs/index.md` 随机候选中选中 `Meeting Pilot / 会中提醒`，避开最近几轮精确目标。
- `docs/progressing/to-verify.md` 当前无待续做事项。
- AppleScript 未列出 `Personal AI` Reminders，但 EventKit 只读探测到该列表；4 条均已完成且主题是 Doubao / Notification 同步，不纳入本轮 Meeting Pilot 改进。

## 外部参考

- Zoom AI Companion 的会中问题预设包含 catch up、name mention、action items，说明会中提醒应贴近用户当前处理意图，而不是只给摘要。
- Microsoft Teams Facilitator 在会议中跟踪 agenda、open questions 和 follow-up tasks，且进展标记不是立即发生，支持把提醒状态和更新延迟显性化。
- CHI 2025 会中目标反思研究强调被动提示低打扰、主动提示更容易产生行动但打扰更高，Meeting Pilot 应保留用户复核权。
- LLM meeting recap / action-item 研究强调 transcript evidence 和结构化 minutes，提醒不应脱离信号时间和依据口径。

## 改进计划

1. 在 `alertPresentation` 的回执模型里加入 `signal` 行，基于 `createdAt` 显示刚刚/几分钟前/较旧/缺时间戳状态。
2. 按 alert source 说明信号口径：mention/action 来自 transcript 或会中事件，memory 来自召回，share 来自共享画面/OCR，summary 来自摘要/话题变化。
3. 在 Side Panel 与 Live Map 的提醒卡复用该 `signal` 行，避免两个入口文案分叉。
4. 扩展 helper 单测和 Live Map E2E，锁定 `为什么 / 下一步 / 边界 / 信号` 四段回执。
5. 更新 `docs/features/meeting_pilot.md`，把新行为写入当前实现补充。

## 验证

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/alertPresentation.test.ts src/meeting-shell/__tests__/liveFeedPresentation.test.ts`
- `node --check tools/verify-meeting-live-map-e2e.mjs`
- `npm start -- --progress` 到首次成功编译后停止
- `node tools/verify-meeting-live-map-e2e.mjs`
- scoped `git diff --check`
