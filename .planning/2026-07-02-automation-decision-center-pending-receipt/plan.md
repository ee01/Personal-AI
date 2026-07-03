# 决策中心提交中回执改进计划

## 目标功能

- 随机选中：`决策中心`
- 文档：`docs/features/memory_system.md`
- 主要代码：`src/modals/components/DecisionCenter.vue`
- 验证：`tools/verify-decision-center-e2e.mjs`

## 现状

- 决策中心已经区分 `decision pending`、`decision snoozed`、`watch pending/snoozed`，并支持通知深链、部分队列失败保留、操作后回执和 Action Queue 链接。
- 决策卡已有“操作边界”，但用户点击 `批准执行`、`稍后再决定`、`立即查证` 后，在 Memory Service 返回前只有按钮文本变成“提交中/处理中”。这段等待期没有同屏说明：答案还未写入、卡片仍是上次成功快照、OpenClaw/外部发送/动作创建还没有被确认。

## 外部参考

- OpenAI Agents SDK 的 Human-in-the-loop approval flow 会在工具调用需要批准时暂停 run，返回 pending approvals，待用户 approve/reject 后再 resume。
- Zapier Human in the Loop 的 Request Approval 会暂停 Zap，让 reviewer 审核内容并 approve/decline/change 后 workflow 才继续。
- Microsoft Agent Framework 的 approval tool pattern 也要求 agent run 返回所需人工输入，由 caller 收集 approval response 后再继续。
- Microsoft Aether overreliance review 和 HCI overreliance 研究都提醒：人类容易把 AI/自动化建议当成已经可靠或已经执行，解释只有在降低复核成本、保留人的最终控制时才有帮助。

## 改进计划

1. 给 `DecisionCenter.vue` 增加 per-card `提交中回执`。
   - 回答确认项：显示正在提交哪个答案；服务端返回前尚未写入答案、未移出队列、未续跑 OpenClaw 或外发。
   - 稍后/恢复/结束决策项：显示只是在请求状态变更；返回前仍以上次队列快照为准。
   - 待观察查证/继续观察/结束观察：显示查证动作尚未创建或复用成功；返回前不会确认事实、替用户拍板或发送消息。
   - 规则改进打开：显示只是本机暂存并打开编辑器；保存前不会更新规则或确认项。
2. 扩展 Decision Center E2E。
   - 给第一个 `answer` 请求加可控延迟。
   - 点击 `批准执行` 后先断言 `正在提交决策` 回执可见，再放行服务端响应。
   - 给待观察 `state` 请求加可控延迟，断言 `正在排入只读查证` 回执可见。
3. 更新 `docs/features/memory_system.md`。
   - 在 Confirm Requests 当前实现特征里补充提交中等待期的真实边界。

## 不做

- 不改变 `confirm_requests` API、状态机、答案选项、OpenClaw 执行语义或通知推送策略。
- 不新增批量审批或全局 review queue。
- 不标记 Reminder：EventKit 找到的 `Personal AI` 项均为已完成且与 Doubao/Weekly Dream Digest/通知同步有关。
