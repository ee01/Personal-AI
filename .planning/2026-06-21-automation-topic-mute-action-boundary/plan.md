# Topic Mute Action Boundary

目标：补齐 Topic Messages 列表静音入口的操作边界，让用户在点击前后都能确认静音只是本机降噪过滤，不会标记已读、不同步 Memory Service，也不会改写原始聊天平台。

计划：

1. 给主题列表卡片的静音下拉菜单增加 `静音边界` 回执。
2. 更新列表页和详情页静音成功 toast，让成功态同样说明本机过滤、未读保留、未同步。
3. 更新 `docs/features/topic_based_messages.md` 的当前实现和业内参考判断。
4. 更新 `tools/verify-topic-based-messages.ts` 与 `tools/verify-topic-based-messages-e2e.mjs`。
5. 验证：`npm run verify:topic-based-messages`、`npm start` 首次编译、`npm run verify:topic-based-messages:e2e`、scoped `git diff --check`。
