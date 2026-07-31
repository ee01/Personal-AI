# Evidence Cohesion Gate Experience Eval

本 suite 验证 Personal AI 在 `/ask`、Reflection Worker、`context-recall` 和 Context Pack 消费记忆前，能否先判断候选证据是否属于同一个主题、场景与事实槽位。目标是减少跨项目串场，同时不误删宽泛历史查询或同主题冲突证据。

## Real Scenarios

1. Ask 询问 UMW 的用途和仓库时，召回集合混入 `rc-ai-learning` 与 AI Notes。Gate 应静默移除邻近项目证据。
2. Reflection 同时拿到 `oathbound-arena` 的 `attachment_id` 与 BE USS Teams routing，但没有线程主题。Gate 应在生成外部动作前要求拆分。
3. 用户询问“最近在不同项目里分别完成了什么”时，多场景就是合法范围，Gate 应保留全部候选。
4. 用户浏览 `MTR-141852` 时，Context Recall 应保留该 issue 的状态与估时，静默移除其他 issue。
5. 工作 Context Pack 混入个人范围记忆时，Gate 应阻止继续外发。
6. 同一主题的两条状态互相冲突时，Gate 应保留证据并交给权威来源判断。
7. 工具预算问题里的 `GPT-5.5` 与 `Dev/QA` 不应被误识别为 Jira key 或 repo，Cursor 额度证据必须保留。

## Steps

1. 读取 `evals/cases/evidence-cohesion-gate/cases.jsonl`。
2. 将每个 case 的全部候选视为旧的 `consume-all` 基线。
3. 通过生产 `EvidenceCohesionGateService.evaluate()` 执行同一个 case。
4. 精确比较状态、包含集合、排除集合、静默回执与阻断决定。
5. 计算基线串场数、Gate 后串场数、必需证据召回率、证据精度和泄漏下降比例。
6. 使用确定性 heuristic 判分，不调用 LLM，不访问远端 Memory Service。

## Pass Criteria

- 每个 case 的 Gate state 与预期完全一致。
- 预期保留和排除的 `evidenceRef` 集合必须完全一致。
- Gate 后跨题泄漏必须为 0，必需证据召回率必须为 100%。
- 有跨题候选的 case 必须比 `consume-all` 基线减少泄漏。
- `split_required`、`insufficient_anchor`、`blocked_cross_scene` 必须阻断；`cohesive` 和 `conflict_needs_authority` 不得误阻断。
- 宽泛 Ask 与同主题冲突 case 必须证明 Gate 不以零串场为名过度删除证据。

## Report Requirements

- 使用共享 Reader Contract 渲染，不新增 suite 专属 HTML。
- 每个 case 展示真实场景、预期与实际状态、基线/Gate 证据集合、逐项 proof check 和改进建议。
- 报告明确说明本 suite 证明的是确定性候选选择与动作边界，不证明最终 LLM 回答质量，也不证明线上数据分布已经全部覆盖。
- 完整 request、response、judge payload 保存在 run artifacts 中。

## Command

```bash
npm run eval:validate
npm run eval:run -- --suite evidence-cohesion-gate --no-repair
```
