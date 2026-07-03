# 自动答复入口边界回执改进计划

## 目标功能

- 随机功能：`自动答复 / Reply`
- 所属能力：Message Reaction
- 主文档：`docs/features/message_reaction.md`

## 当前上下文

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有上次未完成体验要续跑。
- 本机 Reminders 可读，但没有 `Personal AI` 列表，因此没有相关用户反馈项可纳入或完成。
- 近期 automation memory 已覆盖 Compose Assist 和 Memory Capture；本次避开这些最近目标。
- 当前 worktree 已有大量非本次变更，所有编辑需限定在本次功能相关文件。

## 外部参考

- Gmail / Google Messages Smart Reply 的安全方向正在从直接发送转向 tap-to-draft，可编辑后再由用户发送。
- Outlook Suggested Replies 也把回复作为建议，并强调组织边界内的模型处理。
- Slack AI / Agent Assist 类能力倾向把 AI 产物放进可编辑、可复核路径，而不是绕过用户确认。
- Smart Reply 论文强调高频短回复建议的价值，但产品落地需要处理误发、语义多样性和用户控制。
- 2024 CSCW/EUSSET smart replies 研究讨论了“AI 代我回复”的责任感和社交风险，支持在发送边界前展示明确的人控回执。

## 发现的问题

自动答复配置页和 Scheduled Messages 审核页已有发送口径回执，但从消息工具栏点击 `Reply` 后，成功 Toast 只说“正在打开自动答复配置”。作为用户，这一刻容易误读为已经创建或发送了自动答复，尤其按钮名称本身叫“答复”。

## 改进计划

1. 增加一个共享的自动答复入口回执 helper，文案明确：只打开配置，未发送消息，也未创建自动答复规则。
2. 在当前 `MessageReactionUI` 和遗留 `SnoozeUI` 自动答复入口都使用同一 helper，避免两条工具栏路径漂移。
3. 在 Message Reaction 单测中覆盖该回执必须包含“未发送”和“未创建规则”的边界。
4. 更新 `docs/features/message_reaction.md`，补充工具栏 Reply 入口的未发送/未建规则回执。
5. 验证：`verify:message-reaction`、`npm start` 首次编译、`verify:message-reaction:e2e`、相关路径 `git diff --check`。
