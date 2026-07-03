# 联动操作保存回执改进计划

## 目标功能

- 来源：`docs/features/index.md`
- 抽中功能：`联动操作 / Openclaw`
- 所属能力：Message Reaction
- 主文档：`docs/features/message_reaction.md`

## 现场检查

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有需要优先续做的验证事项。
- 本机 Reminders 可读，但没有 `Personal AI` 列表，因此没有纳入或完成 Reminder 条目。
- 当前工作树已有大量未提交改动；本轮只追加联动操作相关 helper、modal、E2E、文档和本计划。

## 外部参考结论

- Slack Workflow Builder 把 workflow 拆成 trigger、steps、variables 和 manager，说明消息联动必须把触发样本、动作步骤和管理权分清。
- Microsoft Teams message workflows 从单条消息的 More actions 进入，添加 / 运行后会有确认，并提供 Manage workflows 入口；这支持保存后继续给出管理路径，而不是只显示泛化成功。
- Zapier Custom Actions 允许 AI 生成 API action，但仍强调公共 API、连接账户、可复用 action、API 响应和限制；黑盒委派需要保留能力 / 权限 / API 变化边界。
- Trigger-action programming 研究指出用户容易混淆触发类型和动作类型；从消息进入配置时尤其容易把“保存规则”误解为“已经处理当前消息”。
- SOUPS 2023 TAP 安全工具研究强调自动化链路可能导致用户难以推理的安全 / 隐私结果，因此保存阶段要明确未执行、未外发、未创建动作。

## 改进计划

1. 给联动操作保存成功增加边界回执：保存规则草稿不回扫历史消息、不创建 RuntimeAction、不调用 OpenClaw。
2. 回执随 OpenClaw 状态和审批设置变化：未连接为待激活；已连接需批准则说明后续命中后进入需批准动作；免批准则说明后续命中后按设置自动执行可执行动作。
3. 把文案生成放入 `linkedActionHelpers` 并补单元测试，避免 React 组件里散落不可测试的长文案。
4. 在 Message Reaction E2E 中覆盖从 pending 联动操作入口保存规则后的 Toast 边界。
5. 更新主功能文档，说明当前用户路径和误解防护。

## 验证计划

- `npm run verify:message-reaction`
- `npm start`，等待首次 dev compile 成功后停止
- `npm run verify:message-reaction:e2e`
- `git diff --check -- <本轮相关文件>`
