# Message Analysis 系统观察刷新失败快照计划

## 目标功能

- 随机抽中功能：`系统观察规则`
- 所属能力：Message Analysis
- 文档：`docs/features/message_analysis.md`
- 代码入口：`src/modals/topic-modal.tsx`
- 验证入口：`tools/verify-message-analysis-rule-diagnostics-e2e.mjs`

## 当前确认

- `docs/progressing/to-verify.md` 当前为“暂无”，没有待接续事项。
- EventKit 找到本机 `Personal AI` Reminders list：共 4 条，0 条未完成；没有和 Message Analysis / 系统观察规则相关的未完成反馈需要纳入或标记完成。
- 当前工作树已有大量历史自动化改动，本轮只追加系统观察刷新失败快照相关改动。

## 外部参考

- Slack Workflow Builder keyword trigger 要先声明 channel 与 keyword conditions，说明触发范围应该可见：https://slack.com/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword
- Zapier Filter / Paths 把条件作为后续动作是否继续的 gate，说明自动化状态不能只给“成功/失败”粗口径：https://help.zapier.com/hc/en-us/articles/34372501750285-Use-conditional-logic-to-filter-and-split-your-Zap-workflows
- Trigger-action debugging 研究强调用户需要知道规则为什么运行、没有运行或状态未知：https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445567
- AI transparency 研究强调透明度应服务具体用户理解，而不是只暴露内部细节：https://hdsr.mitpress.mit.edu/pub/aelql9qy

## 改进 Plan

1. 修复 `loadSystemObservationRuntime()` 失败分支：如果已有成功读取快照，失败后保留 `items` 和 `loadedAt`，并记录 `failedAt` / `error`。
2. 调整规则页系统观察回执：失败态显示 `刷新失败 · 上次快照` 或 `刷新失败 · 上次空状态`，指标标成“上次”，并说明当前状态未确认。
3. 调整刷新按钮 `title` / `aria-label`：失败后说明上次快照只用于排障，不证明观察仍在运行或已经停止。
4. 扩展 E2E：覆盖 ready -> failed keeps last non-empty snapshot -> ready empty -> failed keeps last empty snapshot。
5. 更新 `docs/features/message_analysis.md` 和 `docs/features/index.md` 的当前行为描述。
6. 验证：先跑脚本语法检查 / 目标 E2E，再跑 `npm start` 首次成功编译，最后跑 scoped `git diff --check`。

## 非目标

- 不改变 Outreach runtime status API。
- 不改变系统观察规则的匹配、入库、通知、自动答复、RuntimeAction 或 OpenClaw 分发逻辑。
- 不把系统观察规则导入、排序或覆盖到手动规则列表。
