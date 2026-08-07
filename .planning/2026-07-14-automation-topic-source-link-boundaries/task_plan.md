# Topic 来源链接安全展示改进计划

运行时间：2026-07-14

## 目标

随机选中 `docs/index.md` 中的 `Topic 来源链接安全展示`。本次只处理 Topic 详情页聊天、资源、网页来源链接的预点击边界，不改 URL 安全判定、外部打开行为、已读同步、后端 API 或本机稍后/静音状态。

## 当前状态

- `docs/progressing/to-verify.md` 当前为空，没有待继续验证事项。
- AppleScript 未列出 `Personal AI` Reminders；EventKit 成功找到 `Personal AI` 列表，共 4 条，未完成 0 条。因此没有可纳入本次实现或需要标记完成的 Reminder item。
- 代码已经只允许可信 `http(s)` 来源链接可点击，屏蔽 `javascript:`、`file:`、无效 URL 和带 userinfo 的 URL，并在打开后显示 `来源打开回执`。
- 主要缺口：详情页来源链接的 `title` / `aria-label` 只暴露目标域名，还没有在真正点击点提前说明点击只打开外部标签页，不会重读来源、同步 Memory Service、标记已读、确认结论或写回原始平台。

## 外部参考

- Slack `chat.getPermalink` 把消息链接作为可复现的 HTTP permalink，支持 Topic 里保留原始消息锚点。
- Microsoft Defender Safe Links 对 Teams / Office 链接做 time-of-click verification，说明协作工具里的外链点击需要在点击点暴露安全口径。
- Notion AI Connectors 强调连接来源和权限边界，说明聚合页展示跨来源内容时要保留来源可追溯性和访问范围。
- RFC 3986 与 URL inspection 研究都支持把真实域名和 userinfo 风险前置给用户，而不是只把完整 URL 藏在 hover 后。

## 实施步骤

1. 在 `src/modals/topic-link-safety.ts` 的安全链接 presentation 里统一生成更完整的 `title` 文案。
2. 让 Topic 详情页现有聊天 / 资源 / 网页来源链接继续复用该 presentation，自动获得相同 `title` / `aria-label` 边界。
3. 扩展 `tools/verify-topic-based-messages.ts` 的 helper 断言和 `tools/verify-topic-based-messages-e2e.mjs` 的 DOM 断言，证明 title/ARIA parity 以及 no-read/no-sync/no-write 口径。
4. 更新 `docs/features/topic_based_messages.md` 和 `docs/index.md`，保持文档简洁，只记录用户可感知行为。
5. 验证：`npm run verify:topic-based-messages`、`npm start` 首次成功编译、`npm run verify:topic-based-messages:e2e`、scoped `git diff --check`。
