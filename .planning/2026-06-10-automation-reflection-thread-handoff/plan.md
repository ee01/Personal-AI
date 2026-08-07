# 自我反思线程 handoff receipt plan

## 目标

随机抽中的功能是 `自我反思线程`（`docs/memory_system.md`）。这次只改一个可验证的 UX 问题：线程列表和详情页能看到状态、下次时间、动作队列和研究记录，但用户不能快速判断系统接下来会不会自动推进、正在等谁、以及失败时应该从哪里恢复。

## 外部参考

- OpenAI Memory / ChatGPT Memory controls: 记忆会自动更新，但用户需要能看到、管理和关闭记忆。
- LangGraph long-term memory: 背景写入能降低主路径延迟，但必须说明触发频率、命名空间和写入边界。
- Generative Agents / Reflexion / ReAP: reflection loop 的价值在于从经验、反馈和失败轨迹中沉淀可复用记忆；产品上要把证据、失败和下一步显示出来，避免把后台推理变成黑盒。

## 实现计划

1. 新增 `src/modals/reflectionThreadPresentation.ts`，从 `ReflectionThread`、动作、研究查询、主动询问加载状态推导 `反思推进回执`。
2. 在线程列表卡片展示 compact 版回执，让用户不用进入详情也能看到是否等待/可继续/需修复。
3. 在线程详情 hero 下方展示完整回执，说明下一步、自动边界和恢复入口。
4. 扩展 `tools/verify-reflection-research-e2e.mjs` fixture，覆盖等待主动询问、研究失败、列表回执和详情回执。
5. 更新 `docs/memory_system.md` 的自我反思说明。
6. 验证：`npm --prefix memory-service test -- --run src/__tests__/reflectionThreadService.test.ts src/__tests__/reflectionResearcher.test.ts`、`npm start` 首次编译、`npm run verify:reflection-research:e2e`、`git diff --check`。
