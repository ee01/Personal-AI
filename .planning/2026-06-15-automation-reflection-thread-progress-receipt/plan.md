# 自我反思线程推进回执修复 Plan

## 背景

- 随机抽中功能：`自我反思线程`（`docs/memory_system.md`）。
- Reminder：本机 Reminders 可读，但没有 `Personal AI` 列表，本轮没有 Reminder item 可纳入或完成。
- 外部参照：
  - Generative Agents 和 Reflexion 都把 reflection 作为经验沉淀到后续推理的长期记忆机制。
  - LangGraph / ChatGPT Memory 的产品文档都强调后台记忆更新需要可控、可复核，并让用户看懂来源和触发边界。

## 发现的问题

`ReflectionThreadService.deferHeartbeatReflection()`、`resumeThreadsForConfirmRequest()`、`recordActionResult()` 当前复用 `ReflectionThreadRepository.updateThreadAfterRun()`。这个 repository 方法会递增 `reflection_count` 并更新 `last_reflected_at`。

这些场景实际只是：

- heartbeat 发现线程被外部委派、确认项、主动询问或手动动作阻塞；
- 确认项完成后把线程重新排到下一轮；
- 外部 action result 回流后让线程尽快继续。

它们不是一次真实的 `runReflection()`，不应该让列表/详情页显示“运行次数增加”或“刚刚反思过”。

## 实施步骤

1. 在 `ReflectionThreadRepository` 增加只更新 `next_reflection_at` / `continue_reason` / `updated_at` 的 progress-marker 方法，不改 `reflection_count` 或 `last_reflected_at`。
2. 将等待、确认恢复、action result 回流改为使用这个 progress-marker 方法；真实 `runReflection()` 继续使用 `updateThreadAfterRun()`。
3. 在 `reflectionPlanner.test.ts` 和 `reflectionThreadService.test.ts` 增加断言，锁住“等待/结果回流不计入真实运行次数”。
4. 更新 `verify-reflection-research-e2e.mjs` fixture，确保 UI 的“运行 N / 最近反思时间”仍来自真实 run。
5. 更新 `docs/memory_system.md`，把 `反思推进回执` 的计数边界写清楚。
6. 验证：memory-service targeted tests、`npm start` 首次成功编译、反思线程 E2E、`git diff --check`。
