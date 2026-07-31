# Meeting Outcome Binder Experience Eval

本 suite 验证同一份会议目标能否从 Today Pilot 会前准备进入 Meeting Pilot，并在会后只依据真实 transcript、决议、章节和行动项生成可追溯结果；Ask 只能读取这些结果。

## 真实场景

1. `2026 Q3 planning for video mobile` 同时包含 Dev / QA 估时、team capacity 和 rollout risk：决议可闭环，pending 行动项只能部分闭环，明确“下次继续”才能带到后续。
2. Rollout risk 只在 transcript 中被提到，没有决议或完成行动项：即使模型声称 resolved，也必须降级为 unresolved。
3. 模型引用不存在的证据并声称预算 owner 已确认：结果必须进入 `blocked_by_missing_evidence`，不能复述幻觉结论。
4. Release owner 行动项与目标匹配且状态为 done：允许闭环，并保留 action 证据。

## 执行步骤

1. 对每个 case 建立内存 SQLite，并运行生产 migration `056_meeting_outcome_binders.sql`。
2. 调用生产 `MeetingOutcomeBinderService.previewFromMeetingPrep()` 生成会前目标。
3. 给生产 `bindMeetingSession()` 注入 case 中的模型候选；仍由生产证据守卫决定最终状态。
4. 通过 `getByMeetingId()` 重新读取，验证会后结果已持久化且没有丢字段。
5. 调用生产 `findRelevant()` 与 `formatForAsk()`，验证 Ask 能命中相关会议并获得只读边界。
6. 使用确定性 heuristic 比较目标、状态、证据种类、摘要片段、持久化和 Ask 上下文；不访问远端服务，不调用真实 LLM。

## 通过标准

- 会前 candidate slots 必须原样成为 `planned / not_seen` 目标。
- `resolved` 必须有匹配决议或状态为 done 的行动项。
- 匹配的 pending 行动项最高只能是 `partially_resolved`。
- Transcript 提及不能闭环；只有明确“下次继续”才允许 `carried_over`。
- 不存在、无关或不匹配的 evidence ref 不能进入结果，必须降级为证据不足。
- 绑定结果必须能按 `meetingId` 重读，Ask 上下文必须包含只读、不写回外部系统的边界。
- 所有 Reader Proof 要求的 score 均为 3。

## Report Requirements

- 本报告证明生产 service 的确定性证据守卫、持久化和 Ask 格式化，不证明真实模型在所有议程上都能生成最佳 candidate slots。
- Today Pilot、Meeting Pilot 和 Quick Ask 的真实页面呈现由各自 Playwright E2E 验证，不由本 suite 代替。
- 本 suite 不调用 Calendar、Jira、RingCentral、消息或任务写入 API；外部无写回边界还需 API 路由审查与 E2E 回执共同证明。
- 样本来自真实工作场景的去敏版本，不代表所有语言、同名会议和 recurring meeting 数据分布。

## 命令

```bash
npm run eval:validate
npm run eval:run -- --suite meeting-outcome-binder --no-repair
```
