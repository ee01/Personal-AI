# Findings

## Requirements
- 用户截图两条推送都显示 `ppjoemwkn`（AI相关讨论话题，`mentionMe: false`）
- 第一条发件人高亮（被 @），第二条没有
- 用户要求：匹配推送的关注项应拼接相关命中项，让用户知道 mention 来自另一条关联规则（如 `Personal AI 讨论`，`mentionMe: true`）

## Research Findings
- `getImmediateNotificationItem` 只取第一条非摘要且有 `notifyMethod` 的规则，`mention` 只看这一条
- 显示文案来自 LLM `matchedRule`，发送前 `NotificationService.performLLMReview` 还可能用审核原文覆盖 `data.matchedRule`
- 因此可能：mention 来自 `Personal AI 讨论`，界面 关注项 却只剩 AI 话题规则
- `formatMatchedRuleForDisplay` 已支持多行清洗 RULE_REF / RULE_ID

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| `resolveImmediateNotificationDelivery` 集中计算 items/mention/matchedRule | 三条分析路径共用，避免再分叉 |
| 显示用规则原文 + 可选（@提醒），换行拼接 | Glip 长中文规则单行难读 |
| 审核结果 merge 进现有 matchedRule | 保留审核纠偏，但不丢掉另一条命中 |

## Resources
- `src/messageAnalysisDelivery.ts`
- `src/messageDealing.ts`
- `src/services/NotificationService.ts`
- `src/utils/matchedRuleDisplay.ts`
- `docs/features/message_analysis.md`
- `tools/verify-memory-entry-runtime.ts`
