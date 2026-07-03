# 画像快速校准进行中回执 Plan

## 目标功能

- 随机目标: `画像快速增强/降低影响`
- 所属能力: User Profile
- Source of truth: `docs/features/user_profile_system.md`

## Reminder 检查

- 本机 Reminders 可访问。
- `Personal AI` 列表不存在，本轮没有可合并或可标记完成的 Reminder item。

## 外部参照

- OpenAI ChatGPT Memory FAQ / Dreaming: 记忆控制需要可查看、可删除、可关闭，并把聊天删除和记忆删除边界拆开。
- Anthropic Claude memory: 管理页直接显示 Claude 记住了什么，并支持查看/编辑。
- Google Gemini personalization / Privacy Hub: 个性化来源包括聊天记忆、连接应用内容和用户指令；保存信息持续到用户删除。
- Response-Aware User Memory Selection (RUMS, 2026): 个性化记忆应该按对响应质量的实际效用选择，而不是只按相似度或全量注入。

## 需要改进的 UX 缺口

当前页面已经在按钮旁展示“校准影响”说明，后端返回后也会显示画像校准回执。但点击“设为重点 / 降低影响”后，在请求未完成期间只有行级 `处理中` 和乐观更新，旧回执可能仍留在页面上。真实用户无法立刻确认这次正在改哪一条、会不会同时确认、是否已经进入个性化上下文、以及是否有外发/同步等副作用。

## 实现计划

1. 在 `UserProfilePage.vue` 增加进行中画像校准回执，点击快速校准或星级校准后立刻显示。
2. 回执需包含目标条目、目标影响力、是否会尝试确认、是否仍待确认、证据保留和无外发/同步/恢复/删除边界。
3. 保持现有成功、部分成功、失败和刷新逻辑不变；失败时不把 pending 回执误报为完成。
4. 在 `tools/verify-user-profile-export-e2e.mjs` 增加慢请求 fixture，验证 pending 回执先出现，且后续成功回执替换它。
5. 更新 `docs/features/user_profile_system.md` 的快速校准说明和验证指引。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `npm --prefix memory-service test -- --run src/__tests__/api-profile.test.ts src/__tests__/api-ingest-profile.test.ts`
- `npm start` 等首次成功编译后停止。
- `node tools/verify-user-profile-export-e2e.mjs`
- `git diff --check` 限定本轮触碰文件。
