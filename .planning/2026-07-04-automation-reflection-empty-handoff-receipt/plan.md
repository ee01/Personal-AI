# 自我反思线程空筛选回执改进计划

## 目标功能

- `docs/index.md` 随机目标：`自我反思线程`，所在文档 `docs/memory_system.md`。
- 相关页面：`memory-exploring.html#/reflection-threads` 和 `#/reflection-threads/:id`。
- 本轮不改反思 planner、worker、研究补查、动作执行或后端数据结构，只补列表页成功空结果的用户可见边界。

## Reminder 检查

- EventKit 读取到 `Personal AI` 列表 4 条，全部已完成。
- 内容集中在豆包同步、测试项、Weekly Dream Digest，没有自我反思线程相关开放反馈。
- 本轮没有 Reminder 来源项，也不需要标记 done。

## 外部参考

- Claude chat search / memory 会把跨会话搜索显示为工具调用，并提供过去聊天引用和记忆开关，说明跨会话记忆检索需要让用户看见来源与控制边界。
- ChatGPT Memory FAQ 强调 memory summary、sources、last updated 和可编辑/关闭控制，说明后台综合记忆不能只给结论，还要给来源和可管理入口。
- Reflexion 论文把语言反思写入 episodic memory buffer，用于后续试错；Generative Agents 论文把 observation、planning、reflection 分层，并证明 reflection 对长期行为可信度关键。

## 发现的问题

- 当前列表页已经有 `列表查看范围`，也能在刷新失败时保留旧快照。
- 但从 Dream Replay 进入 `#/reflection-threads?source=dream&search=...`，如果服务端成功返回 0 条，页面只显示普通空态。
- 用户无法一眼区分这是“成功空结果”，还是系统没有处理请求；也看不到这次 handoff 没有新建线程、没有运行 `manual_revisit`、没有写记忆或执行动作。

## 实施步骤

1. 在 `ReflectionThreads.vue` 增加 `emptyFilterReceipt`，仅在成功读取、无错误、无结果时显示。
2. 回执区分梦境 handoff、普通搜索和无搜索词空列表，展示请求、读取结果、边界和恢复路径。
3. 扩展 `tools/verify-reflection-research-e2e.mjs`，覆盖 `source=dream&search=Project Cedar` 的 0 结果回执。
4. 在 `docs/memory_system.md` 的自我反思列表段落补充该行为。
5. 跑 `node --check`、`npm start` 首次成功编译、`verify:reflection-research:e2e` 和 scoped `git diff --check`。

## 验收标准

- 初始加载仍只显示 loading，不同时显示空态。
- 梦境 handoff 0 命中时显示 `筛选未命中回执`，包含请求来源、搜索词、0 结果、无副作用边界和清筛选恢复路径。
- 现有非空列表、刷新失败保留旧快照、详情页研究补查回执不回退。
