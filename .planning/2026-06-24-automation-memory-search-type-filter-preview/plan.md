# 记忆搜索结果页类型筛选预览计划

## 目标功能

- 随机目标：`记忆搜索结果页`
- 所属能力：Memory Exploring / Memory Service
- 主文档：`docs/features/memory_system.md`

## 当前状态

- 搜索结果页已经显示查询范围、工作/个人命中拆分、召回通道回执、来源覆盖回执和类型筛选后的本地筛选回执。
- 类型筛选按钮目前只显示服务端返回的各类型总数，例如 `片段 (1)`；用户需要点击后才知道这个本地筛选会显示多少、隐藏多少，以及不会重新召回或写反馈。
- Reminder 检查可访问，但本机 Reminders 没有 `Personal AI` 列表，本轮没有可纳入或可标记完成的 Reminder 项。

## 外部参考

- Notion Enterprise Search 强调跨工作区与连接应用搜索时要保留来源引用，并允许调整搜索范围：https://www.notion.com/help/enterprise-search
- Google Drive search chips 支持按类型、人员、修改时间等条件逐步缩窄结果，并且 filter chip 可以和查询词叠加：https://support.google.com/drive/answer/2375114
- Exploratory Search 研究把搜索从单次 query-response 扩展到学习、比较和调查；结果页需要提供可浏览的局部线索，而不是只给一个最终列表：https://dl.acm.org/doi/10.1145/1121949.1121979

## 改进计划

1. 给类型筛选按钮增加点击前预览：`点击显示 N/M · 隐藏 K`，当前筛选则显示 `当前显示 N/M`。
2. 在按钮 `title` / `aria-label` 中说明这是本地筛选，不会重新召回、重排、写反馈或隐藏服务端结果。
3. 把提示格式抽到 `searchResultPresentation.ts`，用现有 `verify-memory-search-results` 覆盖边界文本。
4. 更新 `verify-memory-search-scope-e2e.mjs`，证明真实扩展页里按钮点击前和点击后都有正确预览。
5. 更新 `docs/features/memory_system.md` 和 `docs/features/index.md` 的简要描述，避免文档落后。

## 验证

- `npm run verify:memory-search-results`
- `npm start` 首次 successful compile 后停止
- `npm run verify:memory-search-scope:e2e`
- `git diff --check -- src/modals/components/SearchResultPage.vue src/modals/searchResultPresentation.ts tools/verify-memory-search-results.ts tools/verify-memory-search-scope-e2e.mjs docs/features/memory_system.md docs/features/index.md .planning/2026-06-24-automation-memory-search-type-filter-preview/plan.md`
