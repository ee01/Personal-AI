# 搜索结果反馈失败回执改进计划

## 目标功能

- 随机选中：`搜索结果有用/不相关反馈`
- 所属能力：Memory Exploring / Memory Service
- 主文档：`docs/memory_system.md`

## 当前状态

- 搜索结果卡片已经支持 `有用`、`不相关`、`撤销`，并把 `targetType`、query、scope、结果序号和安全来源边界写入 `/feedback` detail。
- 成功后卡片会展示服务端实际效果，例如显著性变化、相近场景 relevance patch 或清除 patch。
- 缺口：提交失败时只在页面顶部显示全局错误，用户停留在当前结果卡片上时无法立刻判断这次点击是否真的写入了服务端、是否创建了 patch、是否改变显著性或删除记忆。

## 外部参考

- Glean feedback：反馈用于 review/troubleshooting，且不会直接自动 retrain，适合把写入边界讲清楚。
- Microsoft Search feedback：结果页反馈可携带 query/诊断上下文，但受反馈策略和隐私选择约束。
- EMNLP 2022 relevance-feedback reranking：显式反馈样本对 rerank 有价值，但用户反馈通常很少，需要保留解释性和样本上下文。
- Stanford IR relevance-feedback chapter：显式反馈不应增加过多交互成本，且用户往往难理解反馈后为什么结果变化。

## 实施计划

1. 在 `SearchResultPage.vue` 增加 per-result feedback failure state。
2. 失败时恢复点击前的 `有用` / `不相关` / `已撤销` / neutral 状态，并在原卡片显示 `反馈未提交`。
3. 回执明确说明未写入服务端、未创建相近场景修正、未改变显著性、未删除记忆，并保留查询现场。
4. 扩展 `verify-memory-search-feedback-e2e.mjs`，模拟 `/feedback` 503，断言失败回执和按钮状态恢复。
5. 更新 `docs/memory_system.md` 的搜索反馈段落。

## 验证计划

- `npm run verify:memory-search-results`
- `npm start` 首次成功编译后停止
- `npm run verify:memory-search-feedback:e2e`
- `git diff --check`（限定本轮触碰文件）
