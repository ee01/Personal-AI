# 记忆搜索结果页：结果批次基准回执

## 目标功能

- 功能点：`记忆搜索结果页`
- 所属能力：Memory Exploring
- 主文档：`docs/memory_system.md`
- 主要代码：`src/modals/components/SearchResultPage.vue`、`src/modals/searchResultPresentation.ts`

## 现状核对

- `docs/progressing/to-verify.md` 当前为空。
- 本机 Reminders 的 `Personal AI` 列表可通过 EventKit 读取，4 条均已完成；没有未完成且与搜索结果页相关的反馈。
- 当前搜索结果页已经覆盖范围请求中、真实空结果、通道诊断、证据通道交叉、类型筛选、来源覆盖、安全跳转和反馈条件快照。
- 剩余 UX 缺口：结果返回后，摘要区没有一个稳定的“这批卡片属于哪个 query / scope / 搜索模式 / 本地筛选基准”的首屏回执。连续切换 query、scope 或类型筛选时，用户只能从分散的数量、范围和筛选提示里推断批次归属。

## 外部复查

- OpenAI Memory FAQ 强调 memory sources 可见，但也说明来源视图不一定展示所有影响因素，因此本功能应避免把结果摘要包装成完整解释。
- Claude memory / past chat search 把记忆可见性、引用、关闭入口放在用户路径里，说明个人记忆搜索需要明确当前范围与控制边界。
- Glean enterprise search 强调 query context、role/projects/tools 和 filters；对应到 Personal AI，应让用户知道当前结果是哪个查询上下文的返回批次。
- `Dissecting users' needs for search result explanations` 提醒搜索解释应服务复杂/关键任务，避免显而易见的噪音；本轮只做贴着可见结果的批次基准，不做算法解释展开。
- RAG trustworthiness survey 把 transparency、accountability、privacy 列为 RAG 可信维度；本轮回执应明确只读、已返回结果、本地筛选和非事实确认边界。

## Plan

1. 新增 `formatSearchResultBatchReceipt` presentation helper，输入 query、scope、mode、类型筛选、可见/总结果数和通道诊断，输出摘要级回执。
2. 在 `SearchResultPage.vue` 的结果摘要顶部渲染 `结果批次回执`，放在来源覆盖、类型筛选和通道诊断之前。
3. 更新 `tools/verify-memory-search-results.ts` 覆盖 formatter 和页面渲染源检查。
4. 更新 `tools/verify-memory-search-scope-e2e.mjs`，确认工作范围、全部范围和类型筛选后的批次基准可见。
5. 更新 `docs/memory_system.md` 与 `docs/index.md` 的搜索结果页说明。
6. 验证：`verify-memory-search-results`、`npm start` 首次编译、`verify-memory-search-scope:e2e`、 scoped `git diff --check`。

## 非目标

- 不改变 `/ask`、`/recall`、通道诊断、排序、MMR、反馈写入、链接安全策略或 Memory Service 数据契约。
- 不新增后端 API。
- 不标记 Reminder，因为本轮没有来源于未完成 Reminder 的 idea。
