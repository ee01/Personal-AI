# 周报与 Dream Digest 手动推送回执优化计划

## 目标

从 `docs/features/index.md` 随机巡检中选中 Notification Center 的 `周报与梦境摘要推送`。本轮只做一个低决策、可验证的 UX 改进：当手动推送已经生成摘要但 Bot 或 notice 投递未完整成功时，Options 页面必须第一眼显示为“部分完成/需留意”，而不是纯成功。

## Plan

| 步骤 | 状态 | 内容 |
| --- | --- | --- |
| 1 | completed | 读取 automation memory、`AGENT.md`、`docs/progressing/to-verify.md`、功能索引和 Reminder 列表 |
| 2 | completed | 选中 `周报与梦境摘要推送`，检查 `notification_center.md`、`src/options.tsx`、weekly/dream 后端和现有 E2E |
| 3 | completed | 检索 Apple / Microsoft / notification batching / intelligent notification management 相关资料 |
| 4 | completed | 实现 Options 手动推送回执的部分失败状态、样式和 E2E 断言 |
| 5 | completed | 更新 `docs/features/notification_center.md` 的当前行为说明 |
| 6 | completed | 运行 targeted test、`npm start` 首次编译、Options E2E、周报落点 E2E 和 diff check |
| 7 | completed | 更新 automation memory 并总结 |

## 决策

- Reminder 中没有 `Personal AI` 列表，本轮没有可纳入或可完成的 Reminder item。
- 当前仓库已有大量未提交改动，本轮不回滚、不重排，只在现有周报 / Dream Digest 手动回执上追加最小状态判断。
- 外部参考的共同信号是：摘要通知要减少打扰，但要保留目标、投递状态、失败恢复和用户控制的可见性。

## 风险

- `src/options.tsx` 已有许多未提交改动，补丁必须只改 `renderDigestManualPushReceipt` 附近。
- E2E 要断言语义和 class，而不是依赖整段长文案。

## 验证结果

- `node --check tools/verify-notification-digest-push-options-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/weeklyReporter.test.ts`
- `npm start` 首次 webpack dev compile 成功后已停止
- `npm run verify:notification-digest-push-options:e2e`
- `node tools/verify-weekly-report-notification-e2e.mjs`
- `git diff --check -- src/options.tsx tools/verify-notification-digest-push-options-e2e.mjs docs/features/notification_center.md .planning/2026-06-26-automation-weekly-digest-partial-receipt/task_plan.md .planning/2026-06-26-automation-weekly-digest-partial-receipt/findings.md .planning/2026-06-26-automation-weekly-digest-partial-receipt/progress.md`
- `rg -n "[ \t]$" tools/verify-notification-digest-push-options-e2e.mjs .planning/2026-06-26-automation-weekly-digest-partial-receipt`
- `rg -n "<<<<<<<|=======|>>>>>>>" src/options.tsx tools/verify-notification-digest-push-options-e2e.mjs docs/features/notification_center.md .planning/2026-06-26-automation-weekly-digest-partial-receipt`
