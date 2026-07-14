# User Profile 已排除画像审计回执计划

运行时间: 2026-07-06T23:04:36+0800

## 目标

随机目标: `用户画像条目`，文档: `docs/features/user_profile_system.md`。

本轮只处理 User Profile item 管理路径中的已排除画像审计，不改导出、画像写入、确认、排除、恢复或后端语义。

## 现状

- `docs/progressing/to-verify.md` 为空，可以选新功能。
- AppleScript 未列出 `Personal AI` Reminder；EventKit 找到该列表，有 4 条历史项目且全部 completed，均为 Doubao / Notification / test 相关，和用户画像条目无关。
- 页面已有手动录入、确认、排除、恢复、影响力校准和导出回执。
- 缺口: `查看已排除` 请求失败时，面板保持打开且 `retractedProfileItems.length === 0`，会显示 `暂无已排除画像条目`。这会把读取失败伪装成全库没有 retracted profile items。

## 外部参照

- ChatGPT Memory Sources 强调用户能看到、编辑、删除相关 memory/source，并对来源做 relevant / not relevant 反馈: https://help.openai.com/articles/8590148-memory-faq
- Claude memory import/export 和 `View and edit your memory` 强调把 AI 看到的记忆显式呈现给用户审计: https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude
- Gemini Personal Context / Keep Activity 把个性化来源、活动删除和临时聊天分开控制: https://support.google.com/gemini/answer/16598623
- Microsoft Research RUMS 说明 profile/memory 选择应按响应效用筛选，不应把所有相似画像都直接注入: https://www.microsoft.com/en-us/research/publication/response-aware-user-memory-selection-for-llm-personalization/

## 改进计划

1. 在 User Profile 页增加 `已排除审计回执` 状态，区分加载中、成功、失败和空快照。
2. 失败时不再显示 `暂无已排除画像条目`，而显示 `已排除画像读取失败`，说明当前只是旧快照/空快照，不能证明没有 retracted 画像。
3. 成功读取时显示 `status=retracted`、返回数量、当前快照只读、不确认/恢复/导出/写入 USER_CORE 的边界。
4. 更新 `tools/verify-user-profile-export-e2e.mjs`，覆盖读取失败不误报为空、成功快照回执、空快照回执。
5. 更新 `docs/features/user_profile_system.md` 和 `docs/features/index.md`，保持文档精简。
6. 验证: `node --check`、`npm run verify:user-profile-system`、`npm start` 首次编译、`node tools/verify-user-profile-export-e2e.mjs`、 scoped `git diff --check`。
