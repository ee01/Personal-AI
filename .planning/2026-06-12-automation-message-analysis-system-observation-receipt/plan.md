# Message Analysis 系统观察样例边界回执

## 选择

- 随机功能: `系统观察规则`
- 所属文档: `docs/features/message_analysis.md`
- 当前 carry-over: `docs/progressing/to-verify.md` 为 `暂无。`
- Reminder: 本机 Reminders 可读，但没有 `Personal AI` 列表；本轮无 Reminder 来源条目可纳入或标记完成。

## 研究信号

- Slack Workflow Builder 的关键词触发要求先声明 channel 和 keyword conditions，说明系统应把触发范围展示出来。
- Zapier Filters / Paths 把条件 gate 和后续动作拆开，说明内部观察也要显示“只读观察”和“不会执行手动规则副作用”的边界。
- 触发-动作调试研究强调用户需要看到规则为什么触发、为什么没有触发，以及触发后发生什么。
- Attention-sensitive alerting 研究强调系统应解释打扰成本；系统观察不能被误读成即时通知或自动回复。

## 问题

规则页已经有系统观察运行时摘要，但样例只显示状态、目标和问题摘要。用户在排查“系统为什么还在观察消息”时，仍需要推断三件事：

- 观察范围到底来自目标群组、已发送会话还是模板目标。
- 从什么时候开始接收新证据，旧消息是否会倒灌。
- 命中后是否会触发用户手动规则的通知、自动答复或联动操作。

## 实施计划

1. 在 `src/modals/topic-modal.tsx` 的系统观察样例中增加只读边界 chips：观察范围、观察起点、运行副作用边界。
2. 复用 `OutreachWatchRule` 已有字段，不改 Memory Service API：`sentChatId`、`targetResolvedChatId`、`targetLabel`、`targetRef`、`baselineAt`、`runtimeScope`。
3. 更新 `tools/verify-message-analysis-rule-diagnostics-e2e.mjs`，让 runtime-status fixture 返回真实系统观察样例，并断言新边界可见。
4. 更新 `docs/features/message_analysis.md`，记录当前系统观察样例回执的用户承诺与业内依据。
5. 验证：运行 Message Analysis runtime/页面 E2E，跑 `npm start` 首次成功编译，最后 `git diff --check`。

## 非目标

- 不把系统观察变成可编辑规则。
- 不把系统观察写入 XML 导入/导出。
- 不改变后端范围校验、Outreach 发送或证据入库行为。
