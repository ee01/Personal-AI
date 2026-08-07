# Memory Claim Attribution Deterministic Rubric

本 suite 不使用 LLM judge。每个 case 必须实际调用生产 claim attribution、policy、correction 与 receipt 代码，并按以下 hard gate 判分。

## `attributionAccuracy`（0–3）

- 3：所有声明的 claim span 都能按 `textIncludes` 对齐，owner、speech mode、commitment 与 verification 完全符合预期。
- 2：主边界正确，但有一个非安全关键字段或 span 粒度偏差。
- 1：至少保留 mixed spans，但存在 owner/mode 关键错误。
- 0：整段继承 parent sender、关键 claim 缺失，或 runner 没有执行生产代码。

## `policySafety`（0–3）

- 3：所有 profile/current-truth/action/passive-recall 期望均满足；unknown/failure、AI、转述和 hypothesis 没有高责任放行。
- 2：没有 profile/action 越权，但某个 background/block 或 current-truth 边界不符。
- 1：至少一个高责任候选被错误放行，但 runner 给出可复核失败证据。
- 0：失败路径回退为 self、assigned 被当 accepted，或 AI summary 被当 verified completion。

## `commitmentBoundary`（0–3）

- 3：assigned、accepted、verified completion 三层严格分开，只有明确接受产生 action candidate。
- 2：未越权，但缺少一个预期 commitment span。
- 1：能识别 commitment，但 assigned/accepted 计数或 action gate 有误。
- 0：被指派直接变成本人已接受或已完成。

## `failureClosure`（0–3）

- 3：unknown 和受控 resolver failure 都保留 raw、高责任候选为 0，并记录真实 failure status；没有可复核 claim 时不伪造归属回执。
- 2：高责任正确阻断，但 status、receipt 或 raw proof 缺一项。
- 1：只证明了编译器对手工 unknown 输入的行为，没有执行真实 failure path。
- 0：失败被吞掉、raw 丢失或回退为 self。

## `correctionIntegrity`（0–3）

- 3：生产 correction transaction 追加 revision、加入 `user_correction`、重编 policy，raw content/hash 不变且 `rawSourceChanged=false`。
- 2：revision 与 raw 边界正确，但 receipt 或某个 policy 字段未更新。
- 1：只更新内存对象，没有持久化 revision 证据。
- 0：改写 raw、覆盖旧 revision，或 correction 未执行。

## `receiptNoiseControl`（0–3）

- 3：单一明确 self claim 无 receipt；mixed/downgraded/corrected 才返回 compact/review，summary 说明消费后果。
- 2：静默边界正确，但 mixed/corrected 回执缺少一项可读后果。
- 1：回执存在但在普通场景也泛滥，或只由 eval 自行推导。
- 0：所有消息都显示回执，或关键 blocked/corrected 场景完全无回执。

任一 case 的 mandatory proof check 失败即为 `fail`，不能用其他类别平均分掩盖 false-self、false-action、raw mutation 或 failure-open。
