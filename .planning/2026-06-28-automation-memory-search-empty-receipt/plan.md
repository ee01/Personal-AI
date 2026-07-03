# 记忆搜索空结果回执

## 目标

让 Memory Exploring 的搜索结果页在真实后端返回 0 条结果时，仍然说明本轮搜索已经发生、使用了哪个范围、哪些召回通道参与或未参与，以及当前页面没有写入、同步、反馈或确认事实。

## 用户问题

- 空状态只提示“切换范围或换关键词”，用户无法判断是没搜到、后端失败、范围太窄，还是索引/通道没有覆盖。
- 有结果路径已经有范围、来源、通道和链接安全回执；空结果路径没有同等边界，容易成为信任断点。

## 外部参照

- ChatGPT Memory 和 Claude chat search 都强调记忆/历史搜索的用户可控范围和可关闭边界。
- Notion Enterprise Search 强调只搜索用户有权限的来源，并让用户控制搜索范围。
- RAG sufficient-context / selective answering 研究提醒，检索相关不等于证据足够；空结果应显式说明证据不足与恢复路径，而不是暗示系统已证明“没有相关记忆”。

## 实施步骤

1. 在 `searchResultPresentation.ts` 增加空结果回执 formatter，复用现有 scope label 和 recall channel formatter。
2. 在 `memory-store.ts` 为 Ask / recall 的成功空返回保留 `emptyResult` 元数据；失败仍走现有 `searchFailureReceipt`。
3. 在 `SearchResultPage.vue` 空状态渲染“空结果回执”、通道诊断和恢复建议，不改变搜索/排序/反馈行为。
4. 更新 `docs/features/memory_system.md` 的搜索结果页说明。
5. 扩展 `tools/verify-memory-search-results.ts` 与 `tools/verify-memory-search-scope-e2e.mjs`，再运行 dev build 和 scoped diff check。
