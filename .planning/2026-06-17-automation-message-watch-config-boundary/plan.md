# Message Reaction Watch 配置边界计划

## 目标功能

- 随机目标：`关注后续 / Watch`
- 所属文档：`docs/features/message_reaction.md`
- 主要代码：`src/message-reaction/MessageReactionUI.ts`、`src/modals/topic-modal.tsx`、`desktop-app/scripts/message-reaction-toolbar-check.mjs`

## 现状核对

- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 本机 Reminders 可读，但没有 `Personal AI` 列表，本轮不纳入 Reminder 条目。
- 现有文档已经描述 Watch 会打开配置页、默认清空发送人筛选并保留群组筛选，也说明原消息时间和请求时间分离。
- 代码实际路径与文档一致：工具栏发送 `OPEN_FOLLOW_THREAD_CONFIG`，background 写入 `pendingFollowThreadConfig` 并打开 `topic-modal.html`，配置页读取后预填关注规则。

## 外部参考

- Slack 的 Later / Reminders 把消息保存或提醒放进统一列表，并清楚区分“保存/提醒”与后续处理。
- Microsoft Teams 的 followed threads 把“关注线程”定义为收到新回复更新，且有自动/手动关注设置和 followed threads 视图。
- 线程和消息提醒类产品共同强调原消息锚点、通知范围和取消/管理路径；AI 记忆场景还需要额外说明不会自动代表用户发送或把点击当作事实写入。

## 用户体验问题

`Watch` 按钮看起来像立即开始关注，但当前只是打开规则配置页。用户从消息流点击后，如果只看到“正在打开配置”，容易误解为这条消息已经被接管。配置页虽然预填了原消息和群组，但没有在表单顶部明确说明：当前还未保存、默认关注整个会话、保存后才创建本地规则和原消息索引。

## 实施计划

1. 新增 Watch presentation helper，集中生成工具栏启动回执和配置表单边界回执。
2. 工具栏点击 Watch 成功后显示“已打开配置但未保存”的明确 toast。
3. 配置页在从消息进入并启用 Watch 时显示 `关注后续创建边界`，说明默认监听会话、保存才生效、不会回扫历史消息或立即通知。
4. 更新 Message Reaction E2E，断言 toolbar toast 和配置页边界回执。
5. 更新 `docs/features/message_reaction.md` 的 Watch 行为描述。
6. 运行目标单测、`npm start` 首次成功编译、Message Reaction E2E、`git diff --check`，确认没有遗留 webpack watch。
