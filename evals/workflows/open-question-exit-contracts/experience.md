# Open Question Exit Contracts Experience Eval

本 suite 评估 Personal AI 是否能让开放问题在“继续处理、等待 owner、停放、恢复”之间有确定且可审计的生命周期，而不是每次反思都重新生成问题、动作或提醒。

## What This Suite Checks

1. 同一问题没有未见证据时，从活跃问题退出并抑制派生动作。
2. 已有 queued/running 动作、确认请求或 Evidence Watch 时，把问题交给现有 owner。
3. Action Result、确认回复或权威来源变化到达后，只恢复一轮并生成新的 action epoch。
4. 只有 `active + blocking_today + lastResumedAt` 的受管理问题可以进入 Today Pilot。
5. `首次出现`、`等待 owner`、`停放` 不会伪装成新证据恢复；Quick Ask 不承担默认状态聚合。

## Real Scenarios

- MTR-148115 DEV Estimate Original 重复查证，但 Jira 字段快照未变化。
- Q2 nova epic dry run 已经有 OpenClaw 读取动作，反思不能再次排队。
- 发布 owner 已有 pending confirm request，反思不能生成第二个确认请求。
- 今天发布 blocker 收到新的动作结果后，恢复为 Today Pilot mission。
- AI tool availability 已由 Evidence Watch 负责，契约存在不等于来源已复核无变化。

## Run Steps

1. 读取 `evals/cases/open-question-exit-contracts/cases.jsonl`。
2. 在 Memory Service test DB 中构造真实问题、证据 refs 和 owner。
3. 调用 `OpenQuestionExitContractService.evaluate`，必要时重复评估或追加 action-result resume。
4. 核对最终 state、reason、派生动作抑制、receipt 和 Today Pilot eligibility。
5. 使用确定性 heuristic 打分，不调用 LLM，不依赖远端服务。

## Pass Criteria

- 每个 case 的最终 state 和 reasonCode 必须准确。
- `shouldSuppressDerivedActions` 必须符合 owner/证据状态。
- 无新证据或已有 owner 的 case 不得具备 Today Pilot eligibility。
- 新动作结果恢复的高影响 case 必须有 `lastResumedAt` 且可进入 Today Pilot。
- Receipt 必须同时说明当前状态、边界和下一步。

## Report requirements

报告必须逐 case 展示真实场景、输入问题、当前 owner/证据、最终 state/reason、派生动作是否被抑制、Today Pilot eligibility、receipt 文案和通过/失败原因。报告使用共享 Reader Contract，不新增 suite 专属页面。

## Command

```bash
npm run eval:run -- --suite open-question-exit-contracts --no-repair
```
