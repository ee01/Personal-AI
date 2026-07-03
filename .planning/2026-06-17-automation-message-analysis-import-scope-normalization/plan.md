# Message Analysis 导入范围规范化

## 目标功能

- 随机命中：`规则范围校验`
- 所属能力：Message Analysis
- 主文档：`docs/features/message_analysis.md`

## 现状

- 新建 / 编辑记忆入口规则时，`filterSender` 和 `filterGroup` 会先 trim，纯空白不会保存成范围条件。
- XML 导入路径此前直接保存 XML 文本，带前后空白的范围、纯空白范围和联动描述可能进入 `concernedItems`。
- 运行时范围匹配会把空白范围当成无有效范围兜底，但导入用户不容易从文件内容判断保存后的真实作用范围。

## 外部参考

- Slack keyword workflow 会先指定 channel 和关键词条件，说明触发范围应是显式条件。
- Zapier Filters 明确条件不满足就不继续执行后续动作。
- IFTTT / trigger-action 研究指出，用户容易误判自动化规则的上下文风险，复制和导入规则时尤其需要清楚表达条件与副作用。

## 改进计划

1. 导入 XML 时对 `id`、`text`、通知字段、范围字段和联动描述做统一 trim。
2. `filterSender` / `filterGroup` trim 后为空时保存为 `undefined`，让后续卡片和回执按全局范围显示。
3. 更新 Message Analysis E2E fixture，导入带空白的 XML，并从 `chrome.storage.local.concernedItems` 验证保存后的规范化结果。
4. 更新功能文档，说明导入入口与新建 / 编辑入口范围规范化一致。
5. 验证：targeted runtime / unit check、`npm start` 首次成功编译、Message Analysis E2E、`git diff --check`。

## Reminder

本机 Reminders 可读取，但没有 `Personal AI` 列表；本轮无相关 Reminder 可纳入或标记完成。
