# Memory Lifecycle Experience Workflow

## Goal

验证无感记忆遗忘层是否真的改变了用户体验：久远、低价值、负反馈或已归档的记忆不再污染默认 Ask、Context Recall、Memory Lens、Compose Assist；但用户明确做历史查询或显式搜索时，仍能以降级方式看到可追溯证据。

## Steps

1. 从 `evals/cases/memory-lifecycle/cases.jsonl` 读取 synthetic lifecycle 样本。
2. 每条 case 启动独立的内存 SQLite，应用 Memory Service migrations。
3. 种入受控 `messages_raw`、`memory_metadata` 和 `memory_feedback_events`。
4. 调用真实 `RecallEngine` 或 `ForgettingEngine`，不使用 mock judge 判断业务结果。
5. 保存每条 case 的请求、召回输出、tier 写回结果和启发式 judge 结论。
6. report 展示默认召回、被动召回、写作召回、历史/显式搜索、定时遗忘写回的差异。

## Pass Criteria

- `active_default` 不返回 `archive_only` 或 `forgotten`。
- `passive_surface` / `composer_surface` 只允许 `core` / `active`，并压制负反馈记忆。
- 无 metadata 的久远记忆按虚拟 `historical` 处理，不进入被动关联。
- `explicit_search` / `historical` 可以返回 `archive_only` 或 `historical`，但 report 必须显示 tier。
- `ForgettingEngine.runForgettingCycle()` 会写回 `retrieval_tier`、`effective_salience` 和对应 consolidation level。

## Expected Case Inputs

- `id`、`kind`、`title` 和 `scenario`
- `sampleContext.memories[]`：synthetic memory、age、salience、tier、feedback
- `expectedBehavior.recallChecks[]`：每个 lifecycle mode 的 mustInclude / mustExclude / expectedTiers
- `expectedBehavior.forgetting`：定时遗忘后应写回的 tier 和 consolidation level
- `privacy` 和 `owner`

## Report Requirements

- Show what synthetic memories were seeded, including age, tier, salience, and feedback action.
- Show expected behavior for each lifecycle mode next to actual returned ids and tiers.
- Show forgetting-cycle writeback output for `retrieval_tier` and `consolidation_level`.
- Show pass/fail scores for lifecycle filtering, historical access, archive writeback, and reportability.
- Show concrete next steps when a memory leaks into a stricter mode or cannot be recovered by explicit search.

## Run Examples

```bash
npm run eval:validate
npm run eval:run -- --suite memory-lifecycle --no-repair
npm run eval:run -- --case lifecycle-default-hides-archive --no-repair
```
