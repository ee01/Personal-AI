# 联动操作按钮边界计划

## 目标

本轮随机抽中 `docs/features/index.md` 里的 `联动操作 / Openclaw`。目标是补齐 RingCentral 消息工具栏中最高风险入口的点击前边界，避免用户把 `联动操作` 误解成已经创建 RuntimeAction 或已经调用 OpenClaw。

## Reminder 检查

- AppleScript 没列出 `Personal AI`，但 EventKit fallback 找到该列表。
- `Personal AI` 列表共有 4 条，未完成 0 条。
- 本轮没有可纳入或标记完成的 Reminder item。

## 外部扫描结论

- Slack Workflow Builder / shortcuts 和 Microsoft Teams message workflows 都把消息级自动化放在显式入口后，再进入配置或确认步骤。
- Zapier trigger / AI action / approval step 文档强调触发样本、动作描述、测试和批准步骤需要分开。
- Trigger-action programming 研究反复指出，用户容易混淆触发、动作和执行状态；高风险自动化要在控制点解释“当前点击做什么、不做什么”。

## Plan

1. 在 toolbar 渲染层给 `linkedAction` 生成专用 `title` / `aria-label`，说明只打开当前消息的 Openclaw 配置草稿。
2. 保持其他 Message Reaction 按钮行为不变，不改 background message、pending config、topic-modal 保存或 OpenClaw 调用路径。
3. 更新 toolbar E2E，断言联动按钮点击前边界存在，仍保持紧凑按钮文案。
4. 更新 `message_reaction.md` 和索引中的简短说明。
5. 验证 `verify:message-reaction`、`npm start` 首次编译、`verify:message-reaction:e2e` 和 scoped `git diff --check`。

## 非目标

- 不修改 OpenClaw 连接态、dry-run 预演、规则保存、动作队列或审批逻辑。
- 不处理 Snooze / Watch / Reply / Followup 的其他入口。
