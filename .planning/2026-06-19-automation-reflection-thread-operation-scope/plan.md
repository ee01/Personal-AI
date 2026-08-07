# 自我反思线程操作范围回执

## 目标

- 随机目标：`自我反思线程`（Memory Service / `memory_system.md`）。
- 用户路径：用户打开反思线程详情后，顶部有 `立即自我反思`、`暂停`、`恢复`、`关闭` 等按钮，但点击前不容易判断这次会写入什么、是否会外发、是否会恢复自动推进。
- Reminder 状态：本机 Reminders 可访问，但没有 `Personal AI` 列表；本轮没有可纳入或标记完成的 Reminder item。

## 外部参考

- OpenAI Dreaming / ChatGPT memory：后台综合记忆需要可见摘要、可更新和可纠正的控制面。
- Claude chat search and memory / Claude memory tool：跨会话记忆和 just-in-time recall 要保留可见范围、工具调用和用户控制。
- Generative Agents / Reflexion：reflection 可以把经验和反馈沉淀成后续决策输入，但产品层需要暴露证据、失败和执行边界。

## 改进 Plan

1. 保持反思运行和动作队列后端语义不变，只在前端派生操作范围说明。
2. 在 `reflectionThreadPresentation.ts` 增加 `buildReflectionOperationScopeReceipt()`，根据 thread 状态、动作、研究补查和主动询问读取状态生成标题、写入范围、边界和恢复路径。
3. 在 `ReflectionThreadDetail.vue` 顶部详情布局第一行显示 `本次操作范围`，让用户点击按钮前先看到：手动反思只写 run / trace /候选动作，不直接发送、确认、执行 OpenClaw 或写 confirmed profile；暂停/关闭/恢复只改线程推进状态，不删除证据。
4. 更新 `docs/memory_system.md` 和 `docs/index.md`，把这个行为记录到当前自我反思 source of truth。
5. 扩展 `tools/verify-reflection-research-e2e.mjs` 覆盖操作范围回执，然后跑 targeted E2E、`npm start` 首次编译、scoped `git diff --check`。

## 非目标

- 不改 `ReflectionThreadService.runReflection()` 的 force/manual 语义。
- 不新增人工 review 队列。
- 不把反思线程操作改成外部执行或确认路径。
