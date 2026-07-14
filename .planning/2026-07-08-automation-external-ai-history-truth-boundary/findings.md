# Findings

## 仓库和本机状态

- `AGENT.md` 要求 runtime 代码改动后优先运行 `npm start`，等首次 successful compile 后停止 watch，再跑目标 verifier / E2E。
- `docs/progressing/to-verify.md` 当前无待校验事项。
- 自动化记忆显示最近几轮已扫过 Outreach、Agent Workflow、Today Pilot、Project Dashboard、Skill Foundry、Auto Reply、Agent Thinking、Prompt Config、Memory Search 等表面，本轮避开这些重复目标。
- EventKit 找到 `Personal AI` Reminders 列表，4 条均为 completed，没有外部 AI 历史导入相关 open item。
- 工作树已有大量历史脏改，需把本轮 ownership 限定到 Coverage Map 外部 AI 事实边界。

## 代码观察

- `MemoryCoveragePage.vue` 已有 `externalAiImportReviewText`、`externalAiDecisionReceiptItems`、`externalAiCommitPendingReceiptItems` 和 `smartImportReceiptDetails`。
- E2E fixture 已覆盖 `external_ai_history` dry-run、omission 统计、提交中回执和完成回执。
- 当前文案已说明 shadow memory / no external sync / no confirmed profile-skill-project promotion，但事实边界分散在多个行里，不够直接指出旧 assistant 回答不是事实确认。

## 外部参考

- OpenAI Help Center: ChatGPT export 是用户主动请求，导出 zip 包含 chat history 和相关账户数据，下载链接有时效。
- Claude Help Center: Claude personal data export 包含 conversation data 和账户数据，但不支持把该导出迁移到另一个个人 Claude 账户。
- Opal paper: personal AI long-term memory 会聚合文档、邮件、消息、会议等高度敏感数据，隐私和访问模式边界是核心系统问题。
- Long-term memory / LongMemEval 方向: 长期对话历史进入记忆系统后仍要经历索引、检索、阅读和 abstention / 更新判断，不能把历史对话原文直接等同于确认事实。
