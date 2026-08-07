# 搜索反馈点击前边界

## 目标

随机目标：`搜索结果有用/不相关反馈`，所属 `Memory Exploring`，文档源是 `docs/memory_system.md`。

## 现状

- 搜索结果卡片已经支持 `有用` / `不相关` / `撤销`。
- `/feedback` 请求会携带 target type、query、scope、结果序号和安全来源边界。
- 成功后会显示服务端实际效果；失败后会恢复点击前状态并显示未写入回执。
- 缺口在点击前：中性卡片只显示按钮，用户还不知道 `不相关` 可能创建相近场景修正，也不知道反馈不会删除记忆、外发、同步或立即改写当前结果。

## 改进计划

1. 在可反馈的搜索结果卡片上增加点击前 `反馈范围` 回执。
2. 回执复用当前 query、scope、surface 和 target type，说明本次反馈绑定的是哪次搜索现场。
3. 提前说明正向反馈、负向反馈和撤销的写入边界：只写 Memory Service 召回质量信号，不删除记忆、不发送、不同步外部系统、不立即重排当前页面。
4. 更新 `tools/verify-memory-search-feedback-e2e.mjs`，断言提交前就能看到该边界。
5. 更新 `docs/memory_system.md`，保持功能文档与当前行为一致。

## 验证

- `npm run verify:memory-search-results`
- `npm start` 首次成功编译后停止
- `npm run verify:memory-search-feedback:e2e`
- `git diff --check -- docs/memory_system.md src/modals/components/SearchResultPage.vue tools/verify-memory-search-feedback-e2e.mjs .planning/2026-06-20-automation-search-feedback-preclick-boundary/plan.md`
