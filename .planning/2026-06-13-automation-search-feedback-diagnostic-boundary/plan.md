# 搜索反馈诊断边界计划

## 目标功能

- 随机选中：`搜索结果有用/不相关反馈`
- 所属文档：`docs/memory_system.md`
- 主要代码：`src/modals/components/SearchResultPage.vue`

## 外部参考

- Glean 和 Microsoft Search 都把反馈放在搜索结果现场，并保留 query / 诊断上下文来改善搜索质量。
- Algolia Insights 要求搜索事件绑定 query/result identity，说明反馈不能只记录一个裸 target id。
- 负相关反馈研究强调 negative relevance feedback 有价值，但不能把单次负反馈扩大成不可见的全局排除。

## 改进点

1. 搜索反馈 detail 只保存安全 `http/https` 来源 URL；如果结果 URL 被 UI 隐藏，后台 detail 也只保存“未包含”的边界，不保存原始不安全 URL。
2. 搜索反馈 detail 增加 query、scope、模式、筛选、可见结果序号和结果总数，便于把反馈绑定到这次搜索现场。
3. 搜索结果卡片的反馈回执显示“本次查询 + 第几条结果”，让用户知道这次有用/不相关反馈作用于哪次搜索上下文。
4. 更新 Playwright E2E，覆盖不安全 URL 不外泄、query/rank 绑定和新回执文案。
5. 更新功能文档，记录搜索反馈的诊断上下文与来源 URL 隐私边界。

## 验证

- `node --check tools/verify-memory-search-feedback-e2e.mjs`
- `npm run verify:memory-search-feedback:e2e`
- `npm start` 首次成功编译后停止
- `git diff --check -- src/modals/components/SearchResultPage.vue tools/verify-memory-search-feedback-e2e.mjs docs/memory_system.md .planning/2026-06-13-automation-search-feedback-diagnostic-boundary/plan.md`
