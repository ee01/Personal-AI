# 自我反思线程操作回执改进计划

## 目标

本轮随机抽中 `自我反思线程`。目标不是扩大反思算法，而是修复真实用户在 Reflection Threads 页面会遇到的状态不确定感：刷新列表时旧线程不应突然被 loading 遮住；点击立即自我反思、暂停、恢复或关闭后，页面应明确说明 Memory Service 到底确认了什么，以及哪些外部副作用没有发生。

## 外部扫描结论

- OpenAI Dreaming 把后台记忆整理用于保持偏好和事实新鲜，但也强调记忆控制和可管理入口。
- Claude chat search / memory 把跨会话检索、工具调用和开关控制放到用户能看到的位置。
- Claude Memory tool 和 Cloudflare Agent Memory 都把长期 agent memory 当成可查询、可保留、可导出的运行状态，而不是只在上下文里隐式变化。
- Reflexion、Generative Agents 和 Reflective Memory Management 都支持把 reflection 作为长期决策输入；产品层需要额外暴露失败、等待和操作结果，否则用户无法判断反思是否真的运行。

## 实施步骤

1. 列表页刷新中保留上次成功快照，新增刷新中边界回执，避免用户把 loading 误读成线程被清空。
2. 详情页新增操作结果回执：手动反思显示 run id 和候选动作数量；暂停/恢复/关闭显示确认后的线程状态。
3. 成功回执统一写明不会发送消息、确认决策、执行 OpenClaw、写 confirmed profile 或删除原始证据；失败仍显示错误。
4. 更新 `tools/verify-reflection-research-e2e.mjs`，覆盖手动反思、暂停、恢复和列表刷新中旧快照保留。
5. 更新 `docs/features/memory_system.md`，只记录用户可感知边界。

## 验证计划

- `npm --prefix memory-service test -- --run src/__tests__/reflectionThreadService.test.ts src/__tests__/reflectionPlanner.test.ts`
- `npm start` 首次成功编译后停止
- `npm run verify:reflection-research:e2e`
- scoped `git diff --check`
