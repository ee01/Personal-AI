# Meeting Pilot Handoff 匹配回执改进计划

## 目标功能

- 随机目标：`Meeting Pilot handoff`
- 所属能力：Today Pilot
- 主文档：`docs/features/today_pilot.md`

## 发现

- Video Home 写入 handoff 时已经提示这是本机缓存，不会加入会议、录音、发消息、审批或写回外部系统。
- Meeting Pilot 读到 handoff 后只展示“会前准备已带入”和会议标题，用户看不到这次是按 meeting id 精确匹配、标题/时间兜底，还是标题关键词弱兜底。
- 多个候选会议、同名 recurring meeting、会议 id 缺失时，缺少匹配口径会让用户难以判断是否带错了上下文。
- 本机 Reminders 可访问，但没有 `Personal AI` 列表，因此没有可纳入或可完成的本地 Reminder 条目。

## 外部参考

- Microsoft Copilot for Sales meeting preparation card 会说明卡片出现位置、包含哪些 insight，以及可打开详细准备视图。
- Zoom AI Companion meeting summary 强调 host 启用、会后分享和控制边界，说明会前本机 handoff 应避免被误解成会中记录/分享已经启用。
- AI meeting assistant governance / consent 讨论强调透明说明 AI 助手会准备什么输出、限制是什么，以及 passive summary 和 autonomous proxy 的区别。
- Provenance / AI transparency 研究强调输出需要来源和流程透明；这里对应到 handoff 的匹配方式、缓存年龄和有效期。

## 实施计划

1. 在 Meeting Pilot side panel 内新增只读 `Handoff 匹配回执`。
2. 复用已有 meeting id、标题、时间窗口判定，不改变 handoff 选择结果。
3. 回执展示匹配方式、来源、生成模式、缓存年龄、剩余有效期和无副作用边界。
4. 更新静态 verifier、Today Pilot 文档和功能索引。
5. 运行 Today Pilot Video Home verifier、dev build、相关 E2E/语法检查和 scoped diff check。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-today-pilot-video-home.ts`
- `npm run verify:day-pilot-home`
- `node --check tools/verify-today-pilot-home-e2e.mjs`
- `npm start` 首次成功编译后停止 watcher
- `npm run verify:today-pilot-home:e2e`
- `git diff --check -- src/meeting-shell/meetingSidePanel.tsx tools/verify-today-pilot-video-home.ts docs/features/today_pilot.md docs/features/index.md .planning/2026-06-24-automation-meeting-handoff-match-receipt/plan.md`
