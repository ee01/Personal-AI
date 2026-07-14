# 手动关注项规则保存按钮边界计划

## 目标

- 随机目标：`手动关注项规则`（Message Analysis，`docs/features/message_analysis.md`）。
- 本轮只修规则页保存控件的 UX / accessibility 边界；不改规则匹配、LLM prompt、分发、Memory Service 写入、OpenClaw 执行或 Task Scheduler 语义。

## 已确认

- `docs/progressing/to-verify.md` 为空。
- `Personal AI` Reminders 列表可通过 EventKit 读取：4 条全部已完成，均为豆包 / Notification 历史反馈；无未完成条目和本目标相关。
- 当前 worktree 已有大量历史自动化脏文件；本轮只触碰本计划、`src/modals/topic-modal.tsx`、`tools/verify-message-analysis-rule-diagnostics-e2e.mjs`、`docs/features/message_analysis.md`、`docs/features/index.md` 和自动化 memory。

## 外部参考

- Slack Workflow Builder 的 keyword workflow 把 channel 和 keyword conditions 绑定到触发器，发布后才对指定频道里的关键词生效。
- Zapier Filter / Paths 把“满足条件才继续”作为工作流 gate。
- Microsoft Power Automate 把 trigger 作为 cloud flow 的启动事件，trigger conditions 用于控制是否启动流程。
- Trigger-action debugging 研究强调非程序员需要在规则运行前看懂触发条件、动作后果和失败/不运行原因。

## 缺口

规则页已有保存前运行路径、范围执行、分发路径和副作用边界回执，但普通手动规则的新建 / 编辑保存按钮只有在自动答复启用时才有 `title` / `aria-label`。键盘或读屏用户聚焦普通保存按钮时，无法在点击前直接确认：

- 保存只是更新本机手动规则；
- 后台采集关闭时不会自动捕获后续新消息；
- 保存不会回扫历史、发送通知、写入记忆、创建 RuntimeAction、执行 OpenClaw 或改写系统观察规则。

## 实施步骤

1. 新增通用手动规则保存按钮边界文案 helper，并复用已有 `getRuleRunPreviewReceipt` 的状态。
2. 新建规则 `确认` 和编辑规则 `保存` 按钮：普通规则使用通用边界；自动答复规则继续使用现有自动答复专用边界。
3. 在现有 `verify-message-analysis-rule-diagnostics-e2e.mjs` 中断言普通新建和编辑保存按钮的 `title` / `aria-label`。
4. 更新 `message_analysis.md` 和 `docs/features/index.md` 的手动关注项规则描述。
5. 验证：`node --check`、`npm start` 首次成功编译、`node tools/verify-message-analysis-rule-diagnostics-e2e.mjs`、scoped `git diff --check`。
