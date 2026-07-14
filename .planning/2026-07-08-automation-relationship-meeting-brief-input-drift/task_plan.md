# 人脉关系 Meeting Brief 输入漂移回执计划

## 目标功能

- 索引项：`人脉关系 Meeting Brief`
- 所属能力：Relationship Radar
- 文档：`docs/features/relationship_radar.md`

## 本轮问题

Meeting Brief 已有身份待核对、来源范围、覆盖统计、生成请求和复制简报边界。但用户生成简报后，如果继续修改会议标题或参会人输入框，页面仍保留旧简报并允许直接复制。真实使用时这会让用户误以为复制的是当前输入对应的结果，尤其在会前临时补人、删人或改会议名时风险很高。

## 外部参考

- Microsoft Copilot for Sales pre-meeting card 会把会议标题/时间、历史邮件/会议、CRM 关联、风险和 open question 合并成会前 highlights，并提供深入查看入口。
- Salesforce Einstein Relationship Insights 强调在用户工作流中展示关系证据和连接图，并把 CRM 更新作为显式动作。
- CHI 2024 source attribution / factuality 研究强调 LLM 文本需要可理解的事实性和来源提示来校准信任。
- LLM-powered meeting recap 研究指出单一固定摘要无法服务所有会后/会前需求，结构化 highlights 与层级 minutes 适配不同使用场景。
- AI-mediated communication 研究提醒关系型 AI 文本会影响信任与责任归因，因此旧输入结果不能被包装成当前会议事实。

## Reminder 结论

EventKit 可读取本机 `Personal AI` Reminders。列表 4 条均已完成，内容是豆包同步、日志和 Weekly Dream Digest 历史反馈；没有未完成项与 Relationship Radar、Meeting Brief、会前人物摘要、参会人覆盖或身份核对相关。本轮不标记新的 Reminder done。

## 实施计划

1. 新增 Meeting Brief 输入快照：生成请求成功时记录标题和参会人输入的规范化快照。
2. 新增 `简报输入变更回执`：当页面输入与已生成简报快照不一致时，说明当前输入和简报依据不同，旧简报仍可查看但不能复制。
3. 锁定复制按钮：输入漂移时按钮显示 `先重新生成`，点击复制函数也二次保护并提示用户重新生成。
4. 更新 E2E：覆盖生成后修改参会人、显示回执、复制锁定、重新生成后回执消失且复制恢复。
5. 更新功能文档和索引，说明 Meeting Brief 的旧简报快照与当前输入边界。
6. 运行 Relationship Radar API/UI 验证、`npm start` 首次编译、E2E 和 scoped `git diff --check`。

## 非目标

- 不改变 `/relationships/meeting-brief` 匹配、身份核对、覆盖统计、readiness、focus 或 source receipt 算法。
- 不改变 Relationship Radar 人物投影、Context Card、Assistant Draft、Review Queue 或 Graph。
- 不写入人物画像，不创建跟进，不发送消息，不同步外部系统。
