# Meeting Pilot 会中提醒原因回执

## 目标功能

- 随机命中：`会中提醒` / Meeting Pilot
- 主文档：`docs/features/meeting_pilot.md`
- 范围：side panel 实时页的 P0 / P1 / P2 alert 展示，不改 capture、ASR、行动项生成或 memory-service。

## 外部参考

- Zoom AI Companion in-meeting questions 提供 `Was my name mentioned?`、`What are the action items?` 等会中问题预设，说明点名和行动项是高价值提醒。
- Microsoft Teams Facilitator 会中生成 notes、open questions 和 follow-up tasks，但仍把参与者编辑/协作留在会议体验中。
- CHI 2025 `Are We On Track?` 指出被动提示更不打断会议，主动介入更容易触发行动但有打扰风险。
- `Meeting Action Item Detection with Regularized Context Modeling` 强调行动项需要 local/global context，不能只用一句模糊任务替代 owner / deadline / evidence。

## 用户体验问题

当前 live feed 已经过滤掉纯 speaker/context refresh 噪声，但用户看到 alert 卡时主要只有等级、标题和正文。作为真实使用者，P0/P1/P2 标签不足以判断：

- 为什么这条提醒值得打扰？
- 我下一步应该去回应、复核行动项、看记忆，还是只忽略？
- 点击或处理这条提醒会不会自动发言、发送消息、写外部任务、确认决策？

## 实施计划

1. 在 `alertPresentation` 增加纯展示辅助，按 `mention/action/memory/share/summary` 和 P0/P1/P2 派生 `reason / nextStep / boundary`。
2. 在 side panel live feed alert 卡片正文下方展示 `为什么 / 下一步 / 边界` 三行，不改变 alert 数据结构和排序。
3. 扩展 alert 单测和 Meeting Pilot scene1 E2E，覆盖用户实际可见的原因回执。
4. 更新 `docs/features/meeting_pilot.md` 的会中提醒行为说明和行业依据。

## 验证计划

- Focused unit: `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/meeting-shell/__tests__/alertPresentation.test.ts src/meeting-shell/__tests__/liveFeedPresentation.test.ts`
- Dev compile: `npm start` 首次成功编译后停止 watch。
- Browser E2E: `npm run test:meeting-pilot-scene1`
- Scoped whitespace: `git diff --check -- src/meeting-shell/alertPresentation.ts src/meeting-shell/__tests__/alertPresentation.test.ts src/meeting-shell/meetingSidePanel.tsx desktop-app/scripts/meeting-pilot-scene1-check.mjs docs/features/meeting_pilot.md .planning/2026-06-17-automation-meeting-alert-reason-receipt/plan.md`
