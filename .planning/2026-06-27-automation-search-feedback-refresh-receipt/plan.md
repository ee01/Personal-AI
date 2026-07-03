# 搜索反馈后续取证回执 Plan

## 目标功能

- 随机目标：`搜索结果有用/不相关反馈`
- 所属能力：Memory Exploring / Memory Service
- Source of truth：`docs/features/memory_system.md`

## 已核对现状

- `docs/progressing/to-verify.md` 暂无待校验事项。
- 本机 Reminders 列表可读取，但没有 `Personal AI` 列表，本轮没有可合并或完成的 Reminder item。
- 既有文档已经覆盖点击前范围、服务端效果、失败回滚、query/结果序号诊断和“不会删除/外发/同步/确认答案/立即重排当前页”边界。
- 当前 UX 缺口：反馈成功后虽然说明“只影响后续召回排序”，但卡片留在原位，用户没有一个就地路径用同一 query/scope 重新取证据来观察后续排序是否变化。

## 外部参考

- Google Agent Search user events 把 search/view-item 等行为与 query、document identity、attribution token 绑定，说明搜索反馈需要保留结果身份和查询上下文。
- OpenAI Memory FAQ 的 Memory Sources 提供 relevant / not relevant 反馈并保留可管理入口，支持反馈后仍让用户可查看和纠正。
- Stanford IR book 的 Rocchio relevance feedback 说明相关/不相关样本用于下一轮检索，而非让当前已展示列表自动变成真相。
- Pistis-RAG 强调 human feedback 可直接优化内容排序和 retrieval 机制，支持把这次反馈做成后续取证信号。

## 实施计划

1. 在 `SearchResultPage.vue` 的成功反馈回执里增加“当前页未重排，重新取证后会按同一 query/scope 请求 Memory Service”的后续路径。
2. 增加一个卡片内 `重新取证` 按钮，只在反馈成功回执出现时渲染；失败回执不显示，避免把未写入反馈当成可复查状态。
3. 按当前搜索模式复用 `performAskSearch` / `performEntityVectorSearch`，保留 URL 的 `q` 和 `scope`，不改变 feedback API、存储或排序语义。
4. 更新 `verify-memory-search-feedback-e2e.mjs`，断言成功反馈后的后续取证按钮和点击后的同 scope/query 新请求。
5. 更新 `docs/features/memory_system.md`，补充反馈后重新取证路径。

## 验证计划

- `node --check tools/verify-memory-search-feedback-e2e.mjs`
- `npm start` 等待首次成功编译后停止
- `npm run verify:memory-search-feedback:e2e`
- scoped `git diff --check`

