# Storyline 会前提示隐藏回执

## 目标

从 `docs/features/index.md` 随机抽到 `Storyline 会前提示`。本轮只处理 RingCentral Video Home 会前准备里的 Storyline 入口，不改 Draft API 的生成逻辑。

## 已检查

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 自动化记忆里最近已覆盖 Skill Foundry、Compose Assist、Notification Center、Meeting History、Jira Automation Import 等，未直接重复本轮入口。
- 本机 Reminders 可读取，但没有 `Personal AI` 列表，因此没有可纳入或完成的 Reminder item。
- 代码与文档已经有 Storyline 入口回执、外发复核和 Draft 页证据校验；缺口在 `不需要` 后只隐藏条幅，没有告诉用户这只是本地 suppression。

## 外部参考

- Microsoft 365 Copilot meeting prep 强调会前把任务、文档和上下文集中到会议事件里，但仍由用户继续深挖和决策。
- Otter 的 meeting summary/action item 路径强调会议资料可被整理，但总结、行动项和后续任务需要可追溯。
- LLM meeting delegate / multi-source meeting summarization 研究提示，会议 AI 容易出现错归因、遗漏和越权感，入口和 dismiss 操作都应说明证据和副作用边界。

## Plan

1. 在 `src/contentScriptRingCentralVideoHome.ts` 里为 `storyline-dismiss` 增加本轮可见回执状态。
2. 点击 `不需要` 后显示 `Storyline 提示已隐藏`：说明只写本机 `chrome.storage.local.storylineOpportunityDismissals`，约 30 天隐藏同一 prep/source/event 的入口，不删除会前准备、证据、Draft、Meeting Pilot handoff，也不写回外部平台。
3. 扩展 `tools/verify-storyline-video-home-e2e.mjs`，断言隐藏后条幅消失但回执出现。
4. 更新 `docs/features/today_pilot.md` 和 `docs/features/memory_storyline_builder.md` 的 `不需要` 行为说明。
5. 验证：memory-service Storyline/meeting prep tests、`npm start` 首次编译、Storyline Video Home E2E、Storyline Draft E2E、`git diff --check`。
