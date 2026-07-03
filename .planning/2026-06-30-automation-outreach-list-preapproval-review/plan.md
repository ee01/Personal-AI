# Outreach 列表发送前复核

## 目标功能

- 随机选中功能：`主动询问`（Memory Service / `docs/features/memory_system.md`）
- 入口：`memory-exploring.html#/outreach`
- 主要文件：`src/modals/components/OutreachSessions.vue`、`src/modals/components/OutreachSessionDetail.vue`、`tools/verify-outreach-sessions-e2e.mjs`

## Reminder

本机 Reminders 可读，但没有名为 `Personal AI` 的列表。本次没有可合并或可标记完成的 Reminder item。

## 外部参考

- Microsoft Copilot Studio `Request information` 把自动化流程暂停，等指定 reviewer 提供输入后再继续。
- OpenAI Agents SDK HITL 将敏感工具调用暴露为 `interruptions`，批准/拒绝后再从 `RunState` 继续。
- Slack Workflow Builder 把自动化拆成 trigger、step、button 和 workflow manager，强调动作与权限边界。
- proactive conversational agents 研究指出主动系统如果缺少克制和预期管理，容易被用户感知为打扰。

## 改进计划

1. 在 Outreach 列表页给待审批会话补 `列表发送前复核` 回执，复用现有 evidence / reply / outcome 线索。
2. 当待审批会话已经有发送前证据或回复线索时，禁用列表一键 `批准发送`，改为 `先到详情复核`。
3. 保留详情页批准路径，让用户在完整发送前复核、证据面板和操作范围回执同屏时决定批准、取消或编辑问题。
4. 更新 Outreach E2E 覆盖待审批筛选列表和被拦截的一键批准按钮。
5. 同步 `docs/features/memory_system.md`，说明列表不会绕过已有证据的外发复核。

## 实现结果

- `OutreachSessions.vue` 新增列表发送前复核回执。
- 带 evidence / reply / outcome 线索的 `pending_approval` 会话在列表页不能直接批准，必须进入详情复核。
- `verify-outreach-sessions-e2e.mjs` 新增 `status=pending_approval` 列表场景，断言回执、禁用按钮和详情复核入口。
- `memory_system.md` 更新主动询问文档。

## 验证

- `node --check tools/verify-outreach-sessions-e2e.mjs`
- `npm start -- --progress` 首次编译成功后停止
- `node tools/verify-outreach-sessions-e2e.mjs`
- `git diff --check -- src/modals/components/OutreachSessions.vue tools/verify-outreach-sessions-e2e.mjs docs/features/memory_system.md`
- `pgrep -fl "webpack.*webpack\\.dev\\.cjs"` 无残留 watcher
