# 四通道召回：证据通道交叉回执

## 目标

从 `docs/index.md` 随机选中 `四通道召回`。本轮不改 `RecallEngine` 检索、排序或写入路径，只优化搜索结果页里用户理解召回证据的路径。

## 现状

- `RecallEngine` 已返回 `channelDiagnostics`，搜索结果页已有 `召回通道回执`，能说明 vector / FTS / graph / time 的命中、空、跳过和失败状态。
- 每条结果卡片已有通道 chip，但用户需要逐条扫描，才能判断同一条证据是否被多个通道共同找回。
- Reminder 检查：AppleScript 未列出 `Personal AI`；EventKit 能读取该列表，4 条均已完成，内容为历史 Doubao / digest / sync 反馈，和本轮四通道召回无关。

## 行业与研究信号

- Azure AI Search hybrid search 把 full-text 和 vector 并行检索后融合为统一结果集，支持把多路径召回作为结果可信度解释的一部分。
- Microsoft 365 Copilot Semantic Index 结合 lexical、semantic、Microsoft Graph 关系和访问边界，说明关系/权限/语义不是单一总分。
- GraphRAG 与 RAPTOR 研究都说明关系结构和摘要层能补足平面 chunk 检索，用户需要知道证据来自哪些检索路径。

## 实现计划

1. 在 `searchResultPresentation.ts` 增加 `formatEvidenceChannelOverlapReceipt()`，按当前可见结果统计多通道、单通道、未标明通道和最常见交叉组合。
2. 在 `SearchResultPage.vue` 的召回通道回执之后渲染 `证据通道交叉回执`，并跟随本地类型筛选后的 `filteredResults` 更新。
3. 扩展 `verify-memory-search-results` 和 `verify-memory-search-scope:e2e`，覆盖 helper 输出、真实页面呈现和无副作用边界。
4. 更新 `docs/memory_system.md`，记录该回执只是本地可见结果摘要，不重新召回、重排、写反馈或确认事实。

## 验证

- `npm run verify:memory-search-results`
- `node --check tools/verify-memory-search-scope-e2e.mjs`
- `node --check tools/verify-memory-search-results.ts`
- `npm start -- --progress` 首次成功编译后停止 watcher
- `npm run verify:memory-search-scope:e2e`
- scoped `git diff --check`
