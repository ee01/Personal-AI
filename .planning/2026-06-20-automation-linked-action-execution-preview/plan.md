# 联动操作保存前执行预览

## 目标

随机目标：`联动操作 / Openclaw`，所属 Message Reaction。

当前功能已经能从 RingCentral 消息预填记忆入口规则、生成联动操作建议，并在保存后给出边界回执。需要补上的 UX 是保存前的执行路径：用户在填写自然语言动作时，应先看到这条规则保存后会处于 `待激活`、`需批准` 还是 `自动执行`，以及保存本身不会回扫历史、创建 RuntimeAction 或调用 OpenClaw。

## 外部参考

- Slack Workflow Builder / Teams message workflows：自动化从消息上下文启动，但要区分触发来源、步骤和管理入口。
- Microsoft Copilot Studio Request for Information / Zapier Agents approval steps：agent flow 中的人类复核点要作为显式路径，而不是执行后才解释。
- Trigger-action programming 和 human-in-the-loop agent 研究：触发、动作、权限和上下文混淆会损害心智模型，需要把执行前提和审批点前置。

## 实施计划

1. 增加一个可测试的 `buildLinkedActionExecutionPreview()` presentation helper，统一三种路径的标题、标签和非效果边界。
2. 在新建和编辑联动操作表单里渲染保存前执行预览，并随 OpenClaw 连接状态 / 审批开关变化。
3. 更新 `message_reaction.md` 和 feature index，保持文档描述当前行为但不写过细实现。
4. 扩展 focused helper verifier 和 topic-modal E2E，覆盖断开 OpenClaw 时的预览文案。
5. 按 AGENT 验证：targeted verify、`npm start` 首次成功编译、E2E、scoped `git diff --check`。
