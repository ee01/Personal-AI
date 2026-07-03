# 工作/个人/全部范围语义改进计划

## 目标

本轮随机目标是 `工作/个人/全部范围语义`。现有后端和搜索结果页已经支持 `work` / `personal` / `all`，但用户在点击范围 segmented control 前看不到本次切换到底会重新读取哪个生活域，也看不到“范围切换只是重新召回，不会写入/删除/同步/确认答案”的边界。

## 代码观察

- `src/modals/memory-exploring.vue` 已经规范化旧 `scope=both` 为 `all`，并在搜索页切换范围时重新执行当前搜索。
- `src/modals/components/SearchResultPage.vue` 已经在结果摘要里显示范围分布和搜索全部入口。
- `tools/verify-memory-search-scope-e2e.mjs` 已经覆盖 work / all / personal / legacy both 的请求 scope 和结果回执，适合扩展断言。
- 本机 Reminders 可访问，但没有 `Personal AI` 列表，本轮无 Reminder item 可纳入或标记完成。

## 外部参考

- ChatGPT Memory 把 saved memories 和 chat history memory 分开，并提供设置和删除入口。
- Claude chat search / memory 把普通聊天、project conversations 和 incognito chat 的检索边界分开。
- Microsoft 365 Copilot semantic index 强调 Microsoft Graph、tenant 边界和 RBAC 权限。
- Personal information management 研究把个人信息活动放在工作、个人角色和情境中理解，支持在检索前暴露上下文范围。

## 实施步骤

1. 在 Memory Exploring 搜索头部下方增加 `搜索范围意图` receipt。
2. Receipt 根据 `selectedRecallScope` 显示工作、个人或全部的读范围、排除范围和无副作用边界。
3. 当当前页面已有可搜索 query 且位于搜索结果页时，说明切换范围会立即重跑当前搜索并同步 URL；否则说明输入查询后才按该范围读取。
4. 更新中文/英文 i18n 文案。
5. 扩展 `verify-memory-search-scope-e2e.mjs`，验证 Work、All、Personal 和 legacy `both` 路由下 receipt 文案。
6. 更新 `docs/features/memory_system.md` 和 `docs/features/index.md`。

## 验证

- `npm run verify:memory-search-results`
- `npm start` 等待首次 successful compile 后停止
- `npm run verify:memory-search-scope:e2e`
- scoped `git diff --check`
