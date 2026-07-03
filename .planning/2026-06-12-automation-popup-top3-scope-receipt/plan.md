# Popup Top 3 筛选口径回执改进计划

## 目标功能

随机抽中的功能：`Popup Top 3`，所属 `Today Pilot`，文档：`docs/features/today_pilot.md`。

## 当前判断

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有需要继续的 carry-over。
- 本机 Reminders 可列出普通列表，但没有 `Personal AI` 列表，因此本轮没有 Reminder 条目可纳入或标记完成。
- 代码里 popup 已经使用 `getTodayPilotToday(autoGenerate: true)`，只展示未 done/muted 的前三张 card；card 折叠态已有标题、`你要做`、`为什么出现`、证据数和信心值。
- 反馈失败会恢复原卡片，context pack 复制也有 evidence/redaction/truncation 回执。
- 缺口：popup 只显示三张卡，缺少首页已有的“筛选口径 / 提醒预算”解释。用户无法判断 Top 3 是从多少卡里截取、是否占用提醒预算、有没有低行动/重复信号被降噪。

## 外部参考结论

- Copilot/Gemini 类每日简报强调优先事项、日历/邮件来源和低频快照，适合在首屏给出来源/范围感。
- 提醒和通知研究强调低打扰、可预测、可恢复；Top 3 应说明它只是当前筛选结果，不等于所有同步内容。
- RAG/context handoff 研究强调来源覆盖和截断/范围说明；popup copy 已有 context pack 回执，这次补的是列表级 coverage/budget 回执。

## 实施步骤

1. 在 `src/popup.tsx` 保存 `brief` 级摘要状态，加载 Today Pilot 时从 response.brief 计算 popup 筛选回执。
2. 回执内容包括：展示数量/总 card 数、原始扫描信号、入选证据数、被降噪或未入选的数量、提醒预算使用量和边界说明。
3. 在 popup Today Pilot header 下方渲染紧凑 `筛选口径` 条，API 失败或无 brief 时隐藏，避免误导。
4. 更新 `tools/verify-day-pilot-home.ts` 的静态断言。
5. 扩展 `tools/verify-today-pilot-home-e2e.mjs`，在 popup 场景断言回执可见且外部执行卡仍只提供处理入口。
6. 更新 `docs/features/today_pilot.md`，说明 popup 也显示筛选口径和提醒预算边界。
7. 跑 Today Pilot 静态验证、dev build、E2E、相关 memory-service 测试和 `git diff --check`。
