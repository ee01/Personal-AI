# Recall Synthesis Contract Experience Workflow

## Goal

验证 Recall 的证据检索与 LLM 总结是否具有清晰、可审计的边界：普通检索零模型调用；主动总结受最小证据门控；成功输出必须引用本次快照；相同查询和证据快照才可复用。

## Steps

1. 读取 `evals/cases/recall-synthesis-contract/cases.jsonl` 的合成证据和模型输出。
2. 将每个 case 的证据写入独立的内存数据库记录。
3. 通过 `ActiveRecallService` 执行真实检索、展示块、总结门控、解析和缓存逻辑。
4. 统计模型 stub 的实际调用次数，并检查 synthesis receipt、证据 ID 与 cache hit。
5. 输出每个 case 的 pass/fail 与明确的验证边界。

## Pass Criteria

- 未显式请求 synthesis 时，模型调用数为 0，receipt 为 `not_requested`。
- 证据少于调用方设定的最小条数时，模型调用数为 0，receipt 为 `skipped_insufficient`。
- 成功总结的所有证据 ID 都属于本次返回快照。
- 无效或越界证据引用返回 `invalid_output`，不返回可展示 analysis。
- 同一查询与同一证据快照的重复请求仅调用模型一次，第二次 receipt 标记 cache hit。

## Expected Case Inputs

- stable `id`, `kind`, and `title`
- query and synthetic evidence items
- explicit presentation/synthesis request
- sample model output when synthesis should run
- expected receipt, model call count, grounding, and cache behavior
- privacy and owner metadata

## Report Requirements

- 控制台逐 case 展示真实 receipt 与模型调用数。
- 明确本套件使用合成证据和模型输出，只证明路由、门控、grounding 与缓存契约。
- 不把通过结果描述为真实模型文案质量、线上数据相关性或生产延迟证明。

## Run Examples

```bash
npm run eval:validate
npm run eval:recall-synthesis-contract
```
