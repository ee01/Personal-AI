# 跟进追问状态回执改进计划

## 目标功能

- 随机功能：`跟进追问 / Followup`
- 所属能力：Message Reaction
- 主文档：`docs/features/message_reaction.md`

## 当前上下文

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有待续跑事项。
- 自动化记忆显示近期已覆盖 Storyline、Ask、Project Dashboard、User Profile、Native Join、Timeline、Agent Thinking、Topic Messages、Agent Workflow、Rehearsal、Doubao、Action Queue、Memory Coverage、Relationship Radar、Scheduled Messages、Task Scheduler 等，本次避开这些新鲜目标，限定在 Message Reaction 的 Followup/Outreach session 入口。
- 本机 Reminders 可读，但列表中没有 `Personal AI`，因此没有相关 Reminder item 可纳入、完成或备注。
- 当前 worktree 已有大量非本次变更，所有编辑限定在 Followup 相关 UI、测试、文档和本计划。

## 外部参考

- Boomerang 的 no-response follow-up 把发出后的消息带回用户视野，让用户再决定是否追发。
- Superhuman Auto Reminders 会基于外发消息检测是否需要跟进，并允许用户选择规则范围和工作日限制。
- Human-centered proactive conversational agents 研究强调主动系统要围绕人的预期、社交影响和控制点设计，而不是只追求自动行动能力。

## 发现的问题

Followup 弹窗已经在创建前说明“不会立刻发送新消息、不写 Google Sheet、不创建 Outreach template”，重复创建也会说明复用旧 session；但创建成功后的 toast 只有 `已开始跟进`。作为真实用户，成功瞬间更需要知道：

- 现在只是建立了 `waiting_reply` 会话，不代表已发出新追问。
- 后台会先检查原消息线程，下一次检查可能是立即或某个未来时间。
- 如果是重复创建，当前输入不会覆盖旧的信息目标。
- 去哪里查看当前 session。

## 改进计划

1. [x] 新增可测的 Followup presentation helper，基于 `created`、`session.status`、`nextCheckAt`、`waitUntil` 和重复 session 信息生成成功/复用 toast 回执。
2. [x] `MessageReactionUI` 接入 helper，让新建成功 toast 明确“已创建跟进会话、未立刻发送追问、将先检查原消息线程”和下一次检查时间。
3. [x] 增加 Message Reaction 单测，覆盖新建、未来检查、重复 session 三条回执边界。
4. [x] 更新 Message Reaction E2E，断言 Followup 成功 toast 包含新状态边界。
5. [x] 更新 `docs/features/message_reaction.md`，把成功回执和下一次检查语义补进 Followup 文档。
6. [x] 验证：`npm run verify:message-reaction`、`npm start` 首次成功编译、`npm run verify:message-reaction:e2e`、相关文件 `git diff --check`。

## 验证结果

- `npm run verify:message-reaction`：通过，63 个 node:test 用例全部 pass。
- `npm start`：webpack dev watch 首次编译成功，随后已停止。
- `npm run verify:message-reaction:e2e`：通过，Playwright unpacked-extension toolbar E2E 覆盖 Followup 弹窗和 toast。
- `git diff --check -- <本次相关文件>`：通过。
