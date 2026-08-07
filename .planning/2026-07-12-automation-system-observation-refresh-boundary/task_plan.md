# 系统观察规则刷新按钮边界

## 目标功能

- 随机选中：`系统观察规则`
- 所属能力：Message Analysis
- 主文档：`docs/features/message_analysis.md`

## 现状检查

- `docs/progressing/to-verify.md` 当前为空，没有待继续校验项。
- AppleScript 未列出 `Personal AI` Reminders；EventKit 找到 `Personal AI` 列表，4 条总计、0 条未完成，因此没有本轮可纳入或需标记完成的反馈。
- 规则页已经有系统观察运行时回执，说明 Outreach / 自我反思观察是只读运行时状态，不会进入手动规则列表。

## 外部依据

- Slack keyword workflow 把 channel、keyword condition 和后续步骤分开呈现，说明后台观察触发范围应该在控制点可见。
- Zapier filter/path 文档把条件 gate 与后续 action 拆开，说明刷新状态不应被误解为执行后续动作。
- Webex Real-time assist 和 AI suggested actions 强调 AI 建议需要人工复核、使用前验证；后台观察也需要显示“只读状态”而不是伪装成确认或执行。
- Trigger-action debugging / comprehensibility 研究指出非程序员容易误判自动化规则的触发条件、状态和副作用，因此刷新按钮本身应暴露边界。

## 改进计划

1. 在 `src/modals/topic-modal.tsx` 增加系统观察刷新按钮的 `title` / `aria-label` 文案。
2. 文案按状态区分 `loading` / `unconfigured` / `failed` / `ready empty` / `ready with items`，但共同说明只重新读取 runtime status。
3. 在 `tools/verify-message-analysis-rule-diagnostics-e2e.mjs` 断言刷新按钮 title/ARIA 的只读、无写入、无通知、无 RuntimeAction、无 OpenClaw 边界。
4. 在 `docs/features/message_analysis.md` 和 `docs/index.md` 记录该按钮级边界。
5. 运行 targeted verifier、`npm start` 首次成功编译、E2E 和 scoped `git diff --check`。
