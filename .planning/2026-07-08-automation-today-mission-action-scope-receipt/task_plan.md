# Today Mission 操作范围回执计划

## 目标

随机选中 `docs/index.md` 中的 `今天 Mission`。本轮只做一个窄的 UX 修复：Today Pilot 首页 mission 展开后，在反馈/复制/打开详情按钮前显示操作范围回执，让用户在点击前知道哪些动作只写 Today Pilot 展示/排序反馈，哪些只是本机剪贴板或导航，不会完成来源任务、标已读、改排程、发送或执行外部动作。

## 依据

- `docs/progressing/to-verify.md` 为空。
- 自动化记忆中最近 exact feature 覆盖了 Source Memory、Native Join、Relationship Radar、Message Analysis、Coverage、Outreach 等；本轮避开这些 exact surface。
- Reminders: EventKit 读到 `Personal AI` 清单，4 条全为已完成历史 Doubao / Notification 反馈，未完成为 0；没有 Today Mission 相关条目需要合并或标记 done。
- 外部产品/研究信号：
  - Microsoft Plan My Day 强调 30 秒可扫、Top 3-5 优先级、direct links 和 actionable context。
  - Gemini Daily Brief 支持查看来源、mark complete / dismiss / feedback，但这些动作需要被理解为 brief 个性化/进度信号。
  - AI-powered reminders 与 proactive agents 研究强调主动提醒要聚合、抑制噪声、保留用户控制，并避免主动系统显得越权或打扰。

## 实施步骤

1. 在 `OverviewPage.vue` 的 mission 展开态按钮区前增加 `操作前回执`。
2. 回执按当前卡片区分普通卡与 OpenClaw 外部执行卡：
   - 普通卡：完成/稍后/不再提醒同类只写 Today Pilot 反馈；复制只写本机剪贴板；打开详情只是导航。
   - OpenClaw 卡：从首页移除不代表批准/拒绝/执行；真正处理必须去动作队列或决策中心。
3. 补充样式，保持紧凑，不改排序、反馈 API、context pack、后端逻辑。
4. 更新 `tools/verify-today-pilot-home-e2e.mjs`，覆盖普通卡和 OpenClaw 卡的预操作回执。
5. 更新 `docs/features/today_pilot.md` 和 `docs/index.md` 的简短说明。
6. 验证：`verify:day-pilot-home` -> `npm start` 首次成功编译 -> `verify:today-pilot-home:e2e` -> scoped `git diff --check`。

