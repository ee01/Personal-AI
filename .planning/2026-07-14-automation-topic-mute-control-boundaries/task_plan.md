# Topic 静音控制点边界计划

## 背景

- 选择功能：`主题静音`，来自 `docs/index.md` 的随机候选。
- `docs/progressing/to-verify.md` 为空。
- 自动化记忆显示最近已覆盖 Scheduled Messages、Project Dashboard、Doubao、Native Join、Notification Center、Message Reaction、Message Analysis、Memory Capture、Jira Design Links、Google Slides Analyzer、Memory Service、Agent Thinking 等功能族，本轮避开这些新近目标。
- EventKit 读取 `Personal AI` Reminders：4 条全部已完成，均为历史 Doubao / Notification 反馈；没有未完成且与 Topic 静音相关的条目。

## 外部参考

- Slack mute 将对话静音与隐藏/通知区分开，仍保留 mention / thread 等可见信号。
- Microsoft Teams mute 明确“仍在会话中，只是不再收到普通通知”，并把 muted chats 放入可找回区域。
- Zulip topic mute 把 muted topics 从主 feed / unread count 中拆出，但保留 Recent conversations include-muted、搜索和 topic 内 unmute。
- Email deferral 与 conversation re-entry 研究都支持把 triage 动作做成可恢复状态，并在动作点解释是否只是个人注意力过滤。

## 发现

- 当前文档大体是最新的：Topic 静音已是本机 `localStorage` 状态，支持 1 天、1 周、一直静音、原因、静音视图和取消静音。
- 列表页和详情页已有可见回执，但部分真实点击控件仍缺少按钮级 `title` / `aria-label`，尤其是静音菜单入口、静音原因、静音时长、查看静音和取消静音。
- 这会让键盘/读屏用户和 hover 前的谨慎用户难以在点击前区分“只打开菜单”“写入本机过滤”“只切到静音视图”“只删除本机过滤”。

## 实施计划

1. 给 Topic 列表页的静音入口、原因、时长、toast 查看静音、toast/卡片取消静音、空状态查看静音补按钮级边界。
2. 给 Topic 详情页的静音入口、原因、时长、toast/header 取消静音补按钮级边界。
3. 更新 `tools/verify-topic-based-messages.ts` 和 E2E，断言 hover/读屏文案与本机/no-write 行为一致。
4. 简要更新 `docs/features/topic_based_messages.md` 与 `docs/index.md`，只记录当前行为，不写过细实现。
5. 验证：`npm run verify:topic-based-messages`、`npm start -- --progress` 首次成功编译、`npm run verify:topic-based-messages:e2e`、scoped `git diff --check`。
