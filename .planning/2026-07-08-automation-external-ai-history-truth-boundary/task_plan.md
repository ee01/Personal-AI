# 外部 AI 历史基础录入事实边界计划

更新时间: 2026-07-08T16:04:09+0800

## 目标功能

- 随机抽中: `外部 AI 历史基础录入`
- 所属能力: Memory Coverage Map
- 主文档: `docs/features/memory_coverage_map.md`
- 主要代码: `src/modals/components/MemoryCoveragePage.vue`
- 验证入口: `tools/verify-memory-coverage-e2e.mjs`

## 当前状态

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 本机 EventKit 可读取 `Personal AI` Reminders 列表，4 条均为已完成历史 Doubao / Notification / test 反馈，没有未完成且相关的外部 AI 历史导入反馈。
- 现有 UI 已覆盖外部 AI dry-run、提交前、提交中、提交完成和重复导入边界。
- 未完成项里 Gemini / Takeout 格式支持、高价值导入资料晋升候选都需要格式和策略决策，本轮不直接实现。

## 外部研究信号

- OpenAI ChatGPT 数据导出是用户主动请求的 zip，链接有时效，包含 chat history 和相关账户数据。
- Anthropic Claude 数据导出同样是用户主动从 Privacy 设置触发，个人账户导出包含 conversation data，但官方不支持把该导出导入另一个个人 Claude 账户。
- Opal / private personal AI memory 研究强调长期个人记忆会集中敏感个人活动数据，导入和检索路径需要清楚的隐私与访问边界。
- 长期记忆研究和 LongMemEval 类 benchmark 都把 indexing、retrieval、reading 分开看；导入历史对话只是进入索引候选，不等于旧 assistant 回答已经被确认成事实。

## 发现的 UX 缺口

外部 AI 历史导入页面已经说明 `manual shadow memory`、不会外发、不会直接升级为 confirmed 画像/skill/项目事实，但缺少一个更直接的用户心智边界：

- 旧对话里有用户原话，也有旧 AI assistant 的回答。
- 导入旧 assistant 回答只是在保留对话证据，不应该被理解为事实确认、用户观点确认或当前项目事实。
- 当用户点击提交后，等待中和完成回执也应继续保留这个事实边界，避免写入成功被误读成事实晋升成功。

## 实施计划

1. 在 `MemoryCoveragePage.vue` 的外部 AI 提交前回执里新增 `事实边界` 行，说明用户原话与旧 assistant 回答都只是对话证据，后续 Ask/Profile/Skill/Project 仍需各自证据门控。
2. 在提交中回执里同步保留事实边界，说明服务端确认成功前后都不会把旧 assistant 回答直接当事实。
3. 在完成回执里扩展外部 AI 边界，让 batch/source 审计路径和事实边界同时可见。
4. 更新 `tools/verify-memory-coverage-e2e.mjs`，断言提交前、提交中、完成三个阶段都能看到事实边界。
5. 更新 `docs/features/memory_coverage_map.md` 和 `docs/index.md` 的简要描述。
6. 跑目标验证: `node --check tools/verify-memory-coverage-e2e.mjs`、`npm start` 首次成功编译、`npm run verify:memory-coverage:e2e`、相关 memory-service import/coverage 测试，以及 scoped `git diff --check`。

## 非目标

- 不改外部 AI zip 解析、会话截断、source hash 去重、commit API、Memory Service 写入 schema、coverage 聚合、Gemini/Takeout 支持或资料晋升策略。
- 不标记任何 Reminder done，因为没有相关未完成 Reminder。
