# 搜索反馈服务端效果回执

## 目标

随机抽中的功能是 `搜索结果有用/不相关反馈`，所属 `Memory Exploring`，source of truth 是 `docs/features/memory_system.md`。现有实现已经支持有用 / 不相关 / 撤销、按 `targetType` 提交、恢复按钮状态和范围回执；本轮只补用户点击后的服务端效果可见性。

## 外部参照

- Glean / Microsoft Search 这类企业搜索反馈都把结果页内的反馈绑定 query、结果和诊断上下文。
- Algolia analytics 强调 query / object identity，否则反馈无法安全用于排序。
- Stanford IR Book 的 relevance feedback 章节和 Rocchio 相关研究都说明显式正负样本可以改进检索，但一次负反馈不应被解释成全局删除。
- Microsoft 人本 LLM eval 文章提醒只做 thumbs up/down 不够，反馈应该解释为什么有用或为什么失败。

## 问题

用户点完反馈后，卡片只显示“已记录为有用 / 不相关 / 已撤销”。服务端实际会返回 `appliedDelta`、`previousAction` 和 `relevancePatch`，能说明这次是：

- 创建了 scene-aware relevance patch；
- 只调整了后续排序显著性；
- 回滚了上一次反馈；
- 或清除了已有 patch。

这些信息没有进入 UI，用户仍需要猜测“不相关”到底是删掉了记忆、全局降权，还是只影响相近场景。

## 实施计划

1. 在 `SearchResultPage.vue` 保存每张结果卡最新 `/feedback` 响应的 effect summary。
2. 扩展反馈回执文案，展示服务端实际动作：patch created/cleared、显著性实际变化、是否没有做全局降权。
3. 更新 `verify-memory-search-feedback-e2e.mjs`，覆盖有用、不相关、撤销三种点击后的服务端效果文案。
4. 补充 `api-feedback.test.ts` 对 scene-aware negative feedback `appliedDelta=0` 的断言。
5. 更新 `docs/features/memory_system.md`，保持文档与行为同步。

## 验收

- 有用反馈显示实际提高显著性。
- 不相关反馈显示相近场景 patch，并说明是否避免全局降权。
- 撤销反馈显示清除 patch / 回滚排序信号。
- 原有 target type、防误读、撤销路径和链接安全行为不回退。
