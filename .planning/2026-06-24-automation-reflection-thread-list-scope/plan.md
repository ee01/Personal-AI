# 自我反思线程列表范围回执计划

## 目标功能

- 随机目标：`自我反思线程`，所属 `Memory Service`，主文档 `docs/features/memory_system.md`。
- 本轮不改 Reflection 后端调度、run 生成、动作队列、主动询问或研究补查逻辑，只优化线程列表的查看路径。

## 现状

- 详情页已经有 `本次操作范围`、`反思推进回执` 和 `本轮研究范围`。
- 列表页每张卡有推进回执，但首屏没有说明当前筛选、搜索、梦境 handoff 只是在读 `reflection_threads` 列表快照。
- 作为用户，切换状态、输入搜索或点击刷新时容易把它理解成“全局搜索记忆”或“推进反思线程”。

## 外部参考

- OpenAI Dreaming 和 Claude chat search / memory 都把跨会话记忆做成后台综合与检索，但仍强调用户可控制、可看到查询或管理入口。
- Reflexion、Generative Agents 和 Reflective Memory Management 都支持把反思文本沉淀为后续推理输入；产品化时需要把失败、等待、证据和只读边界放在前台。
- Human-centered proactive conversational agents 研究提醒主动系统可能显得打扰，所以列表入口要先说明当前查看范围和非副作用边界。

## 实施步骤

1. 在 `ReflectionThreads.vue` 增加列表范围回执，展示状态筛选、搜索词、handoff 来源、可见/总计数和刷新边界。
2. 保持现有卡片级推进回执，不改变 list API 参数、路由、状态机或详情页操作。
3. 更新 `tools/verify-reflection-research-e2e.mjs`，覆盖列表首屏范围回执、搜索/可见计数和刷新失败后的保留快照边界。
4. 更新 `docs/features/memory_system.md` 中自我反思线程查看说明。
5. 运行 `npm start` 首次成功编译、Reflection E2E、`git diff --check` 和进程清理。

## 验证预期

- 列表初次打开能看到 `列表查看范围`，说明当前只读快照和无写入/无推进边界。
- 失败刷新仍显示错误和上次线程，同时回执说明保留的是上次成功快照。
- E2E 从新构建的 `dist/` 打开扩展页并断言上述文案。
