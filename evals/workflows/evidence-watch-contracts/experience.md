# Evidence Watch Contracts Experience Eval

本 suite 评估 Personal AI 在遇到“事实可能变化 / 需要未来复核 / 来源暂不可读”时，是否把一次性查证动作升级成可复用的证据守望契约，而不是反复创建 action 或把旧结论冒充为当前事实。

## What This Suite Checks

1. 从 EvidenceResolutionPlan 的 `disposition=watch`、`reasonCode=future_monitoring`、`sourceAnchor` 和 `gapType` 创建稳定的 Evidence Watch Contract。
2. 同一 subject/gap 的二次 Ask 或 Reflection 会复用同一个 contract。
3. 同一 contract 下重复的 `delegate_openclaw` / `create_confirm_request` 会复用 action idempotency，并写入 `skipped_duplicate` receipt。
4. `created` / `skipped_duplicate` / `skipped_budget` 这类 lifecycle receipt 不会被误标为“权威来源已复核无变化”。
5. 来源阻塞、无变化、变化等真实复核结果会更新 contract state，并返回用户可读的 `evidenceWatch` receipt。

## Run Steps

1. 读取 `evals/cases/evidence-watch-contracts/cases.jsonl`。
2. 对每个 case，在 memory-service test DB 中调用 `EvidenceWatchContractService.createOrReuseFromPlan`。
3. 如果 case 包含 action，使用 `ActionRepository` 以 contract 级 idempotency 创建多次 action，验证重复动作是否被复用。
4. 如果 case 包含 run receipts，追加 receipt 并检查 contract state 与 UI label。
5. 通过确定性 heuristic 打分，不调用 LLM，不依赖远端 10.32.56.212。

## Pass Criteria

- 必须创建 contract 的 case 需要有 contract id、subject key、verifier 和 UI receipt。
- `shouldReuseContract=true` 的 case，第二次同一事实问题必须返回同一 contract id。
- `shouldSuppressDuplicates=true` 的 case，重复 action 必须产生至少一条 `skipped_duplicate` receipt。
- 只有 `checked_no_change` 才能把 contract 标为 `quiet_no_change`；`created` 和 `skipped_duplicate` 只能证明契约/去重成立，不能证明来源已复核。
- `expectedState` 必须与最终 contract state 一致。

## Report requirements

报告必须说明每个 case 的真实场景、输入问题、期望行为、实际 contract / receipt / action 去重结果、通过或失败原因，以及下一步改进建议。报告应通过共享 Reader Contract 渲染，不新增 suite 专属 HTML。

## Command

```bash
npm run eval:run -- --suite evidence-watch-contracts --no-repair
```
