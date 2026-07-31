# Change Memory Ledger Experience Workflow

## Goal

验证“变化脉络”是否把同一稳定对象的状态变化保存为可核对历史，并在 Memory Lens、Ask 与 Compose 使用时严格区分当前确认、最后观测、冲突、回退和页面新值。

## Real User Scenarios

1. 用户打开 Jira `NOVA-101`，Lens 不只提示一条旧消息，而是显示 DEV Estimate 从 `0.2 -> 0.1 -> 0.2`，并明确最后一步是回退。
2. 用户问“Desktop 8.2 现在什么时候发布”，两个同等权威来源给出不同日期时，Ask 必须先说存在冲突并要求核对，而不是任选一个日期。
3. 用户在 Goal 讨论中准备回复，Compose 可以使用 Owner 的最后观测变化，但草稿证据必须保留“未由权威系统确认”的边界。

## Steps

1. Load cases from `evals/cases/change-memory-ledger/cases.jsonl`.
2. Create an in-memory Memory Service database with all migrations.
3. Ingest each case's explicit structured changes or deterministic old/new text through `MemoryChangeLedgerService.syncSource()`.
4. Read source receipts, context projections, Ask prompt context, and the exact Compose evidence adapter output requested by the case.
5. Judge extraction count, property/subject isolation, typed current values, reversal/conflict counts, visible-page reconciliation, and required/forbidden boundary language.
6. Save request/response artifacts and produce the standard HTML eval report.

## Pass Criteria

- A change requires a stable subject and a meaningful old/new value; UI shell noise and same-value updates do not form events.
- Goal multi-field changes form independent property chains under one stable Goal subject.
- `A -> B -> A` remains a three-state history and marks the final event as a reversal.
- Equal-authority disagreement is `conflicted`, exposes no arbitrary `currentValue`, and tells Ask/Compose that the current value is unknown; non-authoritative evidence is `last_observed`.
- A current visible page value can supersede the last observed value for presentation without rewriting stored history.
- Adjacent Jira/Goal/release subjects never leak into one another.
- Ask and Compose outputs preserve current-state boundaries and never invent a reason that is absent from source evidence.

## Report Requirements

- Show source inputs, extraction receipts, event counts, excluded-noise counts, and stable subject/property keys.
- Show projection status, current/visible value, reversal/conflict counts, and ordered history.
- Show the exact Ask prompt block and Compose evidence snippet used for boundary checks.
- List every failed required phrase, forbidden phrase, count, status, or isolation assertion.
- Include a user-facing conclusion and concrete next steps for any failed case.

## Local Run

```bash
npm run eval:run -- --suite change-memory-ledger --no-repair
```
